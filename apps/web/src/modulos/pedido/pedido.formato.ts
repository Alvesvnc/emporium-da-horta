import type { PedidoDoCliente } from '@emporium/shared'

/**
 * Como cada estado do pedido aparece para quem comprou.
 *
 * O texto é escrito do ponto de vista do cliente, não do sistema: ele não quer
 * saber que o registro está "em_rota", quer saber que a compra dele saiu para
 * entrega.
 */
export const ESTADO_DO_PEDIDO: Record<
  PedidoDoCliente['status'],
  { texto: string; fundo: string; cor: string }
> = {
  recebido: {
    texto: 'Pedido recebido',
    fundo: 'var(--color-accent-2-100)',
    cor: 'var(--color-accent-2-800)',
  },
  em_separacao: {
    texto: 'Separando sua compra',
    fundo: 'var(--color-accent-2-100)',
    cor: 'var(--color-accent-2-800)',
  },
  em_rota: {
    texto: 'Saiu para entrega',
    fundo: 'var(--color-accent-100)',
    cor: 'var(--color-accent-700)',
  },
  entregue: {
    texto: 'Entregue',
    fundo: 'var(--color-accent-2-100)',
    cor: 'var(--color-accent-2-800)',
  },
  nao_entregue: {
    texto: 'Não conseguimos entregar',
    fundo: '#f6dcd2',
    cor: '#8a2f10',
  },
  cancelado: {
    texto: 'Cancelado',
    fundo: 'var(--color-neutral-200)',
    cor: 'var(--color-neutral-600)',
  },
}
