import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../banco/conexao.js'
import { conferirHash, exigirPapel, type SessaoEquipe } from '../../comum/autenticacao.js'

const credenciais = z.object({
  email: z.string().trim().email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

/** Login da equipe: dono e motorista. O cliente entra por outro caminho. */
export async function endpointsEquipe(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const analise = credenciais.safeParse(req.body)
    if (!analise.success) {
      return reply.code(400).send({ erro: analise.error.issues[0]?.message ?? 'Dados inválidos.' })
    }

    const usuario = await prisma.usuarioEquipe.findUnique({
      where: { email: analise.data.email.toLowerCase() },
    })

    // Mesma resposta para e-mail inexistente e senha errada: quem tenta
    // adivinhar não descobre quais e-mails existem.
    const senhaConfere = usuario ? await conferirHash(analise.data.senha, usuario.senhaHash) : false
    if (!usuario || !usuario.ativo || !senhaConfere) {
      return reply.code(401).send({ erro: 'E-mail ou senha incorretos.' })
    }

    const sessao: SessaoEquipe = {
      tipo: 'equipe',
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
    }

    return { token: app.jwt.sign(sessao, { expiresIn: '12h' }), usuario: sessao }
  })

  /** Confere se o token ainda vale — usado quando a página recarrega. */
  app.get(
    '/api/auth/eu',
    { preHandler: exigirPapel('dono', 'motorista') },
    async (req) => ({ usuario: req.user }),
  )
}
