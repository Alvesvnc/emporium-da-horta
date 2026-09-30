import { env } from '../../config/ambiente.js'
import type { Ponto } from './geografia.js'
import { acaoDoTomTom, redigir, type Manobra } from './manobras.js'
import type { ParadaEntrada, RotaCalculada } from './roteador.js'
import type { RotaNavegavel } from './navegacao.js'

/**
 * Rota e navegação pela Routing API da TomTom, com trânsito.
 *
 * É o provedor que resolve os dois buracos que sobravam: sabe de
 * congestionamento (o OSRM calcula com velocidade fixa de via) e é um serviço
 * contratado, não o servidor público de demonstração do OSRM.
 *
 * Faz as três coisas numa API só:
 *   • ordem das paradas otimizada (`computeBestOrder`)
 *   • trânsito em tempo real (`traffic=true`)
 *   • instruções curva a curva (`instructionsType=coded`)
 *
 * CUSTO: plano gratuito, sem cartão, uso comercial permitido. A cota é de
 * milhares de chamadas por dia; esta operação usa cerca de cem. Mesmo assim as
 * respostas ficam em cache — cota gratuita não é motivo para desperdício, e a
 * TomTom já anunciou revisão de preços.
 *
 * Se a cota estourar ou o serviço cair, o erro sobe e a cascata desce para o
 * OSRM sozinha. É de propósito: a tela do motorista não pode parar.
 */

const TEMPO_LIMITE_MS = 8000

export function tomtomConfigurado(): boolean {
  return Boolean(env.TOMTOM_API_KEY)
}

type InstrucaoTomTom = {
  routeOffsetInMeters?: number
  travelTimeInSeconds?: number
  point?: { latitude: number; longitude: number }
  maneuver?: string
  street?: string
  roundaboutExitNumber?: number
}

type RespostaTomTom = {
  routes?: Array<{
    summary?: {
      lengthInMeters?: number
      travelTimeInSeconds?: number
      trafficDelayInSeconds?: number
    }
    legs?: Array<{
      summary?: { lengthInMeters?: number; travelTimeInSeconds?: number }
      points?: Array<{ latitude: number; longitude: number }>
    }>
    guidance?: { instructions?: InstrucaoTomTom[] }
  }>
  optimizedWaypoints?: Array<{ providedIndex: number; optimizedIndex: number }>
  detailedError?: { message?: string; description?: string }
  error?: { description?: string }
}

/** Monta a URL. As paradas vão no caminho, separadas por dois-pontos. */
function endereco(pontos: Ponto[], parametros: Record<string, string>): string {
  const lugares = pontos.map((p) => `${p.latitude},${p.longitude}`).join(':')
  const busca = new URLSearchParams({ key: env.TOMTOM_API_KEY, ...parametros })
  return `${env.TOMTOM_URL}/routing/1/calculateRoute/${lugares}/json?${busca}`
}

async function pedir(url: string): Promise<RespostaTomTom> {
  const resposta = await fetch(url, {
    headers: { 'User-Agent': env.CONTATO_APP },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  })

  const dados = (await resposta.json().catch(() => ({}))) as RespostaTomTom

  if (!resposta.ok) {
    const motivo =
      dados.detailedError?.message ??
      dados.detailedError?.description ??
      dados.error?.description ??
      `respondeu ${resposta.status}`
    // 403 costuma ser chave errada; 429 é cota estourada. Os dois viram queda
    // para o OSRM lá na cascata, com aviso na tela do motorista.
    throw new Error(`TomTom ${motivo}`)
  }

  return dados
}

type TrechoTomTom = {
  summary?: { lengthInMeters?: number; travelTimeInSeconds?: number }
  points?: Array<{ latitude: number; longitude: number }>
}

/** Junta os pontos de todos os trechos num traçado só, em [latitude, longitude]. */
function tracadoDe(trechos: TrechoTomTom[] | undefined): Array<[number, number]> {
  return (trechos ?? []).flatMap((trecho) =>
    (trecho.points ?? []).map((p) => [p.latitude, p.longitude] as [number, number]),
  )
}

// ── A rota do dia, com a ordem otimizada ─────────────────────

