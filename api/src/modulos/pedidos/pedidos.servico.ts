import { ID_CONFIGURACAO, prisma } from '../../banco/conexao.js'
import type { Configuracoes, Pedido } from '../../banco/gerado/client.js'
import type { UnidadeVenda } from '../../banco/gerado/enums.js'
import { formatarBRL, paraCentavos } from '../../comum/dinheiro.js'
import { localizar } from '../../comum/enderecos.js'
import type { NovoPedido } from './pedidos.esquemas.js'

/**
 * As regras de fechar um pedido, longe de qualquer detalhe de HTTP.
 *
 * A regra que sustenta o resto: preço, frete e total são calculados AQUI, a
 * partir do preço que está no banco agora. O navegador manda apenas quais
 * produtos e quantas unidades — um cliente que adulterasse o preço na tela
 * não mudaria o que é cobrado.
 */

/** Recusa com o texto pronto para a tela e o campo que precisa de atenção. */
export type Recusa = {
  status: number
  erro: string
  campo?: string
  produtoId?: number
}

export type ItemCalculado = {
  produtoId: number
  nomeProduto: string
  emojiProduto: string
  precoUnitarioCentavos: number
  unidade: UnidadeVenda
  quantidade: number
  subtotalCentavos: number
}

export type Conta = {
  config: Configuracoes
  itens: ItemCalculado[]
  subtotalCentavos: number
  freteCentavos: number
  totalCentavos: number
  agendadoPara: Date | null
  /** Com quanto o cliente vai pagar. Null em Pix, cartão, ou valor exato. */
  pagaComCentavos: number | null
}

type Resultado<T> = { ok: true; valor: T } | { ok: false; recusa: Recusa }

const recusar = (status: number, erro: string, extra: Partial<Recusa> = {}): Resultado<never> => ({
  ok: false,
  recusa: { status, erro, ...extra },
})

/**
 * Confere o carrinho contra o catálogo e fecha a conta.
 *
 * A ordem das checagens é a mesma em que os campos aparecem na tela, para o
 * erro apontar sempre para o primeiro problema que a pessoa vê.
 */
export async function conferirPedido(dados: NovoPedido): Promise<Resultado<Conta>> {
  // ── 1. Carrinho ────────────────────────────────────────────
  if (dados.itens.length === 0) {
    return recusar(400, 'Seu carrinho está vazio.', { campo: 'itens' })
  }

  const config = await prisma.configuracoes.findUnique({ where: { id: ID_CONFIGURACAO } })
  if (!config) return recusar(500, 'A loja ainda não foi configurada.')

  const ids = [...new Set(dados.itens.map((i) => i.produtoId))]
  const encontrados = await prisma.produto.findMany({ where: { id: { in: ids } } })
  const porId = new Map(encontrados.map((p) => [p.id, p]))

  const indisponivel = dados.itens.find((i) => {
    const p = porId.get(i.produtoId)
    return !p || p.oculto
  })
  if (indisponivel) {
    const p = porId.get(indisponivel.produtoId)
    return recusar(
      409,
      p
        ? `"${p.nome}" saiu do catálogo enquanto você comprava. Remova o item para continuar.`
        : 'Um dos produtos do carrinho não existe mais. Atualize a página.',
      { campo: 'itens', produtoId: indisponivel.produtoId },
    )
  }

  // Junta quantidades repetidas do mesmo produto num item só.
  const agrupado = new Map<number, number>()
  for (const item of dados.itens) {
    agrupado.set(item.produtoId, (agrupado.get(item.produtoId) ?? 0) + item.quantidade)
  }

  const itens: ItemCalculado[] = [...agrupado.entries()].map(([produtoId, quantidade]) => {
    const p = porId.get(produtoId)!
    return {
      produtoId,
      nomeProduto: p.nome,
      emojiProduto: p.emoji,
      precoUnitarioCentavos: p.precoCentavos,
      unidade: p.unidade,
      quantidade,
      subtotalCentavos: p.precoCentavos * quantidade,
    }
  })

  const subtotalCentavos = itens.reduce((soma, i) => soma + i.subtotalCentavos, 0)

  // ── 2. Pedido mínimo ───────────────────────────────────────
  if (subtotalCentavos < config.pedidoMinimoCentavos) {
    const faltam = config.pedidoMinimoCentavos - subtotalCentavos
    return recusar(
      400,
      `O pedido mínimo é ${formatarBRL(config.pedidoMinimoCentavos)}. Faltam ${formatarBRL(faltam)}.`,
      { campo: 'itens' },
    )
  }

  // ── 3 a 8. Contato e endereço, na ordem em que aparecem na tela ──
  const obrigatorios: Array<[valor: string, campo: string, mensagem: string]> = [
    [dados.contato.nome, 'nome', 'Informe seu nome completo.'],
    [dados.contato.telefone, 'telefone', 'Informe seu telefone.'],
    [dados.endereco.cep, 'cep', 'Informe o CEP.'],
    [dados.endereco.bairro, 'bairro', 'Informe o bairro.'],
    [dados.endereco.rua, 'rua', 'Informe a rua.'],
    [dados.endereco.numero, 'numero', 'Informe o número da residência.'],
  ]
  for (const [valor, campo, mensagem] of obrigatorios) {
    if (!valor.trim()) return recusar(400, mensagem, { campo })
  }

  const freteCentavos =
    subtotalCentavos >= config.entregaGratisAcimaCentavos ? 0 : config.taxaEntregaCentavos

  // Agendamento opcional: sem data, a entrega cai na janela padrão da loja.
  let agendadoPara: Date | null = null
  if (dados.agendamento?.data) {
    const hora = dados.agendamento.hora ?? '15:00'
    const quando = new Date(`${dados.agendamento.data}T${hora}:00`)
    if (Number.isNaN(quando.getTime())) {
      return recusar(400, 'Data ou hora de entrega inválida.', { campo: 'agendamento' })
    }
    agendadoPara = quando
  }

  const totalCentavos = subtotalCentavos + freteCentavos

  /**
   * ── 9. Troco ───────────────────────────────────────────────
   *
   * Conferido contra o total que ACABAMOS de calcular, nunca contra o que o
   * navegador mandou. Vale a mesma regra do resto do checkout: o preço é do
   * servidor, e o cliente só escolhe produto e quantidade.
   */
  // Campo em branco é resposta legítima: quer dizer "levo o valor certo".
  const informouComQuantoPaga =
    dados.formaPagamento === 'dinheiro' &&
    dados.pagaCom !== undefined &&
    dados.pagaCom !== null &&
    String(dados.pagaCom).trim() !== ''

  let pagaComCentavos: number | null = null
  if (informouComQuantoPaga) {
    const valor = paraCentavos(dados.pagaCom)
    if (valor === null) {
      return recusar(400, 'Valor em dinheiro inválido.', { campo: 'pagaCom' })
    }
    if (valor < totalCentavos) {
      return recusar(
        400,
        `Com ${formatarBRL(valor)} não fecha: o pedido deu ${formatarBRL(totalCentavos)}.`,
        { campo: 'pagaCom' },
      )
    }
    pagaComCentavos = valor
  }

  return {
    ok: true,
    valor: {
      config,
      itens,
      subtotalCentavos,
      freteCentavos,
      totalCentavos,
      agendadoPara,
      pagaComCentavos,
    },
  }
}

