import { brl } from '../../comum/formato/dinheiro'
import type { ItemDoCarrinho } from './checkout.tipos'

/** Lado esquerdo do checkout: o que vai no pedido e quanto dá. */
export function ResumoDoPedido({
  itens,
  subtotalCentavos,
  freteCentavos,
  totalCentavos,
  pedidoMinimoCentavos,
  aoRemover,
}: {
  itens: ItemDoCarrinho[]
  subtotalCentavos: number
  freteCentavos: number
  totalCentavos: number
  pedidoMinimoCentavos: number | null
  aoRemover: (produtoId: number) => void
}) {
  const abaixoDoMinimo =
    pedidoMinimoCentavos !== null && itens.length > 0 && subtotalCentavos < pedidoMinimoCentavos

  return (
    <section className="cartao" style={{ gap: 6 }}>
      <h2 className="titulo" style={{ fontSize: 18, color: 'var(--color-accent-2-900)', marginBottom: 6 }}>
        Resumo do pedido
      </h2>

      {itens.length === 0 && (
        <p className="apagado" style={{ padding: '12px 0', fontSize: 13.5, margin: 0 }}>
          Seu carrinho está vazio.
        </p>
      )}

      {itens.map(({ produto, quantidade }) => (
        <div key={produto.id} className="linha" style={{ padding: '9px 0' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--color-accent-2-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {produto.fotoUrl ? (
              <img
                src={produto.fotoUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              produto.emoji
            )}
          </div>

          <div style={{ flex: 1, fontWeight: 700, fontSize: 13.5 }}>
            {produto.nome}{' '}
            <span style={{ color: 'var(--color-neutral-500)', fontWeight: 600 }}>× {quantidade}</span>
          </div>

          <div className="numerico" style={{ fontWeight: 700, fontSize: 13.5 }}>
            {brl(produto.precoCentavos * quantidade)}
          </div>

          <button
            type="button"
            onClick={() => aoRemover(produto.id)}
            aria-label={`Remover ${produto.nome}`}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--color-accent-700)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      ))}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 600,
          fontSize: 13,
          color: 'var(--color-neutral-600)',
          paddingTop: 10,
        }}
      >
        <span>Subtotal</span>
        <span className="numerico">{brl(subtotalCentavos)}</span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 600,
          fontSize: 13,
          color: 'var(--color-neutral-600)',
        }}
      >
        <span>Entrega</span>
        <span className="numerico">{freteCentavos === 0 ? 'Grátis' : brl(freteCentavos)}</span>
      </div>

      {abaixoDoMinimo && (
        <div
          style={{
            background: 'var(--color-accent-100)',
            color: 'var(--color-accent-700)',
            borderRadius: 12,
            padding: '9px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            marginTop: 4,
          }}
        >
          Pedido mínimo: {brl(pedidoMinimoCentavos!)} — faltam{' '}
          {brl(pedidoMinimoCentavos! - subtotalCentavos)}
        </div>
      )}

      <div
        className="titulo"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 19,
          color: 'var(--color-accent-2-900)',
          paddingTop: 8,
        }}
      >
        <span>Total</span>
        <span className="numerico">{brl(totalCentavos)}</span>
      </div>
    </section>
  )
}
