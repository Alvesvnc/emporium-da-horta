import type { Metricas } from '@emporium/shared'
import { rotuloDoDia } from './metricas.formato'

const ALTURA = 74

/** Movimento dos últimos sete dias. Hoje sai em laranja. */
export function CartaoPedidosPorDia({
  dias,
  escalaDia,
  aoAbrir,
}: {
  dias: Metricas['porDia']
  escalaDia: number
  aoAbrir: () => void
}) {
  return (
    <button type="button" className="indicador" onClick={aoAbrir}>
      <div className="entre">
        <h3 className="titulo" style={{ fontSize: 16, color: 'var(--color-accent-2-900)' }}>
          Pedidos por dia — últimos 7
        </h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-2-700)' }}>
          ver detalhes ↗
        </span>
      </div>

      <div className="colunas" style={{ height: 112 }}>
        {dias.map((dia) => (
          <div key={dia.dia} className="coluna">
            <span
              className="numerico"
              style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-neutral-600)' }}
            >
              {dia.pedidos}
            </span>
            <span
              className="barra"
              style={{
                height: Math.round((dia.pedidos / escalaDia) * ALTURA),
                background: dia.ehHoje ? 'var(--color-accent)' : 'var(--color-accent-2-300)',
              }}
            />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-neutral-500)' }}>
              {rotuloDoDia(dia.dia, dia.ehHoje)}
            </span>
          </div>
        ))}
      </div>
    </button>
  )
}