export async function rotaDoDiaComTransito(
  paradas: ParadaEntrada[],
  origem: Ponto,
): Promise<RotaCalculada> {
  if (!env.TOMTOM_API_KEY) throw new Error('TOMTOM_API_KEY não configurada')

  // Sai da central, passa pelas paradas, volta para a central: o motorista
  // termina o dia onde começou.
  const pontos = [origem, ...paradas, origem]

  const dados = await pedir(
    endereco(pontos, {
      traffic: 'true',
      // Reordena as paradas do meio. A primeira e a última são fixas — são a
      // central — e o TomTom respeita isso.
      computeBestOrder: 'true',
      routeType: 'fastest',
      travelMode: 'car',
      language: 'pt-BR',
    }),
  )

  const rota = dados.routes?.[0]
  if (!rota) throw new Error('TomTom não devolveu rota')

  /**
   * `optimizedWaypoints[i] = { providedIndex, optimizedIndex }` diz que a
   * parada que enviamos na posição `providedIndex` ficou em `optimizedIndex`
   * na ordem boa. Os índices contam só as paradas do meio, sem as duas
   * centrais — que é exatamente como `paradas` está indexado.
   */
  const posicaoDe = new Map<number, number>()
  for (const w of dados.optimizedWaypoints ?? []) posicaoDe.set(w.providedIndex, w.optimizedIndex)

  const trechos = rota.legs ?? []

  const ordenadas = paradas
    .map((parada, i) => {
      const posicao = posicaoDe.get(i) ?? i
      // legs[0] é central → primeira parada; legs[posicao] chega na parada.
      const trecho = trechos[posicao]
      return {
        ...parada,
        ordem: posicao + 1,
        distanciaKm: Number(((trecho?.summary?.lengthInMeters ?? 0) / 1000).toFixed(2)),
        minutos: Math.round((trecho?.summary?.travelTimeInSeconds ?? 0) / 60),
      }
    })
    .sort((a, b) => a.ordem - b.ordem)

  const atraso = rota.summary?.trafficDelayInSeconds ?? 0

  return {
    provedor: 'tomtom',
    paradas: ordenadas,
    distanciaTotalKm: Number(((rota.summary?.lengthInMeters ?? 0) / 1000).toFixed(1)),
    minutosTotal: Math.round((rota.summary?.travelTimeInSeconds ?? 0) / 60),
    geometria: tracadoDe(trechos),
    // Trânsito não é só número: saber que 12 dos 40 minutos são
    // engarrafamento muda o que o motorista faz com a informação.
    aviso:
      atraso >= 300
        ? `Trânsito pesado agora: ${Math.round(atraso / 60)} min a mais no total do dia.`
        : null,
  }
}

// ── Navegação curva a curva até uma parada ───────────────────

export async function navegarComTransito(de: Ponto, ate: Ponto): Promise<RotaNavegavel> {
  if (!env.TOMTOM_API_KEY) throw new Error('TOMTOM_API_KEY não configurada')

  const dados = await pedir(
    endereco([de, ate], {
      traffic: 'true',
      routeType: 'fastest',
      travelMode: 'car',
      // `coded` traz a manobra sem a frase pronta. A frase é nossa: assim a
      // voz não muda de estilo quando a rota cai para o OSRM.
      instructionsType: 'coded',
      language: 'pt-BR',
    }),
  )

  const rota = dados.routes?.[0]
  if (!rota) throw new Error('TomTom não devolveu caminho')

  const instrucoes = rota.guidance?.instructions ?? []
  const metrosTotal = rota.summary?.lengthInMeters ?? 0
  const segundosTotal = rota.summary?.travelTimeInSeconds ?? 0

  /**
   * O TomTom marca cada instrução pela distância desde a partida
   * (`routeOffsetInMeters`), enquanto a tela precisa saber o COMPRIMENTO de
   * cada trecho. A diferença entre uma instrução e a seguinte é esse
   * comprimento — e a última vai até o fim da rota.
   */
  const manobras: Manobra[] = instrucoes.map((instrucao, i) => {
    const seguinte = instrucoes[i + 1]
    const daqui = instrucao.routeOffsetInMeters ?? 0
    const ateAli = seguinte?.routeOffsetInMeters ?? metrosTotal

    const via = instrucao.street?.trim() || null
    const { instrucao: texto, icone } = redigir(
      acaoDoTomTom(instrucao.maneuver ?? '', instrucao.roundaboutExitNumber),
      via,
      i === instrucoes.length - 1,
    )

    return {
      instrucao: texto,
      via,
      icone,
      metros: Math.max(0, Math.round(ateAli - daqui)),
      segundos: Math.max(
        0,
        Math.round((seguinte?.travelTimeInSeconds ?? segundosTotal) - (instrucao.travelTimeInSeconds ?? 0)),
      ),
      latitude: instrucao.point?.latitude ?? ate.latitude,
      longitude: instrucao.point?.longitude ?? ate.longitude,
    }
  })

  return {
    manobras,
    geometria: tracadoDe(rota.legs ?? []),
    metrosTotal: Math.round(metrosTotal),
    segundosTotal: Math.round(segundosTotal),
  }
}
