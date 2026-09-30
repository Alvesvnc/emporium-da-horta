import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { buscarCep, cepValido, normalizarCep } from '../../comum/cep.js'

/**
 * Consulta de CEP para o checkout preencher bairro e rua sozinho.
 *
 * Passa pela nossa API em vez de o navegador falar direto com a BrasilAPI:
 * assim o formato da resposta é o nosso, o site não depende de mais um
 * domínio de terceiro, e trocar de provedor um dia não mexe no front.
 */
export async function endpointsEnderecos(app: FastifyInstance) {
  const params = z.object({ cep: z.string().trim().max(12) })

  app.get('/api/cep/:cep', async (req, reply) => {
    const analise = params.safeParse(req.params)
    if (!analise.success || !cepValido(analise.data.cep)) {
      return reply.code(400).send({ erro: 'CEP inválido. Informe os 8 números.' })
    }

    const endereco = await buscarCep(normalizarCep(analise.data.cep))
    if (!endereco) {
      return reply.code(404).send({ erro: 'Não encontrei esse CEP. Preencha o endereço à mão.' })
    }

    return { endereco }
  })
}
