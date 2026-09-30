import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'
import { raizApi, raizProjeto } from './caminhos.js'

/**
 * Lê o .env, confere tudo e só então deixa o resto do sistema começar.
 * Configuração errada falha aqui, na hora de subir, com um recado que diz o
 * que fazer — nunca no meio de um pedido.
 */

// O .env fica na raiz do projeto; um .env dentro de api/ tem prioridade se existir.
for (const arquivo of [resolve(raizApi, '.env'), resolve(raizProjeto, '.env')]) {
  if (existsSync(arquivo)) dotenv.config({ path: arquivo })
}

const esquema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),
    HOST: z.string().default('127.0.0.1'),
    WEB_ORIGIN: z.string().default('http://localhost:5173'),

    /**
     * Conexão do dia a dia. No Supabase, use a do POOLER (porta 6543).
     * Postgres local: postgresql://postgres:SENHA@localhost:5432/emporium_dev
     */
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória — o projeto precisa de um Postgres.'),

    /**
     * Conexão DIRETA, usada só pelas migrações (porta 5432 no Supabase).
     * Sem Supabase, é a mesma coisa que DATABASE_URL e pode ficar vazia.
     */
    DIRECT_URL: z.string().optional(),

    STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default('produtos'),

    JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa de pelo menos 16 caracteres'),

    /**
     * Fuso da operação. É ele que decide onde começa "hoje" — no painel do
     * dono, na rota do motorista e no agrupamento por dia e semana.
     */
    FUSO_HORARIO: z.string().default('America/Manaus'),

    // ── Onde o motorista começa o dia (valor provisório) ─────
    // A sede de verdade fica no banco, preenchida pelo dono em Configurações.
    // Isto aqui só vale enquanto aquela tela não foi usada — ver central.ts.
    CENTRAL_NOME: z.string().default('Central de Distribuição'),
    CENTRAL_LATITUDE: z.coerce.number().min(-90).max(90).default(-3.1063),
    CENTRAL_LONGITUDE: z.coerce.number().min(-180).max(180).default(-60.0537),

    // ── Mapa e rota ──────────────────────────────────────────
    /**
     * Degrau em que a rota COMEÇA. Falhando, ela desce sozinha até a linha
     * reta, avisando na tela em que degrau parou.
     *
     * tomtom     — com trânsito, ordem otimizada e curva a curva. Plano
     *              gratuito sem cartão. Exige TOMTOM_API_KEY. É o recomendado.
     * google     — Routes API, com trânsito. Exige GOOGLE_MAPS_API_KEY e
     *              cadastro de cobrança.
     * osrm       — pelas ruas, sem trânsito. Grátis, sem chave.
     * linha-reta — só a heurística, sem falar com ninguém.
     */
    ROTA_PROVEDOR: z.enum(['tomtom', 'google', 'osrm', 'linha-reta']).default('osrm'),

    /**
     * Chave da Routing API da TomTom. Sem ela, ROTA_PROVEDOR=tomtom cai para o
     * OSRM sozinho e avisa na tela — o sistema não para por falta de chave.
     */
    TOMTOM_API_KEY: z.string().default(''),
    TOMTOM_URL: z.string().default('https://api.tomtom.com'),

    /**
     * Chave da Routes API do Google. Sem ela, ROTA_PROVEDOR=google cai para o
     * OSRM sozinho e avisa na tela — o sistema não para por falta de chave.
     */
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    OSRM_URL: z.string().default('https://router.project-osrm.org'),
    GEO_PROVEDOR: z.enum(['nominatim', 'nenhum']).default('nominatim'),
    /** Consulta de CEP — gratuita e sem chave. */
    BRASILAPI_URL: z.string().default('https://brasilapi.com.br'),
    NOMINATIM_URL: z.string().default('https://nominatim.openstreetmap.org'),
    /** Nominatim e OSRM exigem que a aplicação se identifique. */
    CONTATO_APP: z.string().default('Emporium da Horta (contato@emporiumdahorta.com.br)'),

    // ── Acesso inicial da equipe (usado só pelo `npm run db:seed`) ──
    DONO_EMAIL: z.string().email().default('dono@emporiumdahorta.com.br'),
    DONO_SENHA: z.string().min(6).default('horta123'),
    MOTORISTA_EMAIL: z.string().email().default('motorista@emporiumdahorta.com.br'),
    MOTORISTA_SENHA: z.string().min(6).default('rota123'),
  })
  .superRefine((valor, ctx) => {
    // O .env.example vem com um marcador no lugar da senha. Se ele chegou até
    // aqui, o recado é esse — e não um "falha de autenticação" do Postgres.
    if (valor.DATABASE_URL.includes('COLE_A_SENHA_AQUI')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message:
          'a senha ainda não foi preenchida. Abra o .env e troque COLE_A_SENHA_AQUI pela senha do Postgres.',
      })
    }

    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: valor.FUSO_HORARIO })
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FUSO_HORARIO'],
        message: `"${valor.FUSO_HORARIO}" não é um fuso conhecido. Use um nome IANA, como America/Manaus.`,
      })
    }
    if (valor.STORAGE_DRIVER === 'supabase') {
      if (!valor.SUPABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_URL'],
          message: 'STORAGE_DRIVER=supabase exige SUPABASE_URL (Project Settings → API).',
        })
      }
      if (!valor.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message: 'STORAGE_DRIVER=supabase exige SUPABASE_SERVICE_ROLE_KEY (Project Settings → API).',
        })
      }
    }
  })

const resultado = esquema.safeParse(process.env)

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((i) => `  • ${i.path.join('.') || '(raiz)'}: ${i.message}`)
    .join('\n')
  console.error(
    `\nConfiguração inválida no .env:\n${problemas}\n\n` +
      'Copie o .env.example para .env e preencha o que falta.\n',
  )
  process.exit(1)
}

export const env = resultado.data
export const ehProducao = env.NODE_ENV === 'production'

/**
 * O fuso da loja, exposto separado porque é usado o tempo todo — nas contas de
 * "hoje" no JavaScript e nas consultas do painel no SQL.
 */
export const FUSO = env.FUSO_HORARIO

/**
 * Fixa o fuso do processo ANTES de qualquer data ser criada.
 *
 * Sem isto, `new Date(ano, mes, dia)` usa o fuso da máquina: na sua funciona,
 * num servidor em UTC (o padrão de quase toda hospedagem) "hoje" passaria a
 * começar às 20h do dia anterior em Manaus. Este módulo é o primeiro a ser
 * avaliado em toda a aplicação, então a troca vale para tudo que vem depois.
 */
process.env.TZ = FUSO
