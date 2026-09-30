import { prisma } from '../banco/conexao.js'
import type { PrecisaoLocal } from '../banco/gerado/enums.js'
import { env } from '../config/ambiente.js'

/**
 * Transforma um endereço escrito por gente em latitude/longitude.
 *
 * Não existe lista de bairros no código. Tudo que este módulo sabe sobre
 * lugares vem de serviço externo; o banco guarda só o que já foi perguntado,
 * como cache. A ordem é:
 *
 *   cache → endereço completo no mapa → só o bairro no mapa → nada
 *
 * Cada degrau que desce perde precisão, e o resultado diz em qual degrau
 * parou, porque o motorista precisa saber se o pino é a casa ou o bairro.
 */

export type Precisao = PrecisaoLocal

export type Localizacao = {
  latitude: number | null
  longitude: number | null
  precisao: Precisao
  rotulo: string | null
}

export type EnderecoBusca = {
  rua: string
  numero: string
  bairro: string
  /** O CEP é o melhor confirmador que existe — ver `respostaConfere`. */
  cep?: string
  cidade?: string
  estado?: string
}

/** Só os oito dígitos: "69074-700" e "69074700" viram a mesma coisa. */
function digitosDoCep(cep: string | undefined): string {
  return (cep ?? '').replace(/\D/g, '').slice(0, 8)
}

const CIDADE_PADRAO = 'Manaus'
const ESTADO_PADRAO = 'Amazonas'
const TEMPO_LIMITE_MS = 2500

const NADA: Localizacao = {
  latitude: null,
  longitude: null,
  precisao: 'desconhecida',
  rotulo: null,
}

/** Chave de cache: o mesmo endereço escrito de jeitos diferentes vira uma coisa só. */
function normalizar(partes: Array<string | undefined>): string {
  return partes
    .map((parte) => (parte ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(', ')
}

/**
 * A política de uso do Nominatim pede no máximo uma consulta por segundo.
 * Este portão serializa as chamadas e garante o intervalo — respeitar isso é
 * o que mantém o serviço gratuito disponível para todo mundo.
 */
let ultimaConsulta = 0
let fila: Promise<unknown> = Promise.resolve()

function noRitmoPermitido<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const espera = Math.max(0, 1100 - (Date.now() - ultimaConsulta))
    if (espera > 0) await new Promise((r) => setTimeout(r, espera))
    ultimaConsulta = Date.now()
    return tarefa()
  })
  // A fila nunca guarda rejeição, senão uma falha travaria todas as próximas.
  fila = proxima.catch(() => undefined)
  return proxima
}

type EnderecoNominatim = {
  road?: string
  suburb?: string
  neighbourhood?: string
  city_district?: string
  quarter?: string
  city?: string
  town?: string
  municipality?: string
}

type AchadoNominatim = {
  lat: string
  lon: string
  display_name?: string
  address?: EnderecoNominatim
}

type RespostaNominatim = AchadoNominatim[]

