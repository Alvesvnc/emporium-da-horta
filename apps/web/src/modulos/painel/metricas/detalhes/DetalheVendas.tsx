import type { Metricas } from '@emporium/shared'
import { Trilho } from '../../../../comum/componentes/Trilho'
import { brl, brlCurto } from '../../../../comum/formato/dinheiro'

/** Semana a semana, com a diferença para a meta em cada linha. */
export function DetalheVendas({
  semanas,
  metaCentavos,
  escalaVenda,
}: {
  semanas: Metricas['semanas']
  metaCentavos: number
  escalaVenda: number
}) {
  const total = semanas.reduce((soma, s) => soma + s.totalCentavos, 0)

  return (
    <>
      {semanas.map((semana) => {
        const diferenca = semana.totalCentavos - metaCentavos
        const cor = semana.ehSemanaAtual
          ? 'var(--color-accent)'
          : semana.bateuMeta
            ? 'var(--color-accent-2)'
            : 'var(--color-accent-2-300)'

        return (
          <div key={semana.inicio} className="linha" style={{ padding: '9px 0' }}>
            <span style={{ width: 118, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              Semana {semana.rotulo.replace('S', '')}
              {semana.ehSemanaAtual ? ' (atual)' : ''}
            </span>

            <div style={{ flex: 1 }}>
              <Trilho porcentagem={(semana.totalCentavos / escalaVenda) * 100} cor={cor} altura={12} />
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
              {brl(semana.totalCentavos)}
            </span>

            <span
              style={{
                width: 118,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 800,
                padding: '4px 0',
                borderRadius: 999,
                flexShrink: 0,
                background:
                  semana.ehSemanaAtual || diferenca < 0
                    ? 'var(--color-accent-100)'
                    : 'var(--color-accent-2-100)',
                color:
                  semana.ehSemanaAtual || diferenca < 0
                    ? 'var(--color-accent-700)'
                    : 'var(--color-accent-2-800)',
              }}
            >
              {semana.ehSemanaAtual
                ? 'parcial'
                : `${diferenca >= 0 ? '+' : '−'} ${brlCurto(Math.abs(diferenca))}`}
            </span>
          </div>
        )
      })}

      <div className="resumo-faixa">
        <span>Total do período: {brl(total)}</span>
        <span>Média semanal: {brl(Math.round(total / (semanas.length || 1)))}</span>
        <span>Meta: {brlCurto(metaCentavos)}/semana</span>
      </div>
    </>
  )
}
