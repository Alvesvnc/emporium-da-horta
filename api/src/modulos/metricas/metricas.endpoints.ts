import type { FastifyInstance } from 'fastify'
import { ID_CONFIGURACAO, prisma } from '../../banco/conexao.js'
import { Prisma } from '../../banco/gerado/client.js'
import { exigirPapel } from '../../comum/autenticacao.js'
import { FUSO } from '../../config/ambiente.js'

/**
 * Números do painel do dono. Tudo sai dos pedidos que estão no banco — não há
 * valor fixo no código. Loja parada devolve zeros, e isso é o correto.
 *
 * As agregações são SQL cru. O Prisma agrupa por coluna, mas não por
 * `date_trunc(...)`, que é o que precisamos aqui — e nem tentamos disfarçar:
 * SQL legível é melhor que uma torre de helpers para chegar no mesmo lugar.
 */

/**
 * Meia-noite no fuso da loja. Funciona porque config/ambiente.ts fixa o fuso
 * do processo antes de qualquer data existir — então "local" aqui é sempre
 * Manaus, mesmo num servidor em UTC.
 */
const inicioDoDia = (data: Date) =>
  new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0)

const somandoDias = (data: Date, dias: number) => {
  const nova = new Date(data)
  nova.setDate(nova.getDate() + dias)
  return nova
}

/** Segunda-feira da semana da data, para casar com o date_trunc('week') do Postgres. */
const inicioDaSemana = (data: Date) => {
  const base = inicioDoDia(data)
  const diaDaSemana = (base.getDay() + 6) % 7 // 0 = segunda
  return somandoDias(base, -diaDaSemana)
}

/**
 * "AAAA-MM-DD" no fuso da loja. Usar toISOString() aqui seria errado: ele
 * converte para UTC e, dependendo da hora, devolve o dia vizinho.
 */
