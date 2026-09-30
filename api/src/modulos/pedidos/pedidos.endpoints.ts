import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../banco/conexao.js'
import { exigirPapel } from '../../comum/autenticacao.js'
import { esquecerRotas } from '../../comum/entrega/cache-rota.js'
import { consultaDePedido, corpoNovoPedido } from './pedidos.esquemas.js'
import { conferirPedido, descreverPrevisao, registrarPedido } from './pedidos.servico.js'

/** Camada HTTP dos pedidos: lê a requisição, chama o serviço, responde. */
export async function endpointsPedidos(app: FastifyInstance) {
  app.post('/api/pedidos', async (req, reply) => {
    const analise = corpoNovoPedido.safeParse(req.body)
    if (!analise.success) {
      return reply.code(400).send({ erro: analise.error.issues[0]?.message ?? 'Pedido inválido.' })
    }
    const dados = analise.data


    const conferido = await conferirPedido(dados)
    if (!conferido.ok) {
      const { status, ...corpo } = conferido.recusa
      return reply.code(status).send(corpo)
    }

    const conta = conferido.valor
    const pedido = await registrarPedido(dados, conta)

    req.log.info({ pedido: pedido.numero, total: conta.totalCentavos }, 'pedido criado')

    return reply.code(201).send({
      pedido: {
        numero: pedido.numero,
        subtotalCentavos: conta.subtotalCentavos,
        freteCentavos: conta.freteCentavos,
        totalCentavos: conta.totalCentavos,
        status: pedido.status,
        criadoEm: pedido.criadoEm,
      },
      previsao: descreverPrevisao(conta),
    })
  })

  /**
   * Acompanhar um pedido. Pede o telefone junto com o número para que ninguém
   * leia o pedido dos outros só chutando números sequenciais.
   */
  app.get('/api/pedidos/:numero', async (req, reply) => {
    const params = consultaDePedido.params.safeParse(req.params)
    const query = consultaDePedido.query.safeParse(req.query)

    if (!params.success) return reply.code(400).send({ erro: 'Número de pedido inválido.' })
    if (!query.success) return reply.code(400).send({ erro: 'Informe o telefone usado no pedido.' })

    const pedido = await prisma.pedido.findUnique({
      where: { numero: params.data.numero },
      include: { itens: true },
    })

    const soDigitos = (t: string) => t.replace(/\D/g, '')
    if (!pedido || soDigitos(pedido.telefoneContato) !== soDigitos(query.data.telefone)) {
      return reply.code(404).send({ erro: 'Pedido não encontrado com esse número e telefone.' })
    }

    const { itens, ...dadosDoPedido } = pedido
    return { pedido: dadosDoPedido, itens }
  })

  /**
   * Cancelar um pedido. Só o dono.
   *
   * É a única saída para o pedido que não vai mais acontecer — cliente
   * desistiu, endereço não existe, mercadoria voltou. Sem isto, um pedido
   * marcado como "não entregue" volta para a rota do motorista todos os dias,
   * para sempre, e ninguém consegue encerrar.
   *
   * Cancelar não apaga: o pedido continua no banco com todo o histórico, e
   * some das telas de operação e do faturamento. Apagar seria perder a única
   * prova de que aquela venda existiu.
   */
  app.patch('/api/admin/pedidos/:id/cancelar', { preHandler: exigirPapel('dono') }, async (req, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params)
    if (!params.success) return reply.code(400).send({ erro: 'Pedido inválido.' })

    // Entregue não se cancela: a mercadoria saiu e o cliente recebeu. Mudar
    // isso seria reescrever o faturamento de um dia já fechado.
    const { count } = await prisma.pedido.updateMany({
      where: { id: params.data.id, status: { notIn: ['entregue', 'cancelado'] } },
      data: { status: 'cancelado' },
    })

    if (count === 0) {
      return reply.code(409).send({
        erro: 'Só dá para cancelar pedido que ainda não foi entregue.',
      })
    }

    // Uma parada a menos muda a rota do dia.
    esquecerRotas()

    return { cancelado: true }
  })
}
