import { prisma } from '../conexao.js'
import { localizar } from '../../comum/enderecos.js'

/**
 * Recalcula no mapa a posição dos pedidos que ainda não foram entregues.
 *
 * A coordenada de um pedido é congelada no momento em que ele é fechado. Isso
 * é proposital: o motorista precisa do ponto mesmo que o serviço de mapas caia
 * depois. O efeito colateral é que melhorar a geocodificação NÃO conserta
 * sozinho o que já está gravado — este script é a ponte.
 *
 * Só mexe em pedido que ainda vai ser entregue. Pedido entregue é histórico, e
 * histórico não se reescreve para ficar mais bonito.
 *
 *   npm run db:relocalizar
 */

async function principal() {
  const pendentes = await prisma.pedido.findMany({
    where: { status: { notIn: ['entregue', 'cancelado'] } },
    orderBy: { numero: 'asc' },
    select: {
      id: true,
      numero: true,
      cep: true,
      rua: true,
      numeroEndereco: true,
      bairro: true,
      latitude: true,
      longitude: true,
      precisaoLocal: true,
    },
  })

  if (pendentes.length === 0) {
    console.log('Nenhum pedido pendente. Nada a recalcular.')
    return
  }

  console.log(`Recalculando ${pendentes.length} pedido(s) ainda não entregues…\n`)

  let mudaram = 0

  for (const pedido of pendentes) {
    // O cache de geocodificação segura o ritmo e evita repetir pergunta; se o
    // endereço já foi recalculado nesta rodada, nem sai da máquina.
    const local = await localizar({
      rua: pedido.rua,
      numero: pedido.numeroEndereco,
      bairro: pedido.bairro,
      cep: pedido.cep,
    })

    const mudou =
      local.latitude !== pedido.latitude ||
      local.longitude !== pedido.longitude ||
      local.precisao !== pedido.precisaoLocal

    console.log(`#${pedido.numero} · ${pedido.rua}, ${pedido.numeroEndereco} — ${pedido.bairro}`)
    console.log(`   antes : ${pedido.latitude}, ${pedido.longitude} (${pedido.precisaoLocal})`)
    console.log(`   agora : ${local.latitude}, ${local.longitude} (${local.precisao})`)

    if (!mudou) {
      console.log('   → igual, nada a fazer\n')
      continue
    }

    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        latitude: local.latitude,
        longitude: local.longitude,
        precisaoLocal: local.precisao,
      },
    })
    mudaram++
    console.log(`   → ATUALIZADO${local.rotulo ? ` · ${local.rotulo}` : ''}\n`)
  }

  console.log(`${mudaram} de ${pendentes.length} pedido(s) mudaram de lugar.`)
  if (mudaram > 0) {
    console.log('A rota do dia já sai recalculada na próxima vez que a tela carregar.')
  }
}

await principal()
  .catch((erro) => {
    console.error('Falhou ao recalcular:', erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