const comoDataLocal = (data: Date): string => {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

const variacao = (atual: number, anterior: number): number | null => {
  if (anterior === 0) return null
  return Number((((atual - anterior) / anterior) * 100).toFixed(1))
}

/**
 * O fuso como literal SQL.
 *
 * `criado_em` é timestamptz: convertido para o fuso da loja ANTES de truncar,
 * o agrupamento cai no dia certo. Sem isso, o corte do dia seguiria o fuso da
 * conexão (UTC em quase toda hospedagem) e os pedidos da noite entrariam no
 * dia seguinte.
 *
 * Vai como literal e não como parâmetro porque a mesma expressão aparece no
 * SELECT e no GROUP BY — com dois parâmetros diferentes, o Postgres não
 * reconhece que são iguais e recusa a consulta. Não há risco de injeção: o
 * valor vem do .env e o ambiente recusa subir se não for um fuso IANA.
 */
const local = Prisma.raw(`("criado_em" at time zone '${FUSO.replace(/'/g, "''")}')`)

// Linhas cruas do banco: sempre conferir o tipo com o SELECT lá embaixo.
type LinhaSemana = { inicio: string; numero_semana: number; total: number; pedidos: number }
type LinhaDia = { dia: string; pedidos: number; total: number }
type LinhaProduto = {
  produto_id: number | null
  nome: string
  emoji: string
  unidade: string
  unidades: number
  receita: number
}
type LinhaSoma = { total: number; pedidos: number }

export async function endpointsMetricas(app: FastifyInstance) {
  app.get('/api/admin/metricas', { preHandler: exigirPapel('dono') }, async () => {
    const agora = new Date()
    const hoje = inicioDoDia(agora)
    const ontem = somandoDias(hoje, -1)
    const semanaAtual = inicioDaSemana(agora)
    const semanaAnterior = somandoDias(semanaAtual, -7)
    const oitoSemanasAtras = somandoDias(semanaAtual, -49)
    const seteDiasAtras = somandoDias(hoje, -6)

    const config = await prisma.configuracoes.findUnique({ where: { id: ID_CONFIGURACAO } })
    const meta = config?.metaSemanalCentavos ?? 0

    const [semanas, maisVendidos, porDiaBruto, somaSemanaAtual, somaSemanaAnterior, pedidosOntem] =
      await Promise.all([
        // ── Vendas por semana (8 semanas) ──────────────────────
        prisma.$queryRaw<LinhaSemana[]>`
          select to_char(date_trunc('week', ${local}), 'YYYY-MM-DD') as inicio,
                 extract(week from date_trunc('week', ${local}))::int as numero_semana,
                 coalesce(sum("total_centavos"), 0)::int as total,
                 count(*)::int as pedidos
            from "pedidos"
           where "status" <> 'cancelado' and "criado_em" >= ${oitoSemanasAtras}
           group by date_trunc('week', ${local})
           order by date_trunc('week', ${local})`,

        // ── Mais vendidos (últimos 7 dias) ─────────────────────
        prisma.$queryRaw<LinhaProduto[]>`
          select i."produto_id",
                 i."nome_produto"  as nome,
                 i."emoji_produto" as emoji,
                 i."unidade"::text as unidade,
                 sum(i."quantidade")::int as unidades,
                 sum(i."subtotal_centavos")::int as receita
            from "itens_pedido" i
            join "pedidos" p on p."id" = i."pedido_id"
           where p."status" <> 'cancelado' and p."criado_em" >= ${seteDiasAtras}
           group by i."produto_id", i."nome_produto", i."emoji_produto", i."unidade"
           order by unidades desc`,

        // ── Pedidos por dia (últimos 7 dias) ───────────────────
        prisma.$queryRaw<LinhaDia[]>`
          select to_char(date_trunc('day', ${local}), 'YYYY-MM-DD') as dia,
                 count(*)::int as pedidos,
                 coalesce(sum("total_centavos"), 0)::int as total
            from "pedidos"
           where "status" <> 'cancelado' and "criado_em" >= ${seteDiasAtras}
           group by date_trunc('day', ${local})
           order by date_trunc('day', ${local})`,

        // ── Somas do resumo ────────────────────────────────────
        prisma.$queryRaw<LinhaSoma[]>`
          select coalesce(sum("total_centavos"), 0)::int as total, count(*)::int as pedidos
            from "pedidos"
           where "status" <> 'cancelado' and "criado_em" >= ${semanaAtual}`,

        prisma.$queryRaw<LinhaSoma[]>`
          select coalesce(sum("total_centavos"), 0)::int as total, count(*)::int as pedidos
            from "pedidos"
           where "status" <> 'cancelado'
             and "criado_em" >= ${semanaAnterior} and "criado_em" < ${semanaAtual}`,

        prisma.pedido.count({
          where: { status: { not: 'cancelado' }, criadoEm: { gte: ontem, lt: hoje } },
        }),
      ])

    // ── Entregas de hoje ─────────────────────────────────────
    const entregasHoje = await prisma.pedido.findMany({
      where: {
        status: { not: 'cancelado' },
        OR: [
          { criadoEm: { gte: hoje } },
          /**
           * E TUDO que ainda não foi entregue, de qualquer data.
           *
           * Precisa ser o mesmo critério da rota do motorista. Se o painel
           * escondesse o que a rota mostra, o dono não teria como cancelar
           * justamente o pedido que está incomodando o motorista todo dia.
           */
          { status: { notIn: ['entregue', 'cancelado'] } },
        ],
      },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true,
        numero: true,
        nomeContato: true,
        bairro: true,
        status: true,
        criadoEm: true,
        entregueEm: true,
        agendadoPara: true,
        totalCentavos: true,
        pagaComCentavos: true,
        formaPagamento: true,
        motivoNaoEntrega: true,
        observacaoEntrega: true,
        tentadoEm: true,
      },
    })

    const entregues = entregasHoje.filter((e) => e.status === 'entregue')
    const emRota = entregasHoje.filter((e) => e.status === 'em_rota')
    const aguardando = entregasHoje.filter((e) => e.status === 'recebido')
    // Tentou e não deu. Precisa aparecer para o dono: é mercadoria parada e
    // cliente esperando, e só alguém do escritório resolve.
    const naoEntregues = entregasHoje.filter((e) => e.status === 'nao_entregue')

    /**
     * Trocos a separar antes de o motorista sair.
     *
     * É a informação mais perecível do painel: depois que o carro saiu do
     * galpão, saber que faltam R$ 12 de troco não serve mais para nada.
     */
    const trocos = entregasHoje
      .filter((e) => e.pagaComCentavos !== null && e.status !== 'entregue')
      .map((e) => ({
        numero: e.numero,
        cliente: e.nomeContato,
        bairro: e.bairro,
        totalCentavos: e.totalCentavos,
        pagaComCentavos: e.pagaComCentavos!,
        trocoCentavos: Math.max(0, e.pagaComCentavos! - e.totalCentavos),
      }))

    const minutosDeEntrega = entregues
      .filter((e) => e.entregueEm)
      .map((e) => (e.entregueEm!.getTime() - e.criadoEm.getTime()) / 60_000)
    const tempoMedioMinutos = minutosDeEntrega.length
      ? Math.round(minutosDeEntrega.reduce((a, b) => a + b, 0) / minutosDeEntrega.length)
      : null

    // Dias sem nenhum pedido não voltam do banco — completa com zero para o
    // gráfico não pular datas. A comparação é texto com texto: os dois lados
    // já vêm como "AAAA-MM-DD" no fuso da loja.
    const porDia = Array.from({ length: 7 }, (_, i) => {
      const chave = comoDataLocal(somandoDias(seteDiasAtras, i))
      const achado = porDiaBruto.find((d) => d.dia === chave)
      return {
        dia: chave,
        ehHoje: chave === comoDataLocal(hoje),
        pedidos: achado?.pedidos ?? 0,
        totalCentavos: achado?.total ?? 0,
      }
    })

    // ── Resumo do topo ───────────────────────────────────────
    const vendasSemana = somaSemanaAtual[0]?.total ?? 0
    const vendasSemanaPassada = somaSemanaAnterior[0]?.total ?? 0
    const pedidosSemana = somaSemanaAtual[0]?.pedidos ?? 0
    const pedidosSemanaPassada = somaSemanaAnterior[0]?.pedidos ?? 0

    const ticketAtual = pedidosSemana ? Math.round(vendasSemana / pedidosSemana) : 0
    const ticketAnterior = pedidosSemanaPassada
      ? Math.round(vendasSemanaPassada / pedidosSemanaPassada)
      : 0

    const totalDeHoje = entregasHoje.length

    return {
      resumo: {
        vendasSemanaCentavos: vendasSemana,
        variacaoVendasPercentual: variacao(vendasSemana, vendasSemanaPassada),
        pedidosHoje: totalDeHoje,
        variacaoPedidosDia: totalDeHoje - pedidosOntem,
        ticketMedioCentavos: ticketAtual,
        variacaoTicketPercentual: variacao(ticketAtual, ticketAnterior),
        entregasConcluidasPercentual: totalDeHoje
          ? Math.round((entregues.length / totalDeHoje) * 100)
          : null,
        metaSemanalCentavos: meta,
      },
      semanas: semanas.map((s) => ({
        inicio: s.inicio,
        rotulo: `S${s.numero_semana}`,
        totalCentavos: s.total,
        pedidos: s.pedidos,
        ehSemanaAtual: s.inicio === comoDataLocal(semanaAtual),
        bateuMeta: s.total >= meta,
      })),
      maisVendidos: maisVendidos.map((p) => ({
        produtoId: p.produto_id,
        nome: p.nome,
        emoji: p.emoji,
        unidade: p.unidade,
        unidadesVendidas: p.unidades,
        receitaCentavos: p.receita,
      })),
      porDia,
      entregas: {
        total: totalDeHoje,
        entregues: entregues.length,
        emRota: emRota.length,
        aguardando: aguardando.length,
        naoEntregues: naoEntregues.length,
        trocos,
        tempoMedioMinutos,
        lista: entregasHoje.map(({ nomeContato, ...e }) => ({ ...e, cliente: nomeContato })),
      },
    }
  })
}
