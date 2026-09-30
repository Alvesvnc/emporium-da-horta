import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../banco/conexao.js'
import { ArquivoInvalido, salvarFoto, TAMANHO_MAXIMO_BYTES } from '../../comum/arquivos.js'
import { exigirPapel } from '../../comum/autenticacao.js'
import { paraCentavos } from '../../comum/dinheiro.js'

/** Painel do dono: o catálogo de produtos. */

// Os valores são os do banco: "maco" sem cedilha, porque valor de enum é
// código, não texto de tela. A tela mostra "maço".
const UNIDADES = ['kg', 'un', 'maco', 'bandeja', 'cartela'] as const

const novoProduto = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do produto.').max(120),
  preco: z.union([z.string(), z.number()]),
  unidade: z.enum(UNIDADES).default('kg'),
  categoria: z.string().trim().min(1, 'Escolha uma categoria.'),
  emoji: z.string().trim().max(8).default('🥦'),
  oferta: z.boolean().default(false),
})

const alteracao = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  preco: z.union([z.string(), z.number()]).optional(),
  unidade: z.enum(UNIDADES).optional(),
  categoria: z.string().trim().min(1).optional(),
  emoji: z.string().trim().max(8).optional(),
  oferta: z.boolean().optional(),
  oculto: z.boolean().optional(),
})

const porId = z.object({ id: z.coerce.number().int().positive() })

export async function endpointsCatalogo(app: FastifyInstance) {
  const soDono = { preHandler: exigirPapel('dono') }

  /** Lista tudo, inclusive o que está oculto da loja. */
  app.get('/api/admin/produtos', soDono, async () => {
    const [produtos, categorias] = await Promise.all([
      prisma.produto.findMany({
        orderBy: { nome: 'asc' },
        include: { categoria: { select: { nome: true } } },
      }),
      prisma.categoria.findMany({ orderBy: { ordem: 'asc' } }),
    ])

    return {
      produtos: produtos.map(({ categoria, ...p }) => ({ ...p, categoria: categoria.nome })),
      categorias,
    }
  })

  app.post('/api/admin/produtos', soDono, async (req, reply) => {
    const analise = novoProduto.safeParse(req.body)
    if (!analise.success) {
      return reply.code(400).send({ erro: analise.error.issues[0]?.message ?? 'Dados inválidos.' })
    }

    const precoCentavos = paraCentavos(analise.data.preco)
    if (precoCentavos === null || precoCentavos <= 0) {
      return reply.code(400).send({ erro: 'Informe um preço válido.', campo: 'preco' })
    }

    const categoria = await prisma.categoria.findUnique({ where: { nome: analise.data.categoria } })
    if (!categoria) {
      return reply.code(400).send({ erro: 'Categoria não encontrada.', campo: 'categoria' })
    }

    const criado = await prisma.produto.create({
      data: {
        nome: analise.data.nome,
        emoji: analise.data.emoji || '🥦',
        precoCentavos,
        unidade: analise.data.unidade,
        categoriaId: categoria.id,
        oferta: analise.data.oferta,
      },
    })

    return reply.code(201).send({ produto: criado })
  })

  /**
   * Muda preço, nome, visibilidade… Ocultar NUNCA apaga: o produto some da
   * loja mas continua no painel e nos pedidos que já foram feitos com ele.
   */
  app.patch('/api/admin/produtos/:id', soDono, async (req, reply) => {
    const params = porId.safeParse(req.params)
    if (!params.success) return reply.code(400).send({ erro: 'Produto inválido.' })

    const analise = alteracao.safeParse(req.body)
    if (!analise.success) {
      return reply.code(400).send({ erro: analise.error.issues[0]?.message ?? 'Dados inválidos.' })
    }

    const { nome, preco, unidade, categoria, emoji, oferta, oculto } = analise.data
    // `atualizadoEm` é @updatedAt no schema: o Prisma preenche sozinho.
    const mudancas: Record<string, unknown> = {}

    if (nome !== undefined) mudancas.nome = nome
    if (unidade !== undefined) mudancas.unidade = unidade
    if (emoji !== undefined) mudancas.emoji = emoji
    if (oferta !== undefined) mudancas.oferta = oferta
    if (oculto !== undefined) mudancas.oculto = oculto

    if (preco !== undefined) {
      const centavos = paraCentavos(preco)
      if (centavos === null || centavos <= 0) {
        return reply.code(400).send({ erro: 'Informe um preço válido.', campo: 'preco' })
      }
      mudancas.precoCentavos = centavos
    }

    if (categoria !== undefined) {
      const cat = await prisma.categoria.findUnique({ where: { nome: categoria } })
      if (!cat) return reply.code(400).send({ erro: 'Categoria não encontrada.', campo: 'categoria' })
      mudancas.categoriaId = cat.id
    }

    const atualizado = await prisma.produto.update({
      where: { id: params.data.id },
      data: mudancas,
    })

    return { produto: atualizado }
  })

  /** Envio da foto do produto (multipart, um arquivo). */
  app.post('/api/admin/produtos/:id/foto', soDono, async (req, reply) => {
    const params = porId.safeParse(req.params)
    if (!params.success) return reply.code(400).send({ erro: 'Produto inválido.' })

    const produto = await prisma.produto.findUnique({ where: { id: params.data.id } })
    if (!produto) return reply.code(404).send({ erro: 'Produto não encontrado.' })

    const arquivo = await req.file({ limits: { fileSize: TAMANHO_MAXIMO_BYTES } })
    if (!arquivo) return reply.code(400).send({ erro: 'Nenhuma foto foi enviada.' })

    try {
      const conteudo = await arquivo.toBuffer()
      const salva = await salvarFoto(conteudo, arquivo.filename, arquivo.mimetype)

      const atualizado = await prisma.produto.update({
        where: { id: produto.id },
        data: { fotoUrl: salva.url },
      })

      return { produto: atualizado }
    } catch (erro) {
      if (erro instanceof ArquivoInvalido) return reply.code(400).send({ erro: erro.message })
      req.log.error({ erro }, 'falha ao salvar foto')
      return reply.code(500).send({ erro: 'Não consegui salvar a foto. Tente de novo.' })
    }
  })
}
