import { useCallback, useEffect, useRef, useState } from 'react'
import { chamar, ErroApi } from '../../comum/api/http'
import type { Manobra, RespostaNavegacao, RotaNavegavel } from '@emporium/shared'
import type { PosicaoAoVivo } from '../../comum/ganchos/useLocalizacaoAoVivo'
import { projetarNaRota } from '../../comum/mapa/geo'

/**
 * Navegação curva a curva até a parada da vez.
 *
 * O servidor traça o caminho e escreve as frases; aqui decide-se, a cada
 * leitura do GPS, QUAL frase vale agora, quanto falta para ela, e se o
 * motorista saiu do caminho.
 *
 * Três cuidados que existem por causa do trânsito de verdade:
 *
 *  • recalcular é caro e o servidor de rotas é público. Só recalcula depois de
 *    o desvio se confirmar em leituras seguidas, e nunca mais de uma vez a
 *    cada intervalo — carro parado em semáforo com GPS oscilando dispararia
 *    recálculo em série;
 *  • posição com muita incerteza não move a navegação. Errar a manobra por
 *    causa de leitura ruim é pior que atrasar a manobra;
 *  • ao chegar, a navegação se encerra sozinha. Ninguém deveria precisar
 *    desligar nada com o carro na porta do cliente.
 */

/** Fora do caminho a partir daqui. Rua larga com duas pistas cabe em 40 m. */
const DESVIO_METROS = 45
/** Leituras seguidas fora do caminho antes de aceitar que ele desviou. */
const LEITURAS_PARA_RECALCULAR = 3
/** Intervalo mínimo entre dois recálculos. */
const ESPERA_ENTRE_RECALCULOS_MS = 20_000
/** Acima disto a posição não é confiável o bastante para guiar. */
const INCERTEZA_MAXIMA_M = 150

export type EstadoNavegacao = 'desligada' | 'tracando' | 'guiando' | 'recalculando' | 'erro'

export type PassoAtual = {
  /** A manobra que ele está se aproximando. */
  manobra: Manobra
  /** Distância até ela, em metros. */
  metrosAteManobra: number
  /** A manobra seguinte, para o motorista já saber o que vem depois. */
  depois: Manobra | null
  metrosRestantes: number
  minutosRestantes: number
}

