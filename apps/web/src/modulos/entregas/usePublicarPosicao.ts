import { useEffect, useRef } from 'react'
import { chamar } from '../../comum/api/http'
import type { PosicaoAoVivo } from '../../comum/ganchos/useLocalizacaoAoVivo'

/**
 * Conta ao servidor onde o motorista está, para o dono acompanhar.
 *
 * Usa o GPS que já está ligado para a navegação — nenhuma bateria a mais é
 * gasta, e nada é enviado quando ele desliga o GPS.
 *
 * A frequência é deliberadamente baixa. O GPS entrega leitura quase a cada
 * segundo; mandar tudo isso seria milhares de requisições por dia para
 * responder a uma pergunta que muda devagar — "onde está o carro". Um aviso a
 * cada dois minutos já mostra o carro andando no mapa do dono.
 *
 * Falhar não faz nada: sem rede, a posição simplesmente não sobe, e a tela do
 * dono mostra a idade da última que chegou. Enfileirar posição velha seria
 * pior do que não ter — ele veria o carro "andando" por um caminho que já
 * aconteceu há meia hora.
 */

const INTERVALO_MS = 120_000

export function usePublicarPosicao(posicao: PosicaoAoVivo | null, ativo: boolean) {
  // A posição muda o tempo todo; guardada numa ref, o relógio não é recriado a
  // cada leitura do GPS.
  const atual = useRef(posicao)
  atual.current = posicao

  useEffect(() => {
    if (!ativo) return

    const enviar = async () => {
      const agora = atual.current
      if (!agora) return
      try {
        await chamar('/api/rota/posicao', {
          metodo: 'POST',
          corpo: {
            latitude: agora.latitude,
            longitude: agora.longitude,
            precisaoMetros: agora.precisaoMetros,
          },
        })
      } catch {
        // Sem rede agora; a próxima leva a posição daquele momento.
      }
    }

    // Um envio logo de cara, para o dono não esperar dois minutos para ver o
    // carro aparecer quando o motorista liga o GPS.
    void enviar()
    const relogio = setInterval(() => void enviar(), INTERVALO_MS)
    return () => clearInterval(relogio)
  }, [ativo])
}
