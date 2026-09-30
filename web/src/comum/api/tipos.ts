import type { Unidade } from '../formato/unidades'

/**
 * O formato do que a API devolve. Um lugar só para conferir com o back:
 * mudou lá, muda aqui e o TypeScript aponta todas as telas afetadas.
 */

export type Configuracoes = {
  id: number
  pedidoMinimoCentavos: number
  taxaEntregaCentavos: number
  entregaGratisAcimaCentavos: number
  metaSemanalCentavos: number
  horaLimitePedido: number
  janelaEntrega: string

  /** A sede, de onde o motorista sai. Sem coordenada, a rota usa um ponto provisório. */
  centralNome: string
  centralCep: string | null
  centralRua: string | null
  centralNumero: string | null
  centralBairro: string | null
  centralLatitude: number | null
  centralLongitude: number | null
}

export type IconeManobra =
  | 'partida'
  | 'esquerda'
  | 'direita'
  | 'leve-esquerda'
  | 'leve-direita'
  | 'reto'
  | 'retorno'
  | 'rotatoria'
  | 'saida'
  | 'chegada'

/** Uma curva do caminho, com a frase já pronta para ler e falar. */
export type Manobra = {
  instrucao: string
  via: string | null
  icone: IconeManobra
  /** Comprimento deste trecho, do início dele até a manobra seguinte. */
  metros: number
  segundos: number
  latitude: number
  longitude: number
}

export type RotaNavegavel = {
  manobras: Manobra[]
  /** Traçado completo em [latitude, longitude]. */
  geometria: Array<[number, number]>
  metrosTotal: number
  segundosTotal: number
}

export type RespostaNavegacao = {
  navegacao: RotaNavegavel
  /** Destino achado só pelo bairro leva até perto, não até o portão. */
  precisaoDestino: 'exata' | 'aproximada' | 'desconhecida'
}

/**
 * Onde um motorista estava da última vez que o aparelho dele contou.
 *
 * `vistoEm` nunca vem sem a coordenada e vice-versa: mostrar posição sem dizer
 * de quando ela é seria apresentar um ponto velho como se fosse o agora.
 */
export type MotoristaNoMapa = {
  id: number
  nome: string
  latitude: number | null
  longitude: number | null
  precisaoMetros: number | null
  vistoEm: string | null
}

/** Onde a geocodificação achou um endereço, e com que confiança. */
export type Localizacao = {
  latitude: number | null
  longitude: number | null
  precisao: 'exata' | 'aproximada' | 'desconhecida'
  rotulo: string | null
}

export type Categoria = { id: number; nome: string; ordem: number }

export type Produto = {
  id: number
  nome: string
  emoji: string
  fotoUrl: string | null
  precoCentavos: number
  unidade: Unidade
  categoriaId: number
  categoria?: string | null
  oferta: boolean
  oculto?: boolean
}

export type RespostaLoja = {
  configuracoes: Configuracoes | null
  categorias: Categoria[]
  produtos: Produto[]
}

export type Sessao = {
  tipo: 'equipe'
  id: number
  nome: string
  email: string
  papel: 'dono' | 'motorista'
}


export type ItemPedido = {
  id: number
  /**
   * Redundante quando o item vem dentro de um pedido — que é sempre. Fica
   * declarado porque a API manda, e tipo que esconde campo é como o
   * `entregues` ficou errado por semanas sem ninguém notar.
   */
  pedidoId: number
  /** Null quando o produto foi apagado do catálogo depois do pedido. */
  produtoId: number | null
  nomeProduto: string
  emojiProduto: string
  precoUnitarioCentavos: number
  unidade: string
  quantidade: number
  subtotalCentavos: number
}

