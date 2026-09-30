import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from '@prisma/config'
import { config as carregarEnv } from 'dotenv'

/**
 * Configuração do CLI do Prisma (migrate, db, studio).
 *
 * No Prisma 7 as URLs de conexão saem do schema.prisma e vêm para cá. Quem
 * roda a aplicação não passa por este arquivo: lá a conexão entra pelo
 * adapter, em src/banco/conexao.ts.
 */

// O .env fica na raiz do projeto, um nível acima de api/.
for (const arquivo of ['.env', resolve('..', '.env')]) {
  if (existsSync(arquivo)) carregarEnv({ path: arquivo })
}

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
    // `prisma migrate reset` e `prisma db seed` chamam isto. Não popula dados
    // de exemplo: só deixa o banco utilizável (categorias, equipe, config).
    seed: 'tsx src/banco/scripts/preparar.ts',
  },

  datasource: {
    /**
     * Migração pede conexão DIRETA.
     *
     * No Supabase, a URL do dia a dia é a do pooler em modo transação — ela
     * não serve para DDL nem para o lock que o migrate usa. DIRECT_URL aponta
     * para a porta 5432 do banco; sem Supabase, as duas são a mesma coisa.
     *
     * `||` e não `??` de propósito: no .env, DIRECT_URL vem como string VAZIA
     * quando não há Supabase, e `??` só cai para o outro lado em null/undefined
     * — passaria "" adiante e a migração falharia sem dizer por quê.
     */
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
})
