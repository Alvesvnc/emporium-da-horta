import { mkdirSync } from 'node:fs'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import estaticos from '@fastify/static'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import { TAMANHO_MAXIMO_BYTES } from './comum/arquivos.js'
import { ehProducao, env, FUSO } from './config/ambiente.js'
import { pastaUploads } from './config/caminhos.js'
import { endpointsCatalogo } from './modulos/catalogo/catalogo.endpoints.js'
import { endpointsEnderecos } from './modulos/enderecos/enderecos.endpoints.js'
import { endpointsConfiguracoes } from './modulos/configuracoes/configuracoes.endpoints.js'
import { endpointsEntregas } from './modulos/entregas/entregas.endpoints.js'
import { endpointsEquipe } from './modulos/equipe/equipe.endpoints.js'
import { endpointsLoja } from './modulos/loja/loja.endpoints.js'
import { endpointsMetricas } from './modulos/metricas/metricas.endpoints.js'
import { endpointsPedidos } from './modulos/pedidos/pedidos.endpoints.js'

/**
 * Monta a aplicação: plugins, rotas e tratamento de erro.
 *
 * Quem sobe o servidor é o main.ts. Separar os dois deixa a aplicação pronta
 * para ser criada também em um teste, sem abrir porta nenhuma.
 */
export async function criarApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: ehProducao
      ? { level: 'info' }
      : {
          level: 'info',
          transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } },
        },
    bodyLimit: 1_048_576,
  })

  await app.register(cors, {
    origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  })

  await app.register(jwt, { secret: env.JWT_SECRET })

  await app.register(multipart, {
    limits: { fileSize: TAMANHO_MAXIMO_BYTES, files: 1 },
  })

  // No modo local, o próprio Fastify serve as fotos enviadas pelo dono.
  if (env.STORAGE_DRIVER === 'local') {
    mkdirSync(pastaUploads, { recursive: true })
    await app.register(estaticos, { root: pastaUploads, prefix: '/uploads/' })
  }

  app.get('/api/saude', async () => ({
    ok: true,
    fotos: env.STORAGE_DRIVER,
    fuso: FUSO,
    quando: new Date().toISOString(),
  }))

  // Um módulo por assunto. A ordem aqui não importa: cada um registra os
  // próprios endereços.
  await app.register(endpointsLoja)
  await app.register(endpointsPedidos)
  await app.register(endpointsEnderecos)
  await app.register(endpointsEquipe)
  await app.register(endpointsCatalogo)
  await app.register(endpointsConfiguracoes)
  await app.register(endpointsMetricas)
  await app.register(endpointsEntregas)

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ erro: `Rota não encontrada: ${req.method} ${req.url}` })
  })

  app.setErrorHandler((erro: FastifyError, req, reply) => {
    const status = erro.statusCode ?? 500
    if (status >= 500) req.log.error({ erro }, 'erro não tratado')
    reply.code(status).send({
      erro: status >= 500 ? 'Algo deu errado no servidor. Tente de novo.' : erro.message,
    })
  })

  return app
}
