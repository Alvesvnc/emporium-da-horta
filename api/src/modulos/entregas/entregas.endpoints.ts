import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../banco/conexao.js'
import { ArquivoInvalido, salvarFoto, TAMANHO_MAXIMO_BYTES } from '../../comum/arquivos.js'
import { exigirPapel } from '../../comum/autenticacao.js'
import { centralAtual, type Central } from '../../comum/entrega/central.js'
import { esquecerRotas } from '../../comum/entrega/cache-rota.js'
import { navegarAte } from '../../comum/entrega/navegacao.js'
import { calcularRota } from '../../comum/entrega/roteador.js'

/** Tela do motorista: as entregas do dia, na ordem em que vale a pena rodar. */

/**
 * Link que abre a navegação no aparelho do motorista.
 *
 * Com coordenada exata, manda o ponto — é o endereço certo. Com coordenada
 * aproximada (só o bairro), manda o ENDEREÇO ESCRITO: o aplicativo de mapas
 * procura melhor do que nós, e mandar o centro do bairro levaria o motorista
 * para a rua errada com cara de certeza.
 */
function linkDeNavegacao(parada: {
  latitude: number | null
  longitude: number | null
  precisaoLocal: string
  rua: string
  numeroEndereco: string
  bairro: string
}): string {
  const base = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='

  if (parada.precisaoLocal === 'exata' && parada.latitude !== null && parada.longitude !== null) {
    return `${base}${parada.latitude},${parada.longitude}`
  }

  const endereco = `${parada.rua}, ${parada.numeroEndereco} - ${parada.bairro}, Manaus - AM`
  return base + encodeURIComponent(endereco)
}

/**
 * Quantas paradas cabem num link do Google Maps.
 *
 * A URL do Maps aceita no máximo TRÊS pontos intermediários quando abre no
 * celular (nove em outras plataformas). Passar mais não dá erro: ele
 * simplesmente ignora o resto — e um motorista seguindo um link que perdeu
 * metade das entregas é pior do que não ter link nenhum.
 *
 * Três intermediários + o destino = quatro paradas por vez.
 */
const PARADAS_POR_LINK = 4

/** Link com o próximo trecho da rota, na ordem já calculada. */
function linkDoProximoTrecho(
  pontos: Array<{ latitude: number; longitude: number }>,
  central: Central,
): string | null {
  if (pontos.length === 0) return null

  const trecho = pontos.slice(0, PARADAS_POR_LINK)
  const destino = trecho[trecho.length - 1]!
  const intermediarios = trecho.slice(0, -1)

  const parametros = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    origin: `${central.latitude},${central.longitude}`,
    destination: `${destino.latitude},${destino.longitude}`,
  })
  if (intermediarios.length > 0) {
    parametros.set('waypoints', intermediarios.map((p) => `${p.latitude},${p.longitude}`).join('|'))
  }

  return `https://www.google.com/maps/dir/?${parametros}`
}

/**
 * Quanto de troco levar. Null quando não é dinheiro ou o cliente tem o valor
 * exato. O troco é sempre CALCULADO — guardar o troco junto do "paga com"
 * seria manter dois números que precisam concordar, e um dia não concordam.
 */
function trocoDe(pedido: { pagaComCentavos: number | null; totalCentavos: number }): number | null {
  if (pedido.pagaComCentavos === null) return null
  return Math.max(0, pedido.pagaComCentavos - pedido.totalCentavos)
}

/**
 * O que já se tentou nesta parada.
 *
 * Vai para a tela porque muda a conduta do motorista: bater de novo na mesma
 * porta sabendo que ontem ninguém atendeu não é a mesma coisa que chegar sem
 * saber de nada — ele liga antes de subir.
 */
function tentativaAnterior(pedido: {
  status: string
  motivoNaoEntrega: string | null
  observacaoEntrega: string | null
  tentadoEm: Date | null
}) {
  if (pedido.status !== 'nao_entregue') return null
  return {
    motivo: pedido.motivoNaoEntrega,
    observacao: pedido.observacaoEntrega,
    em: pedido.tentadoEm,
  }
}

