import { z } from 'zod'

/** O formato que a API aceita para fechar e consultar um pedido. */

export const corpoNovoPedido = z.object({
  itens: z
    .array(
      z.object({
        produtoId: z.number().int().positive(),
        quantidade: z.number().int().positive().max(999),
      }),
    )
    .max(80),
  contato: z.object({
    nome: z.string().trim().max(120).default(''),
    telefone: z.string().trim().max(40).default(''),
  }),
  endereco: z.object({
    cep: z.string().trim().max(20).default(''),
    bairro: z.string().trim().max(80).default(''),
    rua: z.string().trim().max(160).default(''),
    numero: z.string().trim().max(20).default(''),
    complemento: z.string().trim().max(200).optional().nullable(),
  }),
  formaPagamento: z.enum(['pix', 'cartao', 'dinheiro']),
  /**
   * Com quanto o cliente vai pagar, em reais, quando escolhe dinheiro.
   * Serve para a loja separar o troco ANTES de o motorista sair — na porta do
   * cliente já é tarde.
   */
  pagaCom: z.union([z.string(), z.number()]).optional().nullable(),
  agendamento: z
    .object({
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.').optional().nullable(),
      hora: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida.').optional().nullable(),
    })
    .optional()
    .nullable(),
})

export type NovoPedido = z.infer<typeof corpoNovoPedido>

export const consultaDePedido = {
  params: z.object({ numero: z.coerce.number().int().positive() }),
  query: z.object({ telefone: z.string().trim().min(8) }),
}
