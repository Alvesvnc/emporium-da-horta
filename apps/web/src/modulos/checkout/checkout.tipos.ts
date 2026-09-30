import type { Produto } from '@emporium/shared'

/** Tudo que a pessoa preenche para fechar o pedido, em um objeto só. */
export type DadosCheckout = {
  nome: string
  telefone: string
  cep: string
  bairro: string
  rua: string
  numero: string
  complemento: string
  pagamento: 'pix' | 'cartao' | 'dinheiro'
  /** Com quanto vai pagar, em reais, quando escolhe dinheiro. Vazio = valor exato. */
  pagaCom: string
  data: string
  hora: string
}

export const DADOS_VAZIOS: DadosCheckout = {
  nome: '',
  telefone: '',
  cep: '',
  bairro: '',
  rua: '',
  numero: '',
  complemento: '',
  pagamento: 'pix',
  pagaCom: '',
  data: '',
  hora: '',
}

export type ItemDoCarrinho = { produto: Produto; quantidade: number }

export type Confirmacao = {
  numero: number
  totalCentavos: number
  previsao: string
}