export function useNavegacao({
  pedidoId,
  posicao,
  ativa,
}: {
  pedidoId: number | null
  posicao: PosicaoAoVivo | null
  ativa: boolean
}) {
  const [rota, setRota] = useState<RotaNavegavel | null>(null)
  const [estado, setEstado] = useState<EstadoNavegacao>('desligada')
  const [erro, setErro] = useState<string | null>(null)
  const [passo, setPasso] = useState<PassoAtual | null>(null)

  const forasSeguidas = useRef(0)
  const ultimoRecalculo = useRef(0)
  const tracando = useRef(false)
  /** Para qual parada a rota em mãos foi traçada. */
  const rotaDe = useRef<number | null>(null)

  const tracar = useCallback(
    async (de: PosicaoAoVivo, alvo: number, recalculo: boolean) => {
      // Duas chamadas ao mesmo tempo só gastariam o servidor duas vezes.
      if (tracando.current) return
      tracando.current = true

      setEstado(recalculo ? 'recalculando' : 'tracando')
      setErro(null)
      try {
        const resposta = await chamar<RespostaNavegacao>('/api/rota/navegar', {
          metodo: 'POST',
          corpo: { pedidoId: alvo, latitude: de.latitude, longitude: de.longitude },
        })
        setRota(resposta.navegacao)
        setEstado('guiando')
        forasSeguidas.current = 0
        ultimoRecalculo.current = Date.now()
      } catch (falha) {
        setEstado('erro')
        setErro(
          falha instanceof ErroApi ? falha.message : 'Não consegui traçar o caminho até a parada.',
        )
      } finally {
        tracando.current = false
      }
    },
    [],
  )

  /**
   * Ligar, desligar e trocar de parada.
   *
   * `rotaDe` é o que faz a troca de parada funcionar: sem ele, a rota da parada
   * anterior continuaria em mãos e a navegação nunca traçaria o caminho para o
   * destino novo — guiaria o motorista para a casa errada.
   */
  useEffect(() => {
    if (!ativa || pedidoId === null) {
      setRota(null)
      setPasso(null)
      setEstado('desligada')
      setErro(null)
      forasSeguidas.current = 0
      rotaDe.current = null
      return
    }

    if (rotaDe.current !== pedidoId) {
      // Destino novo: o que estava desenhado não vale mais.
      setRota(null)
      setPasso(null)
    }

    if (!posicao) return
    if (rotaDe.current === pedidoId && rota) return
    // Falhou: quem decide tentar de novo é o motorista, no botão. Repetir
    // sozinho a cada leitura do GPS castigaria o servidor de rotas.
    if (rotaDe.current === pedidoId && estado === 'erro') return

    rotaDe.current = pedidoId
    void tracar(posicao, pedidoId, false)
    // `posicao` muda a cada leitura; aqui só interessa se JÁ existe alguma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativa, pedidoId, posicao !== null, rota, estado, tracar])

  // A cada leitura do GPS: onde ele está no caminho, e o que fazer agora.
  useEffect(() => {
    if (!ativa || !rota || !posicao || pedidoId === null) return
    if (posicao.precisaoMetros > INCERTEZA_MAXIMA_M) return

    const projecao = projetarNaRota(posicao, rota.geometria)
    if (!projecao) return

    // ── Saiu do caminho? ───────────────────────────────────────
    if (projecao.desvioMetros > DESVIO_METROS) {
      forasSeguidas.current += 1
      const jaPode = Date.now() - ultimoRecalculo.current > ESPERA_ENTRE_RECALCULOS_MS
      if (forasSeguidas.current >= LEITURAS_PARA_RECALCULAR && jaPode) {
        void tracar(posicao, pedidoId, true)
      }
    } else {
      forasSeguidas.current = 0
    }

    // ── Em qual manobra ele está ───────────────────────────────
    // `manobras[i].metros` é o quanto se anda DURANTE o passo i, e a manobra
    // do passo i+1 acontece no fim dele. Então a curva que vem é a do passo
    // seguinte àquele em que a posição caiu.
    let inicioDoPasso = 0
    let indice = rota.manobras.length - 1
    for (let i = 0; i < rota.manobras.length; i++) {
      const fim = inicioDoPasso + rota.manobras[i]!.metros
      if (projecao.percorridosMetros < fim || i === rota.manobras.length - 1) {
        indice = i
        break
      }
      inicioDoPasso = fim
    }

    const passoAtual = rota.manobras[indice]!
    const proxima = rota.manobras[indice + 1] ?? passoAtual
    const metrosAteManobra = Math.max(
      0,
      inicioDoPasso + passoAtual.metros - projecao.percorridosMetros,
    )

    setPasso({
      manobra: proxima,
      metrosAteManobra: rota.manobras[indice + 1] ? metrosAteManobra : projecao.restantesMetros,
      depois: rota.manobras[indice + 2] ?? null,
      metrosRestantes: projecao.restantesMetros,
      // Regra de três sobre a estimativa do servidor: mais honesto que inventar
      // uma velocidade média que o trânsito de Manaus não respeita.
      minutosRestantes: Math.max(
        0,
        Math.round((rota.segundosTotal * (projecao.restantesMetros / (rota.metrosTotal || 1))) / 60),
      ),
    })
  }, [posicao, rota, ativa, pedidoId, tracar])

  /** Força um recálculo — o botão "refazer o caminho" da tela. */
  const refazer = useCallback(() => {
    if (!posicao || pedidoId === null) return
    ultimoRecalculo.current = 0
    rotaDe.current = pedidoId
    void tracar(posicao, pedidoId, true)
  }, [posicao, pedidoId, tracar])

  return { rota, passo, estado, erro, refazer }
}
