import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ID_CONFIGURACAO, prisma } from '../../banco/conexao.js'
import { exigirPapel } from '../../comum/autenticacao.js'
import { paraCentavos } from '../../comum/dinheiro.js'
import { localizar } from '../../comum/enderecos.js'
import { esquecerRotas } from '../../comum/entrega/cache-rota.js'

/** Painel do dono: as regras da loja (pedido mínimo, frete, meta) e a sede. */

const ajuste = z.object({
  pedidoMinimo: z.union([z.string(), z.number()]).optional(),
  taxaEntrega: z.union([z.string(), z.number()]).optional(),
  entregaGratisAcima: z.union([z.string(), z.number()]).optional(),
  metaSemanal: z.union([z.string(), z.number()]).optional(),
  horaLimitePedido: z.coerce.number().int().min(0).max(23).optional(),
  janelaEntrega: z.string().trim().min(3).max(120).optional(),

  // ── A sede, de onde o motorista sai ──────────────────────
  centralNome: z.string().trim().min(2).max(80).optional(),
  centralCep: z.string().trim().max(12).optional(),
  centralRua: z.string().trim().max(160).optional(),
  centralNumero: z.string().trim().max(20).optional(),
  centralBairro: z.string().trim().max(80).optional(),
  centralLatitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  centralLongitude: z.coerce.number().min(-180).max(180).nullable().optional(),
})

/** Campos de texto da sede que vão direto para o banco, sem conversão. */
const TEXTO_CENTRAL = [
  'centralNome',
  'centralCep',
  'centralRua',
  'centralNumero',
  'centralBairro',
] as const

/** Campos que chegam em reais e são guardados em centavos. */
const EM_CENTAVOS = [
  ['pedidoMinimo', 'pedidoMinimoCentavos', 'pedido mínimo'],
  ['taxaEntrega', 'taxaEntregaCentavos', 'taxa de entrega'],
  ['entregaGratisAcima', 'entregaGratisAcimaCentavos', 'valor da entrega grátis'],
  ['metaSemanal', 'metaSemanalCentavos', 'meta semanal'],
] as const

export async function endpointsConfiguracoes(app: FastifyInstance) {
  const soDono = { preHandler: exigirPapel('dono') }

  app.get('/api/admin/configuracoes', soDono, async () => {
    const config = await prisma.configuracoes.findUnique({ where: { id: ID_CONFIGURACAO } })
    return { configuracoes: config }
  })

  app.put('/api/admin/configuracoes', soDono, async (req, reply) => {
    const analise = ajuste.safeParse(req.body)
    if (!analise.success) {
      return reply.code(400).send({ erro: analise.error.issues[0]?.message ?? 'Dados inválidos.' })
    }

    // `atualizadoEm` é @updatedAt no schema: o Prisma preenche sozinho.
    const mudancas: Record<string, unknown> = {}

    for (const [chave, coluna, rotulo] of EM_CENTAVOS) {
      const bruto = analise.data[chave]
      if (bruto === undefined) continue
      const centavos = paraCentavos(bruto)
      if (centavos === null) {
        return reply.code(400).send({ erro: `Valor inválido para ${rotulo}.`, campo: chave })
      }
      mudancas[coluna] = centavos
    }

    if (analise.data.horaLimitePedido !== undefined) {
      mudancas.horaLimitePedido = analise.data.horaLimitePedido
    }
    if (analise.data.janelaEntrega !== undefined) {
      mudancas.janelaEntrega = analise.data.janelaEntrega
    }

    for (const campo of TEXTO_CENTRAL) {
      if (analise.data[campo] !== undefined) mudancas[campo] = analise.data[campo]
    }

    // Latitude sem longitude não é lugar nenhum. O banco também recusa
    // (configuracoes_central_par_completo), mas quem está preenchendo a tela
    // merece um recado em português em vez de um erro de constraint.
    const { centralLatitude: lat, centralLongitude: lon } = analise.data
    if ((lat === undefined) !== (lon === undefined)) {
      return reply.code(400).send({ erro: 'Informe latitude e longitude juntas.' })
    }
    if (lat !== undefined && lon !== undefined) {
      if ((lat === null) !== (lon === null)) {
        return reply.code(400).send({ erro: 'Informe latitude e longitude juntas.' })
      }
      mudancas.centralLatitude = lat
      mudancas.centralLongitude = lon
    }

    const atualizado = await prisma.configuracoes.update({
      where: { id: ID_CONFIGURACAO },
      data: mudancas,
    })

    // Mudou a sede? A rota guardada saiu do lugar antigo e não vale mais.
    if (mudancas.centralLatitude !== undefined) esquecerRotas()

    return { configuracoes: atualizado }
  })

  /**
   * Converte o endereço da sede em coordenada, para o dono ver o pino antes de
   * salvar. Não grava nada: quem grava é o PUT acima, com o ponto que ficou na
   * tela — inclusive se o dono arrastou o pino para corrigir.
   *
   * Arrastar importa. A geocodificação em Manaus erra com frequência, e a sede
   * errada estraga o cálculo de todas as entregas do dia.
   */
  app.post('/api/admin/central/localizar', soDono, async (req, reply) => {
    const busca = z.object({
      rua: z.string().trim().max(160).default(''),
      numero: z.string().trim().max(20).default(''),
      bairro: z.string().trim().max(80).default(''),
      cep: z.string().trim().max(12).optional(),
    })

    const analise = busca.safeParse(req.body)
    if (!analise.success) return reply.code(400).send({ erro: 'Endereço inválido.' })

    const { rua, bairro } = analise.data
    if (!rua && !bairro) {
      return reply.code(400).send({ erro: 'Informe pelo menos a rua ou o bairro.' })
    }

    return { localizacao: await localizar(analise.data) }
  })
}
