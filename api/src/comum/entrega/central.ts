import { ID_CONFIGURACAO, prisma } from '../../banco/conexao.js'
import { env } from '../../config/ambiente.js'

/**
 * De onde o motorista sai: o endereço da própria sede.
 *
 * Mora no banco, não no .env, porque trocar de galpão é decisão do dono e não
 * pode depender de programador. O .env continua valendo como valor provisório
 * para o sistema subir antes de alguém preencher a tela.
 *
 * `configurada` diz qual dos dois está valendo. Isso importa: enquanto for o
 * provisório, toda distância e todo tempo da rota estão sendo medidos a partir
 * de um ponto inventado — e a tela do motorista precisa dizer isso na cara.
 */
export type Central = {
  nome: string
  latitude: number
  longitude: number
  configurada: boolean
}

export async function centralAtual(): Promise<Central> {
  const config = await prisma.configuracoes.findUnique({ where: { id: ID_CONFIGURACAO } })

  // O banco garante que latitude e longitude andam em par (CHECK
  // configuracoes_central_par_completo), mas conferimos as duas assim mesmo:
  // aqui é o lugar onde um valor pela metade viraria rota errada.
  if (config?.centralLatitude != null && config.centralLongitude != null) {
    return {
      nome: config.centralNome,
      latitude: config.centralLatitude,
      longitude: config.centralLongitude,
      configurada: true,
    }
  }

  return {
    nome: env.CENTRAL_NOME,
    latitude: env.CENTRAL_LATITUDE,
    longitude: env.CENTRAL_LONGITUDE,
    configurada: false,
  }
}
