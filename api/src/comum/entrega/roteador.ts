import { env } from '../../config/ambiente.js'
import { distanciaKm, estimarMinutos, ordenarPorVizinhoMaisProximo, type Ponto } from './geografia.js'
import { guardarRota, rotaGuardada } from './cache-rota.js'
import { googleConfigurado, pelaRuaComTransito } from './google-rotas.js'
import { rotaDoDiaComTransito, tomtomConfigurado } from './tomtom.js'

/**
 * Decide em que ordem rodar as entregas e por onde passar.
 *
 * Três provedores, mesma resposta:
 *
 *   tomtom      — Routing API da TomTom. Sabe de TRÂNSITO, resolve a ordem
 *                 considerando congestionamento e devolve previsão real.
 *                 Plano gratuito sem cartão — é o degrau recomendado.
 *   google      — Routes API. Também sabe de trânsito, mas exige cadastro de
 *                 cobrança. Custa: veja o aviso em google-rotas.ts.
 *   osrm        — serviço de rotas de verdade, sem trânsito. Resolve a ordem
 *                 (é um problema do caixeiro-viajante), devolve distância e
 *                 tempo por rua e o traçado do caminho.
 *   linha-reta  — heurística do vizinho mais próximo sobre distância em linha
 *                 reta. Não sabe o que é rua. É o plano B do plano B.
 *
 * A queda é em cascata: tomtom → google → osrm → linha reta. Cada degrau avisa
 * na tela em que degrau parou, porque o motorista precisa saber se pode confiar
 * na ordem antes de sair.
 *
 * Se o OSRM falhar — rede fora, serviço fora do ar, tempo esgotado —, a rota
 * cai sozinha para a linha reta e devolve um aviso. Entrega atrasada é ruim;
 * motorista parado esperando uma tela carregar é pior.
 */

export type ParadaEntrada = Ponto & { id: number }

export type ParadaOrdenada = ParadaEntrada & {
  ordem: number
  /** Distância desde a parada anterior (ou da Central, na primeira). */
  distanciaKm: number
  /** Tempo de condução desde a parada anterior. */
  minutos: number
}

export type RotaCalculada = {
  provedor: 'tomtom' | 'google' | 'osrm' | 'linha-reta'
  paradas: ParadaOrdenada[]
  distanciaTotalKm: number
  minutosTotal: number
  /** Traçado do caminho em [latitude, longitude], para desenhar no mapa. */
  geometria: Array<[number, number]>
  aviso: string | null
}

const TEMPO_LIMITE_MS = 6000

type RespostaOsrm = {
  code: string
  message?: string
  trips?: Array<{
    distance: number
    duration: number
    geometry?: { coordinates?: Array<[number, number]> }
    legs?: Array<{ distance: number; duration: number }>
  }>
  waypoints?: Array<{ waypoint_index: number; trips_index: number }>
}

async function pelaRua(paradas: ParadaEntrada[], origem: Ponto): Promise<RotaCalculada> {
  // O OSRM fala em longitude,latitude — nesta ordem.
  const pontos = [origem, ...paradas].map((p) => `${p.longitude},${p.latitude}`).join(';')
  const parametros = new URLSearchParams({
    source: 'first', // sai sempre da Central
    roundtrip: 'true', // e volta para ela no fim
    geometries: 'geojson',
    overview: 'full',
  })

  const resposta = await fetch(`${env.OSRM_URL}/trip/v1/driving/${pontos}?${parametros}`, {
    headers: { 'User-Agent': env.CONTATO_APP },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  })

  if (!resposta.ok) throw new Error(`OSRM respondeu ${resposta.status}`)

  const dados = (await resposta.json()) as RespostaOsrm
  if (dados.code !== 'Ok' || !dados.trips?.[0] || !dados.waypoints) {
    throw new Error(`OSRM não traçou a rota: ${dados.message ?? dados.code}`)
  }

  const viagem = dados.trips[0]
  const trechos = viagem.legs ?? []

  // waypoints[0] é a Central; waypoints[i+1] corresponde a paradas[i].
  // waypoint_index diz a posição de cada ponto na viagem otimizada.
  const ordenadas: ParadaOrdenada[] = paradas.map((parada, i) => {
    const posicao = dados.waypoints![i + 1]?.waypoint_index ?? i + 1
    const trecho = trechos[posicao - 1]
    return {
      ...parada,
      ordem: posicao,
      distanciaKm: Number(((trecho?.distance ?? 0) / 1000).toFixed(2)),
      minutos: Math.round((trecho?.duration ?? 0) / 60),
    }
  })

  ordenadas.sort((a, b) => a.ordem - b.ordem)
  // Reordena os números para 1, 2, 3… mesmo se o OSRM pular algum índice.
  ordenadas.forEach((parada, i) => {
    parada.ordem = i + 1
  })

  return {
    provedor: 'osrm',
    paradas: ordenadas,
    distanciaTotalKm: Number((viagem.distance / 1000).toFixed(1)),
    minutosTotal: Math.round(viagem.duration / 60),
    // GeoJSON também vem em longitude,latitude — invertemos para o mapa.
    geometria: (viagem.geometry?.coordinates ?? []).map(([lon, lat]) => [lat, lon] as [number, number]),
    aviso: null,
  }
}

