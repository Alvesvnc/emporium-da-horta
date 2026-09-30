import { env } from '../../config/ambiente.js'
import type { Ponto } from './geografia.js'
import type { ParadaEntrada, RotaCalculada } from './roteador.js'

/**
 * Rota pela Routes API do Google, com trânsito.
 *
 * É o único provedor aqui que sabe de congestionamento: o OSRM calcula com
 * velocidade fixa de via. Com trânsito muda a ORDEM das paradas (uma entrega
 * perto atrás de um engarrafamento pode valer depois de uma mais longe com via
 * livre) e a previsão de chegada deixa de ser chute.
 *
 * ATENÇÃO AO CUSTO: pedir trânsito (`TRAFFIC_AWARE`) ou otimização de ordem
 * (`optimizeWaypointOrder`) coloca a chamada na faixa "Compute Routes Pro" —
 * 5.000 grátis por mês, depois US$ 10 por mil. Por isso o resultado é
 * guardado em cache: a tela do motorista recarregando não gasta chamada.
 */

const ENDERECO = 'https://routes.googleapis.com/directions/v2:computeRoutes'
const TEMPO_LIMITE_MS = 8000

/** Só o que a gente usa — pedir campo a mais custa mais caro em alguns SKUs. */
const CAMPOS = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.polyline.geoJsonLinestring',
  'routes.legs.duration',
  'routes.legs.distanceMeters',
  'routes.optimizedIntermediateWaypointIndex',
].join(',')

type RespostaGoogle = {
  routes?: Array<{
    duration?: string // "1234s"
    distanceMeters?: number
    polyline?: { geoJsonLinestring?: { coordinates?: Array<[number, number]> } }
    legs?: Array<{ duration?: string; distanceMeters?: number }>
    /** Ordem ótima: para cada parada enviada, a posição que ela ocupa. */
    optimizedIntermediateWaypointIndex?: number[]
  }>
  error?: { message?: string; status?: string }
}

/** "1234s" → 1234 */
function segundos(valor: string | undefined): number {
  const n = Number.parseFloat(String(valor ?? '').replace('s', ''))
  return Number.isFinite(n) ? n : 0
}

const comoPonto = (p: Ponto) => ({
  location: { latLng: { latitude: p.latitude, longitude: p.longitude } },
})

export function googleConfigurado(): boolean {
  return Boolean(env.GOOGLE_MAPS_API_KEY)
}

export async function pelaRuaComTransito(
  paradas: ParadaEntrada[],
  origem: Ponto,
): Promise<RotaCalculada> {
  if (!env.GOOGLE_MAPS_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY não configurada')

  const corpo = {
    origin: comoPonto(origem),
    // Volta para a central no fim: o motorista termina onde começou.
    destination: comoPonto(origem),
    intermediates: paradas.map(comoPonto),
    travelMode: 'DRIVE',
    // TRAFFIC_AWARE usa o trânsito atual sem o custo de latência do
    // TRAFFIC_AWARE_OPTIMAL, que é bem mais lento para muitas paradas.
    routingPreference: 'TRAFFIC_AWARE',
    optimizeWaypointOrder: true,
    polylineEncoding: 'GEO_JSON_LINESTRING',
    languageCode: 'pt-BR',
    units: 'METRIC',
  }

  const resposta = await fetch(ENDERECO, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': CAMPOS,
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  })

  const dados = (await resposta.json()) as RespostaGoogle

  if (!resposta.ok || dados.error) {
    // Cota estourada cai aqui e vira queda para o OSRM — de propósito. Se
    // você limitou a cota no console do Google, é assim que a tela continua
    // funcionando em vez de quebrar.
    throw new Error(dados.error?.message ?? `Google respondeu ${resposta.status}`)
  }

  const rota = dados.routes?.[0]
  if (!rota) throw new Error('Google não devolveu rota')

  // `optimizedIntermediateWaypointIndex[i]` é a posição da parada i na ordem
  // ótima. Sem ele, a ordem enviada é a ordem devolvida.
  const posicoes = rota.optimizedIntermediateWaypointIndex ?? paradas.map((_, i) => i)
  const trechos = rota.legs ?? []

  const ordenadas = paradas
    .map((parada, i) => {
      const posicao = posicoes[i] ?? i
      // legs[0] é central → primeira parada; legs[posicao] chega na parada.
      const trecho = trechos[posicao]
      return {
        ...parada,
        ordem: posicao + 1,
        distanciaKm: Number(((trecho?.distanceMeters ?? 0) / 1000).toFixed(2)),
        minutos: Math.round(segundos(trecho?.duration) / 60),
      }
    })
    .sort((a, b) => a.ordem - b.ordem)

  return {
    provedor: 'google',
    paradas: ordenadas,
    distanciaTotalKm: Number(((rota.distanceMeters ?? 0) / 1000).toFixed(1)),
    minutosTotal: Math.round(segundos(rota.duration) / 60),
    // O GeoJSON vem em longitude,latitude — invertemos para o mapa.
    geometria: (rota.polyline?.geoJsonLinestring?.coordinates ?? []).map(
      ([lon, lat]) => [lat, lon] as [number, number],
    ),
    aviso: null,
  }
}
