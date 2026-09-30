import type { Metricas } from '../../../comum/api/tipos'
import { Trilho } from '../../../comum/componentes/Trilho'
import { rotuloUnidade } from '../../../comum/formato/unidades'

/** Os seis produtos que mais saíram na semana, com barra de participação. */
export function CartaoMaisVendidos({
  produtos,
  escalaProduto,
  aoAbrir,
}: {
  produtos: Metricas['maisVendidos']
  escalaProduto: number
  aoAbrir: () => void
}) {
  const topSeis = produtos.slice(0, 6)

  return (
    <button type="button" className="indicador" style={{ gap: 12 }} onClick={aoAbrir}>
      <div className="entre">
        <h3 className="titulo" style={{ fontSize: 16, color: 'var(--color-accent-2-900)' }}>
          Mais vendidos da semana
        </h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-2-700)' }}>
          ver detalhes ↗
        </span>
      </div>

      {topSeis.length === 0 && <p className="apagado">Nenhuma venda nos últimos 7 dias.</p>}

      {topSeis.map((produto, i) => (
        <div key={`${produto.nome}-${i}`} className="linha">
          <span
            style={{
              width: 20,
              fontWeight: 800,
              fontSize: 13,
              color: i === 0 ? 'var(--color-accent-700)' : 'var(--color-neutral-400)',
            }}
          >
            {i + 1}
          </span>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--color-accent-2-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              flexShrink: 0,
            }}
          >
            {produto.emoji}
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
              <span
                style={{
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {produto.nome}
              </span>
              <span
                className="numerico"
                style={{ color: 'var(--color-neutral-600)', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {produto.unidadesVendidas} {rotuloUnidade(produto.unidade)}
              </span>
            </div>
            <Trilho
              porcentagem={(produto.unidadesVendidas / escalaProduto) * 100}
              cor="var(--color-accent-2)"
            />
          </div>
        </div>
      ))}
    </button>
  )
}
