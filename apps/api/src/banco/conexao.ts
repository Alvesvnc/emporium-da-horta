import { PrismaPg } from '@prisma/adapter-pg'
import { env, FUSO } from '../config/ambiente.js'
import { PrismaClient } from './gerado/client.js'

/**
 * A conexão com o Postgres.
 *
 * No Prisma 7 não existe mais motor em Rust: quem fala com o banco é um driver
 * adapter comum — aqui o `pg`. A URL não vem do schema.prisma, vem daqui.
 *
 * `options=-c timezone=...` fixa o fuso na sessão do Postgres. Serve de rede de
 * segurança: as consultas do painel já dizem o fuso explicitamente com
 * `AT TIME ZONE`, porque atrás de um pooler (Supabase) parâmetros de conexão
 * podem ser ignorados. Sem nenhum dos dois, o corte do dia seguiria UTC e um
 * pedido feito às 21h de segunda seria contado na terça.
 */
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  options: `-c timezone=${FUSO}`,
})

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

/** Abre a conexão logo, para o primeiro pedido não pagar o custo. */
export async function bancoPronto(): Promise<void> {
  await prisma.$connect()
}

export async function fecharBanco(): Promise<void> {
  await prisma.$disconnect()
}

/** A loja tem uma configuração só, e ela mora nesta linha. */
export const ID_CONFIGURACAO = 1
