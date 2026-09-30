import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ID_CONFIGURACAO, prisma } from '../../banco/conexao.js'

/** Rotas abertas: é o que a vitrine da loja precisa, sem login. */
export async function endpointsLoja(app: FastifyInstance) {
  /**
   * Tudo que a loja precisa para abrir, numa chamada só: as regras da loja,
   * as categorias e os produtos à venda. Produtos ocultos não saem daqui.
   */
  app.get('/api/loja', async () => {
    const [configuracoes, categorias, produtos] = await Promise.all([
      prisma.configuracoes.findUnique({ where: { id: ID_CONFIGURACAO } }),
      prisma.categoria.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] }),
      prisma.produto.findMany({
        where: { oculto: false },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          emoji: true,
          fotoUrl: true,
          precoCentavos: true,
          unidade: true,
          categoriaId: true,
          oferta: true,
          // A vitrine mostra o nome da categoria; vem junto na mesma consulta.
          categoria: { select: { nome: true } },
        },
      }),
    ])

    return {
      configuracoes,
      categorias,
      produtos: produtos.map(({ categoria, ...p }) => ({ ...p, categoria: categoria.nome })),
    }
  })

  /** Busca e filtro por categoria, para quando a lista crescer. */
  const filtros = z.object({
    busca: z.string().trim().max(80).optional(),
    categoria: z.string().trim().max(40).optional(),
  })

  app.get('/api/produtos', async (req, reply) => {
    const analise = filtros.safeParse(req.query)
    if (!analise.success) return reply.code(400).send({ erro: 'Filtros inválidos.' })
    const { busca, categoria } = analise.data

    const produtos = await prisma.produto.findMany({
      where: {
        oculto: false,
        ...(categoria === 'Ofertas' ? { oferta: true } : {}),
        ...(categoria && categoria !== 'Todos' && categoria !== 'Ofertas'
          ? { categoria: { nome: categoria } }
          : {}),
        ...(busca ? { nome: { contains: busca, mode: 'insensitive' } } : {}),
      },
      orderBy: { nome: 'asc' },
    })

    return { produtos }
  })
}