export type Metricas = {
  resumo: {
    vendasSemanaCentavos: number
    variacaoVendasPercentual: number | null
    pedidosHoje: number
    variacaoPedidosDia: number
    ticketMedioCentavos: number
    variacaoTicketPercentual: number | null
    entregasConcluidasPercentual: number | null
    metaSemanalCentavos: number
  }
  semanas: Array<{
    inicio: string
    rotulo: string
    totalCentavos: number
    pedidos: number
    ehSemanaAtual: boolean
    bateuMeta: boolean
  }>
  maisVendidos: Array<{
    produtoId: number | null
    nome: string
    emoji: string
    unidade: string
    unidadesVendidas: number
    receitaCentavos: number
  }>
  porDia: Array<{ dia: string; ehHoje: boolean; pedidos: number; totalCentavos: number }>
  entregas: {
    total: number
    entregues: number
    emRota: number
    aguardando: number
    naoEntregues: number
    /** Trocos a separar antes de o motorista sair. */
    trocos: Array<{
      numero: number
      cliente: string
      bairro: string
      totalCentavos: number
      pagaComCentavos: number
      trocoCentavos: number
    }>
    tempoMedioMinutos: number | null
    lista: Array<{
      id: number
      numero: number
      cliente: string
      bairro: string
      status: string
      criadoEm: string
      entregueEm: string | null
      totalCentavos: number
      /** Preenchidos quando o motorista registrou uma tentativa frustrada. */
      motivoNaoEntrega: MotivoNaoEntrega | null
      observacaoEntrega: string | null
      tentadoEm: string | null
    }>
  }
}

export type Precisao = 'exata' | 'aproximada' | 'desconhecida'

export type MotivoNaoEntrega = 'ausente' | 'endereco_nao_encontrado' | 'recusado' | 'outro'

/** O que já se tentou nesta parada. Null = primeira ida. */
export type TentativaAnterior = {
  motivo: MotivoNaoEntrega | null
  observacao: string | null
  em: string | null
}

export type Parada = {
  pedidoId: number
  numero: number
  ordem: number
  cliente: string
  telefone: string
  endereco: string
  complemento: string | null
  bairro: string
  latitude: number
  longitude: number
  precisao: Precisao
  distanciaKm: number
  minutos: number
  status: 'recebido' | 'em_rota' | 'entregue' | 'nao_entregue'
  formaPagamento: string
  totalCentavos: number
  agendadoPara: string | null
  linkNavegacao: string
  criadoEm: string
  /** Com quanto o cliente vai pagar, e quanto de troco levar. Null fora do dinheiro. */
  pagaComCentavos: number | null
  trocoCentavos: number | null
  tentativaAnterior: TentativaAnterior | null
  itens: ItemPedido[]
}

export type ParadaSemLocal = Omit<
  Parada,
  'ordem' | 'latitude' | 'longitude' | 'precisao' | 'distanciaKm' | 'minutos' | 'agendadoPara'
>

export type RespostaRota = {
  /** `configurada: false` = ainda é o ponto provisório, não a sede real. */
  central: { nome: string; latitude: number; longitude: number; configurada: boolean }
  provedor: 'tomtom' | 'google' | 'osrm' | 'linha-reta'
  aviso: string | null
  /** Traçado do caminho em [latitude, longitude]. */
  geometria: Array<[number, number]>
  paradas: Parada[]
  semLocalizacao: ParadaSemLocal[]
  entregues: Array<{
    pedidoId: number
    numero: number
    cliente: string
    bairro: string
    entregueEm: string | null
    totalCentavos: number
  }>
  /** Link do Google Maps com o próximo trecho (o celular só aceita 4 paradas). */
  linkProximoTrecho: string | null
  paradasNoLink: number
  resumo: {
    total: number
    restantes: number
    distanciaKm: number
    minutosEstimados: number
    semLocalizacao: number
    aproximadas: number
    /** Quantas vêm arrastadas de dias anteriores por não terem sido entregues. */
    retentativas: number
  }
}

export type PedidoDoCliente = {
  id: number
  numero: number
  status: 'recebido' | 'em_separacao' | 'em_rota' | 'entregue' | 'nao_entregue' | 'cancelado'
  criadoEm: string
  entregueEm: string | null
  agendadoPara: string | null
  bairro: string
  rua: string
  numeroEndereco: string
  complemento: string | null
  formaPagamento: 'pix' | 'cartao' | 'dinheiro'
  subtotalCentavos: number
  freteCentavos: number
  totalCentavos: number
  itens: ItemPedido[]
}

/** O que a consulta de CEP devolve (BrasilAPI, via nossa API). */
export type EnderecoDeCep = {
  cep: string
  estado: string
  cidade: string
  bairro: string
  rua: string
  latitude: number | null
  longitude: number | null
}
