/**
 * Uma porta de entrada só para falar com a API. Toda chamada passa por aqui,
 * então o token de login e o tratamento de erro ficam num lugar só.
 */

/**
 * Só existe uma sessão: a da equipe — dono ou motorista.
 *
 * Cliente não tem conta nesta loja: compra informando nome, telefone e
 * endereço, e acompanha o pedido pelo número mais o telefone. Nada disso
 * precisa de token.
 */
export type TipoSessao = 'equipe'

const CHAVES: Record<TipoSessao, string> = {
  equipe: 'emporium.token.equipe',
}

export class ErroApi extends Error {
  readonly status: number
  readonly campo?: string
  readonly dados: Record<string, unknown>

  constructor(mensagem: string, status: number, dados: Record<string, unknown> = {}) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.campo = typeof dados.campo === 'string' ? dados.campo : undefined
    this.dados = dados
  }
}

export function lerToken(tipo: TipoSessao): string | null {
  try {
    return localStorage.getItem(CHAVES[tipo])
  } catch {
    return null
  }
}

export function guardarToken(tipo: TipoSessao, token: string | null): void {
  try {
    if (token) localStorage.setItem(CHAVES[tipo], token)
    else localStorage.removeItem(CHAVES[tipo])
  } catch {
    /* navegador com armazenamento bloqueado: segue sem lembrar do login */
  }
}

/**
 * Qual token mandar depende do endereço. É uma regra só, num lugar só, para
 * nenhuma tela precisar lembrar de escolher.
 */
function sessaoDoCaminho(caminho: string): TipoSessao | null {
  if (caminho.startsWith('/api/admin') || caminho.startsWith('/api/rota')) return 'equipe'
  if (caminho.startsWith('/api/auth')) return 'equipe'
  // Todo o resto é da loja aberta: fechar pedido e acompanhar pedido não
  // exigem token nenhum.
  return null
}

type Opcoes = {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  corpo?: unknown
  arquivo?: FormData
  /** Força uma sessão específica; por padrão vem do caminho. */
  sessao?: TipoSessao | null
}

export async function chamar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const cabecalhos: Record<string, string> = {}
  const tipoSessao = opcoes.sessao === undefined ? sessaoDoCaminho(caminho) : opcoes.sessao
  const token = tipoSessao ? lerToken(tipoSessao) : null
  if (token) cabecalhos.Authorization = `Bearer ${token}`

  let corpo: BodyInit | undefined
  if (opcoes.arquivo) {
    corpo = opcoes.arquivo // o navegador põe o Content-Type com o boundary certo
  } else if (opcoes.corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json'
    corpo = JSON.stringify(opcoes.corpo)
  }

  let resposta: Response
  try {
    resposta = await fetch(caminho, {
      method: opcoes.metodo ?? (corpo ? 'POST' : 'GET'),
      headers: cabecalhos,
      body: corpo,
    })
  } catch {
    // Sem status: o pedido nem chegou a sair. Quem trata offline reconhece o
    // zero e põe a ação na fila em vez de mostrar erro.
    //
    // O texto fala de internet, e não de "a API não está rodando", porque quem
    // mais vê esta frase é o motorista no meio da rua. Para quem desenvolve, o
    // console já conta a história inteira.
    throw new ErroApi('Sem conexão com o servidor. Verifique a internet e tente de novo.', 0)
  }

  if (resposta.status === 204) return undefined as T

  const texto = await resposta.text()
  const dados = texto ? (JSON.parse(texto) as Record<string, unknown>) : {}

  if (!resposta.ok) {
    // Token vencido ou inválido: some com ele para a tela pedir login de novo.
    if (resposta.status === 401 && tipoSessao) guardarToken(tipoSessao, null)
    throw new ErroApi(
      typeof dados.erro === 'string' ? dados.erro : 'Não consegui completar a operação.',
      resposta.status,
      dados,
    )
  }

  return dados as T
}
