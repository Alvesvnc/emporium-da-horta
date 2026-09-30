import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A posição do aparelho, ao vivo.
 *
 * Usa o GPS do próprio navegador (`navigator.geolocation`): não tem chave, não
 * tem cadastro e não tem custo. Em troca, tem quatro regras que precisam estar
 * na cara de quem usa, porque o navegador falha calado:
 *
 *  1. só funciona em HTTPS (ou em localhost). Aberto por IP na rede local,
 *     o navegador simplesmente não entrega a posição;
 *  2. a pessoa precisa autorizar, e pode ter negado numa visita anterior —
 *     nesse caso não aparece nenhum aviso novo, só para de funcionar;
 *  3. dentro de galpão ou túnel a precisão despenca. Por isso `precisaoMetros`
 *     vem junto: posição com 800 m de erro não serve para dizer "você chegou";
 *  4. o `timeout` do navegador NÃO é confiável. Autorizado e sem conseguir a
 *     posição, ele pode nunca chamar nem o sucesso nem o erro. Por isso existe
 *     o cão de guarda aqui embaixo: quem promete resposta é este arquivo.
 *
 * Cada estado tem mensagem própria na tela — motorista não deve ficar olhando
 * para um botão que não faz nada.
 */

export type PosicaoAoVivo = {
  latitude: number
  longitude: number
  /** Raio de incerteza em metros, como o próprio aparelho declara. */
  precisaoMetros: number
  /** Direção em graus (0 = norte), quando o aparelho sabe. */
  rumo: number | null
  em: number
}

export type EstadoGps =
  | 'desligado'
  | 'pedindo'
  | 'seguindo'
  | 'sem-sinal'
  | 'negado'
  | 'indisponivel'
  | 'sem-https'
  | 'falhou'

const LEMBRETE = 'rota:gps-ligado'

/**
 * Quanto esperamos antes de admitir que não veio nada.
 *
 * Não desiste: continua ouvindo, porque em rua aberta a posição costuma chegar
 * depois. Só troca o recado da tela, para o motorista parar de esperar um
 * "Procurando…" que nunca termina.
 */
const PACIENCIA_MS = 12_000

export function useLocalizacaoAoVivo() {
  const [posicao, setPosicao] = useState<PosicaoAoVivo | null>(null)
  const [estado, setEstado] = useState<EstadoGps>('desligado')

  const vigia = useRef<number | null>(null)
  const caoDeGuarda = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pararTudo = useCallback(() => {
    if (vigia.current !== null) {
      navigator.geolocation.clearWatch(vigia.current)
      vigia.current = null
    }
    if (caoDeGuarda.current !== null) {
      clearTimeout(caoDeGuarda.current)
      caoDeGuarda.current = null
    }
  }, [])

  const desligar = useCallback(() => {
    pararTudo()
    setEstado('desligado')
    setPosicao(null)
    try {
      localStorage.removeItem(LEMBRETE)
    } catch {
      // Navegação anônima pode recusar o armazenamento. Não é motivo para
      // impedir o motorista de desligar o GPS.
    }
  }, [pararTudo])

  const ligar = useCallback(() => {
    if (!window.isSecureContext) {
      setEstado('sem-https')
      return
    }
    if (!('geolocation' in navigator)) {
      setEstado('indisponivel')
      return
    }
    if (vigia.current !== null) return

    setEstado('pedindo')

    const anotar = (leitura: GeolocationPosition) => {
      if (caoDeGuarda.current !== null) {
        clearTimeout(caoDeGuarda.current)
        caoDeGuarda.current = null
      }
      setPosicao({
        latitude: leitura.coords.latitude,
        longitude: leitura.coords.longitude,
        precisaoMetros: leitura.coords.accuracy,
        rumo: Number.isFinite(leitura.coords.heading) ? leitura.coords.heading : null,
        em: leitura.timestamp,
      })
      setEstado('seguindo')
      try {
        localStorage.setItem(LEMBRETE, '1')
      } catch {
        // Sem memória do navegador o GPS ainda funciona; só não liga sozinho
        // na próxima vez.
      }
    }

    /**
     * Primeiro tiro: rápido e sem exigência de precisão.
     *
     * Aceita posição de até cinco minutos atrás e não pede alta precisão, então
     * o computador responde pela rede (Wi-Fi/IP) em vez de esperar um satélite
     * que ele não tem antena para ouvir. É o que tira a tela do "Procurando…"
     * quase na hora; o `watchPosition` abaixo refina depois.
     */
    navigator.geolocation.getCurrentPosition(anotar, () => {}, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 300_000,
    })

    // Acompanhamento contínuo, agora sim pedindo o melhor que o aparelho tem.
    // No celular isso vira o GPS de verdade: ~10 m em vez de ~1 km.
    vigia.current = navigator.geolocation.watchPosition(
      anotar,
      (falha) => {
        if (falha.code === falha.PERMISSION_DENIED) {
          pararTudo()
          setEstado('negado')
          return
        }
        // Sinal ruim e tempo esgotado não são motivo para desistir: o carro
        // anda, e a posição costuma aparecer no quarteirão seguinte. Só avisa
        // quem ainda não recebeu nada — quem já tem posição continua seguindo.
        setEstado((atual) => (atual === 'seguindo' ? atual : 'sem-sinal'))
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    )

    caoDeGuarda.current = setTimeout(() => {
      setEstado((atual) => (atual === 'pedindo' ? 'sem-sinal' : atual))
    }, PACIENCIA_MS)
  }, [pararTudo])

  // Se ele já tinha ligado antes, religa sozinho: a permissão continua dada e
  // o navegador não pergunta de novo. Poupa um toque a cada entrega.
  useEffect(() => {
    let queria = false
    try {
      queria = localStorage.getItem(LEMBRETE) === '1'
    } catch {
      queria = false
    }
    if (queria) ligar()
  }, [ligar])

  useEffect(() => pararTudo, [pararTudo])

  return { posicao, estado, ligar, desligar }
}