/** Sem acento, sem pontuação, sem espaço duplo: para comparar texto de gente. */
function simplificar(texto: string | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(new RegExp('\\p{Diacritic}', 'gu'), '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Como o Nominatim chama o bairro varia conforme o lugar: `suburb`,
 * `neighbourhood`, `city_district` ou `quarter`. Tentamos todos.
 */
function bairroDoAchado(achado: AchadoNominatim): string {
  const a = achado.address
  return simplificar(a?.suburb || a?.neighbourhood || a?.city_district || a?.quarter)
}

/**
 * A resposta confere com a pergunta?
 *
 * Esta é a trava que faltava. Os serviços de mapa casam nomes por aproximação
 * e, sem ninguém conferir, "Rua José Antunes, Morro da Liberdade" voltava como
 * "Beco José Virgílio Antunes, Centro" — outra rua, outro bairro, a
 * quilômetros — e era gravado como `exata`, ou seja, com o sistema mandando o
 * motorista confiar de olhos fechados.
 *
 * A ordem dos juízes importa:
 *
 *  1. o CEP, quando os dois lados o têm. É o mais forte: identifica um trecho
 *     de rua, não uma região inteira, e não depende de nomenclatura;
 *  2. o bairro, como segunda opinião.
 *
 * O bairro sozinho não basta como juiz final porque os Correios e os mapas
 * discordam com frequência: a Rua Ayres de Almeida é "São Francisco" no CEP e
 * "Raiz" nos dois serviços de mapa. Recusar por causa disso jogaria fora um
 * acerto.
 */
function respostaConfere(
  achado: { cep?: string; bairro?: string; rotulo?: string },
  pedido: { cep?: string; bairro: string },
): boolean {
  const cepPedido = digitosDoCep(pedido.cep)
  const cepAchado = digitosDoCep(achado.cep)
  if (cepPedido && cepAchado) return cepPedido === cepAchado

  const bairroPedido = simplificar(pedido.bairro)
  if (!bairroPedido) return false

  const bairroAchado = simplificar(achado.bairro)
  if (bairroAchado) {
    // Um contém o outro cobre "Nossa Senhora das Graças" x "Graças".
    return (
      bairroAchado === bairroPedido ||
      bairroAchado.includes(bairroPedido) ||
      bairroPedido.includes(bairroAchado)
    )
  }

  // Sem bairro estruturado, sobra o texto do endereço inteiro.
  return simplificar(achado.rotulo).includes(bairroPedido)
}

/** Uma consulta ao Nominatim. Devolve null quando não acha; lança quando falha. */
async function consultarMapa(parametros: URLSearchParams): Promise<RespostaNominatim[number] | null> {
  parametros.set('format', 'jsonv2')
  parametros.set('limit', '1')
  parametros.set('addressdetails', '1')

  const resposta = await fetch(`${env.NOMINATIM_URL}/search?${parametros}`, {
    headers: { 'User-Agent': env.CONTATO_APP, 'Accept-Language': 'pt-BR' },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  })

  if (!resposta.ok) throw new Error(`Nominatim respondeu ${resposta.status}`)

  const dados = (await resposta.json()) as RespostaNominatim
  return dados[0] ?? null
}

function comoLocalizacao(
  achado: RespostaNominatim[number] | null,
  precisao: Precisao,
): Localizacao | null {
  if (!achado) return null

  const latitude = Number(achado.lat)
  const longitude = Number(achado.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude, precisao, rotulo: achado.display_name ?? null }
}

/**
 * Consulta com cache. `chave` identifica a pergunta; `perguntar` só é chamada
 * quando ela ainda não foi feita.
 *
 * Só grava resposta do serviço — inclusive "não achei", que é resposta. Falha
 * de rede não vira cache, senão um minuto de internet ruim envenenaria o
 * endereço para sempre.
 */
async function comCache(
  chave: string,
  perguntar: () => Promise<Localizacao | null>,
): Promise<Localizacao | null> {
  const emCache = await prisma.enderecoGeocodificado.findUnique({ where: { chave } })
  if (emCache) {
    return {
      latitude: emCache.latitude,
      longitude: emCache.longitude,
      precisao: emCache.precisao,
      rotulo: emCache.rotuloEncontrado,
    }
  }

  let resultado: Localizacao | null
  try {
    resultado = await noRitmoPermitido(perguntar)
  } catch {
    return null // rede fora: tenta de novo na próxima, sem gravar nada
  }

  await prisma.enderecoGeocodificado.upsert({
    where: { chave },
    update: {},
    create: {
      chave,
      latitude: resultado?.latitude ?? null,
      longitude: resultado?.longitude ?? null,
      precisao: resultado?.precisao ?? 'desconhecida',
      rotuloEncontrado: resultado?.rotulo ?? null,
    },
  })

  return resultado
}

type AchadoTomTom = {
  type?: string
  position?: { lat?: number; lon?: number }
  address?: {
    streetName?: string
    municipalitySubdivision?: string
    postalCode?: string
    extendedPostalCode?: string
    freeformAddress?: string
  }
}

/**
 * Procura o endereço na TomTom.
 *
 * É o primeiro degrau porque a cobertura de rua brasileira dela é muito melhor
 * que a do OpenStreetMap. Nenhuma das ruas que testamos em Manaus — José
 * Antunes, Ayres de Almeida — existe no OSM; na TomTom, existem com CEP.
 *
 * Usa a mesma chave e a mesma cota gratuita do cálculo de rota. Geocodificar
 * acontece uma vez por endereço e o resultado fica em cache, então o consumo é
 * desprezível.
 */
async function consultarTomTom(
  endereco: EnderecoBusca,
  cidade: string,
  estado: string,
): Promise<Localizacao | null> {
  if (!env.TOMTOM_API_KEY) return null

  const texto = [endereco.rua.trim(), endereco.numero.trim(), endereco.bairro.trim(), cidade, estado]
    .filter(Boolean)
    .join(', ')

  const parametros = new URLSearchParams({
    key: env.TOMTOM_API_KEY,
    limit: '5',
    countrySet: 'BR',
  })

  const resposta = await fetch(
    `${env.TOMTOM_URL}/search/2/geocode/${encodeURIComponent(texto)}.json?${parametros}`,
    { headers: { 'User-Agent': env.CONTATO_APP }, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) },
  )
  if (!resposta.ok) throw new Error(`TomTom respondeu ${resposta.status}`)

  const dados = (await resposta.json()) as { results?: AchadoTomTom[] }

  /**
   * Percorre os candidatos e fica no primeiro que CONFERE.
   *
   * Pedir cinco e escolher com critério, em vez de pedir um e aceitar, é o que
   * evita o caso "Rua São Francisco de Assis": buscando por um endereço no
   * bairro São Francisco, o primeiro resultado foi uma rua com esse nome em
   * outro bairro. O segundo candidato era o certo.
   */
  for (const achado of dados.results ?? []) {
    const lat = achado.position?.lat
    const lon = achado.position?.lon
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const confere = respostaConfere(
      {
        cep: achado.address?.extendedPostalCode ?? achado.address?.postalCode,
        bairro: achado.address?.municipalitySubdivision,
        rotulo: achado.address?.freeformAddress,
      },
      { cep: endereco.cep, bairro: endereco.bairro },
    )
    if (!confere) continue

    return {
      latitude: lat as number,
      longitude: lon as number,
      // "Point Address" é a casa. "Street" e "Address Range" acertam a rua mas
      // não o número — honesto chamar de aproximado, e assim a navegação usa o
      // endereço escrito, que o aplicativo de mapas resolve melhor.
      precisao: achado.type === 'Point Address' ? 'exata' : 'aproximada',
      rotulo: achado.address?.freeformAddress ?? null,
    }
  }

  return null
}

export async function localizar(endereco: EnderecoBusca): Promise<Localizacao> {
  // 'nenhum' desliga tudo e manda todo pedido para o centro do bairro.
  if (env.GEO_PROVEDOR === 'nenhum') return NADA

  const cidade = endereco.cidade ?? CIDADE_PADRAO
  const estado = endereco.estado ?? ESTADO_PADRAO
  const bairro = endereco.bairro.trim()

  // ── 1. A casa: TomTom primeiro, OpenStreetMap depois ────────
  //
  // Os dois passam pela mesma conferência. Resposta que não bate com o CEP nem
  // com o bairro é descartada: melhor cair para o centro do bairro, que é
  // honestamente aproximado, do que apontar uma rua errada dizendo que é exata.
  if (endereco.rua.trim() && bairro) {
    const chave = normalizar([endereco.rua, endereco.numero, bairro, cidade, estado])

    const daCasa = await comCache(chave, async () => {
      try {
        const pelaTomTom = await consultarTomTom(endereco, cidade, estado)
        if (pelaTomTom) return pelaTomTom
      } catch {
        // Cota, chave ou rede: tenta o degrau de baixo em vez de desistir.
      }

      const achado = await consultarMapa(
        new URLSearchParams({
          q: [endereco.rua.trim(), endereco.numero.trim(), bairro, cidade, estado, 'Brasil']
            .filter(Boolean)
            .join(', '),
        }),
      )
      if (
        !achado ||
        !respostaConfere(
          { bairro: bairroDoAchado(achado), rotulo: achado.display_name },
          { cep: endereco.cep, bairro },
        )
      ) {
        return null
      }
      return comoLocalizacao(achado, 'exata')
    })

    if (daCasa?.latitude != null) return daCasa
  }

  // ── 2. Só o bairro ──────────────────────────────────────────
  // O CEP preenche o bairro oficial dos Correios, então este degrau costuma
  // acertar mesmo quando a rua não existe em mapa nenhum. Fica em cache por
  // bairro: o segundo pedido do mesmo bairro não consulta nada.
  if (bairro) {
    const chave = `bairro: ${normalizar([bairro, cidade, estado])}`
    const doBairro = await comCache(chave, async () => {
      const achado = await consultarMapa(
        new URLSearchParams({ q: `${bairro}, ${cidade}, ${estado}, Brasil` }),
      )
      // Aqui a pergunta é o próprio bairro. Compara só por nome: CEP de bairro
      // inteiro não existe, e o do pedido apontaria para uma rua específica.
      if (!achado || !respostaConfere({ bairro: bairroDoAchado(achado), rotulo: achado.display_name }, { bairro })) {
        return null
      }
      return comoLocalizacao(achado, 'aproximada')
    })

    if (doBairro?.latitude != null) return doBairro
  }

  // ── 3. Nada. A parada aparece na lista, fora do mapa. ───────
  return NADA
}
