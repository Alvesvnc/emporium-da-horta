import { env } from '../../config/ambiente.js'
import type { Ponto } from './geografia.js'
import { acaoDoOsrm, redigir, type Manobra } from './manobras.js'
import { navegarComTransito, tomtomConfigurado } from './tomtom.js'

/**
 * Navegação curva a curva até UMA parada.
 *
 * Diferente do roteador do dia, que resolve a ordem de todas as entregas. Aqui
 * é de onde o motorista está até o próximo destino, com as manobras do caminho.
 *
 * Dois provedores, mesma resposta:
 *
 *   tomtom — com trânsito, serviço contratado. É o bom.
 *   osrm   — sem trânsito. Plano B quando a cota acaba ou o serviço cai.
 *
 * As frases são montadas em manobras.ts, iguais para os dois: quando a rota cai
 * para o plano B, o motorista não pode perceber pela voz.
 *
 * ATENÇÃO AO PROVEDOR OSRM: se OSRM_URL apontar para
 * `router.project-osrm.org`, isso é o servidor público de DEMONSTRAÇÃO. Não
 * tem garantia de disponibilidade e a política dele pede que não seja usado em
 * produção. Como plano B de baixo volume passa; como provedor principal de uma
 * operação de verdade, suba um OSRM próprio.
 */

export type { IconeManobra, Manobra } from './manobras.js'

const TEMPO_LIMITE_MS = 8000

export type RotaNavegavel = {
  manobras: Manobra[]
  /** Traçado completo em [latitude, longitude]. */
  geometria: Array<[number, number]>
  metrosTotal: number
  segundosTotal: number
}

type PassoOsrm = {
  distance: number
  duration: number
  name?: string
  maneuver: {
    type: string
    modifier?: string
    exit?: number
    location: [number, number]
  }
}

type RespostaOsrm = {
  code: string
  message?: string
  routes?: Array<{
    distance: number
    duration: number
    geometry?: { coordinates?: Array<[number, number]> }
    legs?: Array<{ steps?: PassoOsrm[] }>
  }>
}

/**
 * Guarda a última rota calculada por pouco tempo.
 *
 * A tela recalcula quando o motorista sai do caminho, e com o carro parado num
 * semáforo isso pode disparar várias vezes seguidas. A chave arredonda a
 * origem para ~110 m: pedidos praticamente do mesmo lugar reaproveitam a
 * resposta em vez de gastar chamada de novo.
 */
const VALIDADE_MS = 30_000
const guardadas = new Map<string, { rota: RotaNavegavel; em: number }>()

function chaveDe(de: Ponto, ate: Ponto): string {
  const arredondar = (n: number) => n.toFixed(3) // ~110 m em latitude
  return [arredondar(de.latitude), arredondar(de.longitude), ate.latitude, ate.longitude].join(',')
}

/** Caminho pelo OSRM: sem trânsito, mas de graça e sem cota. */
async function pelaRuaSemTransito(de: Ponto, ate: Ponto): Promise<RotaNavegavel> {
  // O OSRM fala em longitude,latitude — nesta ordem.
  const pontos = `${de.longitude},${de.latitude};${ate.longitude},${ate.latitude}`
  const parametros = new URLSearchParams({
    steps: 'true',
    overview: 'full',
    geometries: 'geojson',
    annotations: 'false',
  })

  const resposta = await fetch(`${env.OSRM_URL}/route/v1/driving/${pontos}?${parametros}`, {
    headers: { 'User-Agent': env.CONTATO_APP },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  })

  if (!resposta.ok) throw new Error(`OSRM respondeu ${resposta.status}`)

  const dados = (await resposta.json()) as RespostaOsrm
  const rota = dados.routes?.[0]
  if (dados.code !== 'Ok' || !rota) {
    throw new Error(`OSRM não traçou o caminho: ${dados.message ?? dados.code}`)
  }

  const passos = rota.legs?.flatMap((perna) => perna.steps ?? []) ?? []

  return {
    manobras: passos.map((passo, i) => {
      const via = passo.name?.trim() || null
      const { instrucao, icone } = redigir(
        acaoDoOsrm(passo.maneuver.type, passo.maneuver.modifier, passo.maneuver.exit),
        via,
        i === passos.length - 1,
      )
      return {
        instrucao,
        via,
        icone,
        metros: Math.round(passo.distance),
        segundos: Math.round(passo.duration),
        latitude: passo.maneuver.location[1],
        longitude: passo.maneuver.location[0],
      }
    }),
    geometria: (rota.geometry?.coordinates ?? []).map(([lon, lat]) => [lat, lon] as [number, number]),
    metrosTotal: Math.round(rota.distance),
    segundosTotal: Math.round(rota.duration),
  }
}

/**
 * O caminho até a parada, pelo melhor provedor que responder.
 *
 * TomTom primeiro, porque sabe de trânsito. Se ele falhar — cota estourada,
 * chave errada, serviço fora do ar —, cai para o OSRM em silêncio: o motorista
 * está dirigindo e precisa de instrução, não de mensagem de erro. A queda fica
 * no log do servidor, que é onde alguém vai procurar depois.
 */
export async function navegarAte(de: Ponto, ate: Ponto): Promise<RotaNavegavel> {
  const chave = chaveDe(de, ate)
  const guardada = guardadas.get(chave)
  if (guardada && Date.now() - guardada.em < VALIDADE_MS) return guardada.rota

  let rota: RotaNavegavel | null = null

  if (tomtomConfigurado()) {
    try {
      rota = await navegarComTransito(de, ate)
    } catch (erro) {
      console.warn('[navegacao] TomTom falhou, caindo para o OSRM:', erro)
    }
  }

  if (!rota) rota = await pelaRuaSemTransito(de, ate)

  guardadas.set(chave, { rota, em: Date.now() })
  return rota
}
