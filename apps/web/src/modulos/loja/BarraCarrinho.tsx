import { brl } from '../../comum/formato/dinheiro'

/**
 * Barra que sobe do rodapé quando há algo no carrinho. Fica fixa porque o
 * caminho para o checkout precisa estar sempre à mão, sem rolar a página.
 */
export function BarraCarrinho({
  quantidade,
  totalCentavos,
  aoFinalizar,
}: {
  quantidade: number
  totalCentavos: number
  aoFinalizar: () => void
}) {
  if (quantidade === 0) return null

  return (
    <div className="barra-carrinho">
      <button type="button" onClick={aoFinalizar}>
        <span
          style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <span
            style={{
              background: 'var(--color-accent)',
              borderRadius: 999,
              padding: '2px 11px',
              fontSize: 12.5,
              fontWeight: 800,
            }}
          >
            {quantidade}
          </span>
          {quantidade === 1 ? 'item no carrinho' : 'itens no carrinho'}
        </span>
        <span className="numerico" style={{ fontWeight: 800, fontSize: 15 }}>
          Finalizar · {brl(totalCentavos)}
        </span>
      </button>
    </div>
  )
}
