import type { Metricas } from '@emporium/shared'
import { Trilho } from '../../../../comum/componentes/Trilho'
import { brl } from '../../../../comum/formato/dinheiro'
import { rotuloDoDia } from '../metricas.formato'

/** Dia a dia, com a variação em relação ao dia anterior. */
export function DetalhePedidosPorDia({
  dias,
  escalaDia,
}: {
  dias: Metricas['porDia']
  escalaDia: number
}) {
  const totalPedidos = dias.reduce((soma, d) => soma + d.pedidos, 0)
  const faturamento = dias.reduce((soma, d) => soma + d.totalCentavos, 0)

  return (
    <>
      {dias.map((dia, i) => {
        const anterior = i === 0 ? null : dias[i - 1]!.pedidos
        const diferenca = anterior === null ? null : dia.pedidos - anterior

        return (
          <div key={dia.dia} className="linha" style={{ padding: '9px 0' }}>
            <span style={{ width: 56, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {rotuloDoDia(dia.dia, dia.ehHoje)}
            </span>

            <div style={{ flex: 1 }}>
              <Trilho
                porcentagem={(dia.pedidos / escalaDia) * 100}
                cor={dia.ehHoje ? 'var(--color-accent)' : 'var(--color-accent-2-300)'}
                altura={12}
              />
            </div>

            <span
              className="numerico"
              style={{
                width: 96,
                textAlign: 'right',
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--color-accent-2-900)',
                flexShrink: 0,
              }}
            >
              {dia.pedidos} pedidos
            </span>

            <span
              style={{
                width: 108,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 800,
                padding: '4px 0',
                borderRadius: 999,
                flexShrink: 0,
                background:
                  diferenca === null
                    ? 'var(--color-neutral-200)'
                    : diferenca >= 0
                      ? 'var(--color-accent-2-100)'
                      : 'var(--color-accent-100)',
                color:
                  diferenca === null
                    ? 'var(--color-neutral-600)'
                    : diferenca >= 0
                      ? 'var(--color-accent-2-800)'
                      : 'var(--color-accent-700)',
              }}
            >
              {diferenca === null ? '—' : `${diferenca >= 0 ? '+' : '−'}${Math.abs(diferenca)} vs. anterior`}
            </span>
          </div>
        )
      })}

      <div className="resumo-faixa">
        <span>Total: {totalPedidos} pedidos</span>
        <span>Média: {Math.round(totalPedidos / (dias.length || 1))}/dia</span>
        <span>Faturamento: {brl(faturamento)}</span>
      </div>
    </>
  )
}
