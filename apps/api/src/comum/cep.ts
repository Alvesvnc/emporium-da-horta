import { env } from '../config/ambiente.js'

/**
 * Consulta de CEP na [BrasilAPI](https://brasilapi.com.br).
 *
 * Serve a dois propósitos diferentes:
 *
 *  1. preencher bairro e rua no checkout, para o cliente digitar menos;
 *  2. dar uma coordenada melhor que o centro do bairro quando o endereço
 *     completo não é encontrado no mapa.
 *
 * A BrasilAPI é gratuita e não pede chave. Ela consulta vários provedores
 * (Correios, ViaCEP, WideNet) e devolve o primeiro que responder — por isso é
 * mais confiável que qualquer um deles sozinho.
 */

const TEMPO_LIMITE_MS = 4000

export type EnderecoDeCep = {
  cep: string
  estado: string
  cidade: string
  bairro: string
  rua: string
  /** Nem todo CEP tem coordenada; quando tem, é do logradouro, não da casa. */
  latitude: number | null
  longitude: number | null
}

/** Só os dígitos. "69050-010" e "69050010" viram a mesma coisa. */
export function normalizarCep(cep: string): string {
  return cep.replace(/\D/g, '')
}

export function cepValido(cep: string): boolean {
  return /^\d{8}$/.test(normalizarCep(cep))
}

type RespostaBrasilApi = {
  cep: string
  state: string
  city: string
  neighborhood: string
  street: string
  location?: {
    coordinates?: { longitude?: string | number; latitude?: string | number }
  }
}

const comoNumero = (valor: string | number | undefined): number | null => {
  if (valor === undefined) return null
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : null
}

/**
 * Devolve o endereço do CEP, ou null quando não existe ou o serviço não
 * responde. Nunca lança: quem chama trata "não achei" como caso normal —
 * a pessoa continua podendo digitar o endereço à mão.
 */
export async function buscarCep(cepBruto: string): Promise<EnderecoDeCep | null> {
  const cep = normalizarCep(cepBruto)
  if (!cepValido(cep)) return null

  try {
    // v2 é igual à v1 mais a coordenada do logradouro.
    const resposta = await fetch(`${env.BRASILAPI_URL}/api/cep/v2/${cep}`, {
      headers: { 'User-Agent': env.CONTATO_APP, Accept: 'application/json' },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })

    // 404 é resposta legítima: CEP não existe na base.
    if (!resposta.ok) return null

    const dados = (await resposta.json()) as RespostaBrasilApi
    if (!dados?.cep) return null

    return {
      cep: dados.cep,
      estado: dados.state ?? '',
      cidade: dados.city ?? '',
      bairro: dados.neighborhood ?? '',
      rua: dados.street ?? '',
      latitude: comoNumero(dados.location?.coordinates?.latitude),
      longitude: comoNumero(dados.location?.coordinates?.longitude),
    }
  } catch {
    // Rede fora, tempo esgotado, serviço fora do ar. O checkout segue à mão.
    return null
  }
}
