import type { Ponto } from './geografia.js'
import type { ParadaEntrada, RotaCalculada } from './roteador.js'

/**
 * Guarda a rota já calculada por alguns minutos.
 *
 * Sem isto, cada vez que o motorista abre ou recarrega a tela é uma chamada
 * nova ao provedor de rotas — e no Google isso é chamada cobrada. Com o cache,
 * gasta-se uma chamada por mudança real: quando entra pedido novo, quando uma
 * parada é marcada como entregue, ou quando o trânsito envelhece.
 *
 * A validade é curta de propósito. Rota com trânsito de meia hora atrás não é
 * informação, é ilusão de informação.
 */

const VALIDADE_MS = 5 * 60_000

type Guardado = { rota: RotaCalculada; em: number }

const guardadas = new Map<string, Guardado>()

/**
 * A chave é o ponto de partida mais o conjunto de paradas — não a ordem delas:
 * se as mesmas entregas estão pendentes e a saída é a mesma, a rota é a mesma.
 * Ordenar antes evita recalcular só porque o banco devolveu as linhas em outra
 * sequência.
 *
 * A origem entra na chave porque o dono pode trocar a sede pela tela de
 * configurações. Sem ela, a rota da sede antiga continuaria sendo servida.
 */
function chaveDe(paradas: ParadaEntrada[], origem: Ponto): string {
  const pontoDePartida = `${origem.latitude},${origem.longitude}`
  /**
   * A coordenada de cada parada entra na chave, e não só o id.
   *
   * Um pedido pode mudar de lugar no mapa sem mudar de id — é o que acontece
   * quando a geocodificação é recalculada (`npm run db:relocalizar`). Com a
   * chave olhando só os ids, a rota guardada continuaria valendo por mais cinco
   * minutos, desenhando as paradas no lugar antigo, e quem estivesse testando
   * juraria que a correção não funcionou.
   */
  const pontos = paradas
    .map((p) => `${p.id}@${p.latitude},${p.longitude}`)
    .sort()
    .join(';')
  return `${pontoDePartida}|${pontos}`
}

export function rotaGuardada(paradas: ParadaEntrada[], origem: Ponto): RotaCalculada | null {
  const chave = chaveDe(paradas, origem)
  const guardada = guardadas.get(chave)
  if (!guardada) return null

  if (Date.now() - guardada.em > VALIDADE_MS) {
    guardadas.delete(chave)
    return null
  }

  return guardada.rota
}

export function guardarRota(paradas: ParadaEntrada[], origem: Ponto, rota: RotaCalculada): void {
  // Rota que caiu para o plano B não fica guardada: da próxima vez o serviço
  // bom pode estar de volta, e não queremos servir o degradado por 5 minutos.
  if (rota.provedor === 'linha-reta') return

  guardadas.set(chaveDe(paradas, origem), { rota, em: Date.now() })
}

/** Chamado quando uma parada muda de status: a rota anterior não vale mais. */
export function esquecerRotas(): void {
  guardadas.clear()
}