/** Grava o pedido e seus itens. */
export async function registrarPedido(dados: NovoPedido, conta: Conta): Promise<Pedido> {
  // Onde fica isso no mapa. Procura o endereço completo; se não achar, cai
  // para o centro do bairro. `precisao` registra qual dos dois aconteceu,
  // porque o motorista precisa saber se o pino é a casa ou o bairro inteiro.
  const local = await localizar({
    rua: dados.endereco.rua,
    numero: dados.endereco.numero,
    bairro: dados.endereco.bairro,
    // O CEP é o que confirma que a rua encontrada é a rua pedida.
    cep: dados.endereco.cep,
  })

  /**
   * Não há transação nem conta de cliente.
   *
   * O pedido e seus itens nascem juntos num `create` só — o Prisma já faz isso
   * de forma atômica — e o `numero` vem da sequência do banco, que começa em
   * 1000. O cliente não é cadastrado em lugar nenhum: nome, telefone e endereço
   * ficam gravados no próprio pedido, que é onde eles importam.
   */
  return prisma.pedido.create({
    data: {
      nomeContato: dados.contato.nome.trim(),
      telefoneContato: dados.contato.telefone.trim(),
      cep: dados.endereco.cep.trim(),
      bairro: dados.endereco.bairro.trim(),
      rua: dados.endereco.rua.trim(),
      numeroEndereco: dados.endereco.numero.trim(),
      complemento: dados.endereco.complemento?.trim() || null,
      latitude: local.latitude,
      longitude: local.longitude,
      precisaoLocal: local.precisao,
      formaPagamento: dados.formaPagamento,
      pagaComCentavos: conta.pagaComCentavos,
      agendadoPara: conta.agendadoPara,
      subtotalCentavos: conta.subtotalCentavos,
      freteCentavos: conta.freteCentavos,
      totalCentavos: conta.totalCentavos,
      status: 'recebido',
      itens: { create: conta.itens },
    },
  })
}

/** Frase que o cliente lê na confirmação. */
export function descreverPrevisao(conta: Conta): string {
  if (!conta.agendadoPara) return `Previsão de entrega: ${conta.config.janelaEntrega}.`

  const dia = conta.agendadoPara.toLocaleDateString('pt-BR')
  const hora = conta.agendadoPara.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `Entrega agendada: ${dia} às ${hora}`
}