function emLinhaReta(paradas: ParadaEntrada[], origem: Ponto, aviso: string | null): RotaCalculada {
  const ordenadas = ordenarPorVizinhoMaisProximo(paradas, origem)

  const total = ordenadas.reduce((soma, p) => soma + p.distanciaKm, 0)
  const ultima = ordenadas[ordenadas.length - 1]
  const volta = ultima ? distanciaKm(ultima, origem) : 0

  return {
    provedor: 'linha-reta',
    paradas: ordenadas.map((p) => ({
      ...p,
      // Linha reta vira rua com um fator de desvio, a 22 km/h de trânsito
      // urbano: km × 1,35 ÷ 22 × 60 minutos ≈ km × 3,7.
      minutos: Math.round(p.distanciaKm * 3.7),
    })),
    distanciaTotalKm: Number((total + volta).toFixed(1)),
    minutosTotal: estimarMinutos(total + volta, ordenadas.length),
    geometria: [origem, ...ordenadas, origem].map((p) => [p.latitude, p.longitude] as [number, number]),
    aviso,
  }
}

export async function calcularRota(
  paradas: ParadaEntrada[],
  origem: Ponto,
): Promise<RotaCalculada> {
  if (paradas.length === 0) {
    return {
      provedor: env.ROTA_PROVEDOR,
      paradas: [],
      distanciaTotalKm: 0,
      minutosTotal: 0,
      geometria: [],
      aviso: null,
    }
  }

  if (env.ROTA_PROVEDOR === 'linha-reta') return emLinhaReta(paradas, origem, null)

  // Mesmas paradas pendentes, rota recente: não gasta chamada.
  const jaCalculada = rotaGuardada(paradas, origem)
  if (jaCalculada) return jaCalculada

  const quedas: string[] = []

  // ── Degrau 1: TomTom, com trânsito ───────────────────────────
  if (env.ROTA_PROVEDOR === 'tomtom') {
    if (!tomtomConfigurado()) {
      quedas.push('a chave da TomTom não está configurada')
    } else {
      try {
        const rota = await rotaDoDiaComTransito(paradas, origem)
        guardarRota(paradas, origem, rota)
        return rota
      } catch (erro) {
        quedas.push(`TomTom: ${erro instanceof Error ? erro.message : 'falhou'}`)
      }
    }
  }

  // ── Degrau 2: Google, com trânsito ───────────────────────────
  if (env.ROTA_PROVEDOR === 'google') {
    if (!googleConfigurado()) {
      quedas.push('a chave do Google não está configurada')
    } else {
      try {
        const rota = await pelaRuaComTransito(paradas, origem)
        guardarRota(paradas, origem, rota)
        return rota
      } catch (erro) {
        quedas.push(`Google: ${erro instanceof Error ? erro.message : 'falhou'}`)
      }
    }
  }

  // ── Degrau 3: OSRM, pelas ruas mas sem trânsito ──────────────
  try {
    const rota = await pelaRua(paradas, origem)
    const comAviso = quedas.length
      ? {
          ...rota,
          aviso: `Rota sem trânsito (${quedas.join('; ')}). A ordem veio das ruas, mas ignora congestionamento.`,
        }
      : rota
    guardarRota(paradas, origem, comAviso)
    return comAviso
  } catch (erro) {
    quedas.push(`OSRM: ${erro instanceof Error ? erro.message : 'falhou'}`)
  }

  // ── Degrau 4: linha reta ─────────────────────────────────────
  return emLinhaReta(
    paradas,
    origem,
    `Nenhum serviço de rotas respondeu (${quedas.join('; ')}). ` +
      'A ordem abaixo foi calculada em linha reta — confira antes de sair.',
  )
}
