import bcrypt from 'bcryptjs'
import type { FastifyReply, FastifyRequest } from 'fastify'

export type PapelEquipe = 'dono' | 'motorista'

/** Quem entrou com e-mail e senha: dono ou motorista. */
export type SessaoEquipe = {
  tipo: 'equipe'
  id: number
  nome: string
  email: string
  papel: PapelEquipe
}

/**
 * A única sessão que existe: a da equipe.
 *
 * Cliente não tem conta neste sistema — compra informando nome, telefone e
 * endereço, e acompanha o pedido pelo número mais o telefone. Nada para criar,
 * nada para lembrar, nada para recuperar.
 */
export type Sessao = SessaoEquipe

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Sessao
    user: Sessao
  }
}

const CUSTO_HASH = 10

export async function gerarHash(segredo: string): Promise<string> {
  return bcrypt.hash(segredo, CUSTO_HASH)
}

export async function conferirHash(segredo: string, hash: string): Promise<boolean> {
  return bcrypt.compare(segredo, hash)
}

/** Nome antigo mantido para não quebrar quem já importava. */
export const conferirSenha = conferirHash

/** Exige um token válido de equipe com um dos papéis informados. */
export function exigirPapel(...papeis: PapelEquipe[]) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({ erro: 'Faça login para continuar.' })
    }
    if (req.user.tipo !== 'equipe' || !papeis.includes(req.user.papel)) {
      return reply.code(403).send({ erro: 'Sua conta não tem acesso a esta área.' })
    }
  }
}

/** Só os dígitos: "(92) 99133-4021" e "92991334021" viram a mesma coisa. */
export function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '')
}
