import { criarApp } from './app.js'
import { bancoPronto, fecharBanco } from './banco/conexao.js'
import { env } from './config/ambiente.js'

/** Ponto de entrada: monta a aplicação, abre a porta e fecha tudo direito. */

await bancoPronto()
const app = await criarApp()

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => {
    app.log.info('encerrando…')
    await app.close()
    await fecharBanco().catch(() => {})
    process.exit(0)
  })
}

try {
  await app.listen({ port: env.PORT, host: env.HOST })
  app.log.info(`fotos: ${env.STORAGE_DRIVER} · fuso: ${env.FUSO_HORARIO} · site: ${env.WEB_ORIGIN}`)
  app.log.info(`rota: ${env.ROTA_PROVEDOR} · endereços: ${env.GEO_PROVEDOR}`)
} catch (erro) {
  app.log.error(erro)
  process.exit(1)
}