export async function endpointsEntregas(app: FastifyInstance) {
  const equipe = { preHandler: exigirPapel('motorista', 'dono') }

  app.get('/api/rota/hoje', equipe, async () => {
    const central = await centralAtual()
    const agora = new Date()
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())

    const doDia = await prisma.pedido.findMany({
      where: {
        status: { not: 'cancelado' },
        OR: [
          // Tudo de hoje, inclusive o que já foi entregue — é o que alimenta a
          // lista de concluídas e a barra de progresso do dia.
          { criadoEm: { gte: hoje } },
          /**
           * E TUDO que ainda não foi entregue, de qualquer data.
           *
           * Não basta trazer de volta a tentativa frustrada. O pedido que
           * ficou parado em `recebido` porque ninguém chegou a sair, ou que
           * saiu `em_rota` e o dia acabou, também precisa reaparecer — do
           * ponto de vista do cliente é a mesma coisa: ele pagou e a
           * mercadoria não chegou.
           *
           * Com o filtro só por data, esse pedido desaparecia de todas as
           * telas na virada da meia-noite, sem que ninguém fosse avisado.
           * Ele só sai daqui quando for entregue ou cancelado — as duas
           * únicas maneiras de um pedido realmente acabar.
           */
          { status: { notIn: ['entregue', 'cancelado'] } },
        ],
      },
      orderBy: { criadoEm: 'asc' },
      include: { itens: true },
    })

    if (doDia.length === 0) {
      return {
        central,
        provedor: 'osrm',
        aviso: null,
        geometria: [],
        paradas: [],
        semLocalizacao: [],
        entregues: [],
        linkProximoTrecho: null,
        paradasNoLink: 0,
        resumo: { total: 0, restantes: 0, distanciaKm: 0, minutosEstimados: 0 },
      }
    }


    const pendentes = doDia.filter((p) => p.status !== 'entregue')
    const comLocal = pendentes.filter(
      (p): p is typeof p & { latitude: number; longitude: number } =>
        p.latitude !== null && p.longitude !== null,
    )
    const semLocal = pendentes.filter((p) => p.latitude === null || p.longitude === null)

    const rota = await calcularRota(
      comLocal.map((p) => ({ id: p.id, latitude: p.latitude, longitude: p.longitude })),
      central,
    )

    const paradas = rota.paradas.map((ordenada) => {
      const pedido = comLocal.find((p) => p.id === ordenada.id)!
      return {
        pedidoId: pedido.id,
        numero: pedido.numero,
        ordem: ordenada.ordem,
        cliente: pedido.nomeContato,
        telefone: pedido.telefoneContato,
        endereco: `${pedido.rua}, ${pedido.numeroEndereco}`,
        complemento: pedido.complemento,
        bairro: pedido.bairro,
        latitude: pedido.latitude,
        longitude: pedido.longitude,
        precisao: pedido.precisaoLocal,
        distanciaKm: ordenada.distanciaKm,
        minutos: ordenada.minutos,
        status: pedido.status,
        formaPagamento: pedido.formaPagamento,
        totalCentavos: pedido.totalCentavos,
        agendadoPara: pedido.agendadoPara,
        linkNavegacao: linkDeNavegacao(pedido),
        criadoEm: pedido.criadoEm,
        pagaComCentavos: pedido.pagaComCentavos,
        trocoCentavos: trocoDe(pedido),
        tentativaAnterior: tentativaAnterior(pedido),
        itens: pedido.itens,
      }
    })

    // Pedidos que nem o bairro localizou: ficam de fora do mapa e da conta de
    // quilômetros, mas continuam na tela — alguém precisa entregá-los.
    const semLocalizacao = semLocal.map((pedido) => ({
      pedidoId: pedido.id,
      numero: pedido.numero,
      cliente: pedido.nomeContato,
      telefone: pedido.telefoneContato,
      endereco: `${pedido.rua}, ${pedido.numeroEndereco}`,
      complemento: pedido.complemento,
      bairro: pedido.bairro,
      status: pedido.status,
      formaPagamento: pedido.formaPagamento,
      totalCentavos: pedido.totalCentavos,
      linkNavegacao: linkDeNavegacao(pedido),
      criadoEm: pedido.criadoEm,
      pagaComCentavos: pedido.pagaComCentavos,
      trocoCentavos: trocoDe(pedido),
      tentativaAnterior: tentativaAnterior(pedido),
      itens: pedido.itens,
    }))

    const entregues = doDia
      .filter((p) => p.status === 'entregue')
      .map((p) => ({
        pedidoId: p.id,
        numero: p.numero,
        cliente: p.nomeContato,
        bairro: p.bairro,
        entregueEm: p.entregueEm,
        totalCentavos: p.totalCentavos,
      }))

    return {
      central,
      provedor: rota.provedor,
      aviso: rota.aviso,
      geometria: rota.geometria,
      paradas,
      semLocalizacao,
      entregues,
      linkProximoTrecho: linkDoProximoTrecho(
        paradas.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        central,
      ),
      paradasNoLink: Math.min(paradas.length, PARADAS_POR_LINK),
      resumo: {
        total: doDia.length,
        restantes: pendentes.length,
        distanciaKm: rota.distanciaTotalKm,
        minutosEstimados: rota.minutosTotal,
        semLocalizacao: semLocalizacao.length,
        aproximadas: paradas.filter((p) => p.precisao !== 'exata').length,
        retentativas: doDia.filter((p) => p.status === 'nao_entregue').length,
      },
    }
  })

  /**
   * Navegação curva a curva até uma parada.
   *
   * A tela manda onde o motorista está agora, não a Central: navegação começa
   * de onde ele parou, inclusive quando ele errou o caminho e precisa que o
   * trajeto seja refeito do zero.
   */
  app.post('/api/rota/navegar', equipe, async (req, reply) => {
    const corpo = z.object({
      pedidoId: z.coerce.number().int().positive(),
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
    })

    const analise = corpo.safeParse(req.body)
    if (!analise.success) return reply.code(400).send({ erro: 'Posição ou parada inválida.' })

    const pedido = await prisma.pedido.findFirst({
      where: { id: analise.data.pedidoId, status: { not: 'cancelado' } },
      select: { latitude: true, longitude: true, precisaoLocal: true },
    })
    if (!pedido) return reply.code(404).send({ erro: 'Pedido não encontrado.' })

    if (pedido.latitude === null || pedido.longitude === null) {
      return reply.code(422).send({
        erro: 'Esta parada não tem ponto no mapa. Use o endereço escrito para chegar.',
      })
    }

    try {
      const navegacao = await navegarAte(
        { latitude: analise.data.latitude, longitude: analise.data.longitude },
        { latitude: pedido.latitude, longitude: pedido.longitude },
      )
      // Endereço achado só pelo bairro leva o motorista até perto, não até o
      // portão. Ele precisa saber disso antes de confiar na última manobra.
      return { navegacao, precisaoDestino: pedido.precisaoLocal }
    } catch (erro) {
      return reply.code(502).send({
        erro: `Não consegui traçar o caminho: ${erro instanceof Error ? erro.message : 'serviço fora do ar'}.`,
      })
    }
  })

  /**
   * O motorista conta onde está.
   *
   * Vem do mesmo GPS que já guia a navegação, então não custa bateria nova. A
   * tela envia a cada poucos minutos, não a cada leitura: o dono precisa saber
   * onde o carro está, não desenhar o rastro dele.
   *
   * Guarda só a ÚLTIMA posição, sobrescrevendo. Não há histórico de propósito —
   * ver a comentário do modelo em schema.prisma.
   */
  app.post('/api/rota/posicao', { preHandler: exigirPapel('motorista') }, async (req, reply) => {
    const corpo = z.object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      precisaoMetros: z.coerce.number().min(0).max(100_000),
    })

    const analise = corpo.safeParse(req.body)
    if (!analise.success) return reply.code(400).send({ erro: 'Posição inválida.' })

    const dados = { ...analise.data, atualizadoEm: new Date() }
    await prisma.posicaoMotorista.upsert({
      where: { usuarioId: req.user.id },
      update: dados,
      create: { usuarioId: req.user.id, ...dados },
    })

    return { recebido: true }
  })

  /**
   * Onde estão os motoristas. Só o dono.
   *
   * Devolve a IDADE da informação junto com a coordenada, e nunca uma sem a
   * outra: quem olha precisa saber se está vendo o carro agora ou onde ele
   * passou antes de entrar num bolsão sem sinal.
   *
   * Motorista que nunca ligou o GPS aparece sem posição, e não some da lista —
   * "não sei onde ele está" é uma resposta, e é diferente de "não existe".
   */
  app.get('/api/admin/motoristas', { preHandler: exigirPapel('dono') }, async () => {
    const motoristas = await prisma.usuarioEquipe.findMany({
      where: { papel: 'motorista', ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, posicao: true },
    })

    return {
      motoristas: motoristas.map((m) => ({
        id: m.id,
        nome: m.nome,
        latitude: m.posicao?.latitude ?? null,
        longitude: m.posicao?.longitude ?? null,
        precisaoMetros: m.posicao?.precisaoMetros ?? null,
        vistoEm: m.posicao?.atualizadoEm ?? null,
      })),
    }
  })

  /**
   * A foto da entrega (multipart, um arquivo).
   *
   * Vem antes do PATCH que marca como entregue, de propósito: se a foto falhar
   * — e vai falhar, porque rede de rua cai —, o motorista tenta de novo sem ter
   * dado a entrega por concluída em cima de um comprovante que não subiu.
   */
  app.post('/api/rota/paradas/:pedidoId/foto', equipe, async (req, reply) => {
    const params = z.object({ pedidoId: z.coerce.number().int().positive() }).safeParse(req.params)
    if (!params.success) return reply.code(400).send({ erro: 'Parada inválida.' })

    const pedido = await prisma.pedido.findFirst({
      where: { id: params.data.pedidoId, status: { not: 'cancelado' } },
      select: { id: true },
    })
    if (!pedido) return reply.code(404).send({ erro: 'Pedido não encontrado.' })

    const arquivo = await req.file({ limits: { fileSize: TAMANHO_MAXIMO_BYTES } })
    if (!arquivo) return reply.code(400).send({ erro: 'Nenhuma foto foi enviada.' })

    try {
      const salva = await salvarFoto(
        await arquivo.toBuffer(),
        arquivo.filename,
        arquivo.mimetype,
      )
      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { fotoEntregaUrl: salva.url },
      })
      return { fotoUrl: salva.url }
    } catch (erro) {
      if (erro instanceof ArquivoInvalido) return reply.code(400).send({ erro: erro.message })
      req.log.error({ erro }, 'falha ao salvar foto da entrega')
      return reply.code(500).send({ erro: 'Não consegui salvar a foto. Tente de novo.' })
    }
  })

  /**
   * Fecha a parada: entregue, ou não entregue com o motivo.
   *
   * Registrar a falha é tão importante quanto registrar o sucesso. Sem um
   * botão para isso, o motorista com o cliente ausente na frente só tem duas
   * saídas ruins: marcar entregue (mentira que vira dado de venda falso) ou
   * não marcar nada (o pedido some da rota no dia seguinte).
   */
  app.patch('/api/rota/paradas/:pedidoId', equipe, async (req, reply) => {
    const params = z.object({ pedidoId: z.coerce.number().int().positive() }).safeParse(req.params)
    if (!params.success) return reply.code(400).send({ erro: 'Parada inválida.' })

    const corpo = z
      .object({
        status: z.enum(['recebido', 'em_rota', 'entregue', 'nao_entregue']),
        motivo: z.enum(['ausente', 'endereco_nao_encontrado', 'recusado', 'outro']).optional(),
        observacao: z.string().trim().max(300).optional(),
        recebidoPor: z.string().trim().max(120).optional(),
      })
      .safeParse(req.body)
    if (!corpo.success) return reply.code(400).send({ erro: 'Status inválido.' })

    const { status, motivo, observacao, recebidoPor } = corpo.data

    // O banco também recusa (pedidos_nao_entregue_tem_motivo), mas um recado em
    // português é melhor que um erro de constraint.
    if (status === 'nao_entregue' && !motivo) {
      return reply.code(400).send({ erro: 'Diga por que a entrega não aconteceu.' })
    }

    const agora = new Date()

    // updateMany porque o filtro tem duas condições. Ele devolve quantas linhas
    // mudaram, o que já responde "o pedido existe e não está cancelado".
    const { count } = await prisma.pedido.updateMany({
      where: { id: params.data.pedidoId, status: { not: 'cancelado' } },
      data: {
        status,
        entregueEm: status === 'entregue' ? agora : null,
        // Só grava na tentativa frustrada. Quando a entrega enfim acontece, o
        // motivo antigo fica: é o histórico de por que demorou.
        ...(status === 'nao_entregue'
          ? { motivoNaoEntrega: motivo, observacaoEntrega: observacao ?? null, tentadoEm: agora }
          : {}),
        ...(status === 'entregue' ? { recebidoPor: recebidoPor || null } : {}),
      },
    })

    if (count === 0) return reply.code(404).send({ erro: 'Pedido não encontrado.' })

    /**
     * Só esquece a rota quando o conjunto de paradas pendentes muda.
     *
     * `em_rota` não tira ninguém da fila — o motorista está indo, a parada
     * continua lá. Limpar o cache aqui obrigaria a recalcular a rota inteira a
     * cada toque em "Navegar", gastando uma chamada paga do provedor por nada.
     */
    if (status === 'entregue' || status === 'nao_entregue') esquecerRotas()

    const pedido = await prisma.pedido.findUnique({ where: { id: params.data.pedidoId } })
    return { pedido }
  })
}
