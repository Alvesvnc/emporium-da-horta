import type { Metricas } from '../../../comum/api/tipos'
import { brlCurto } from '../../../comum/formato/dinheiro'

const ALTURA = 148

/** Barras das últimas 8 semanas, com a linha tracejada da meta por cima. */
export function CartaoVendasSemana({
  semanas,
  metaCentavos,
  escalaVenda,
  aoAbrir,
}: {
  semanas: Metricas['semanas']
  metaCentavos: number
  escalaVenda: number
  aoAbrir: () => void
}) {
  const alturaMeta = Math.round((metaCentavos / escalaVenda) * ALTURA)

  return (
    <button type="button" className="indicador" onClick={aoAbrir}>
      <div className="entre" style={{ flexWrap: 'wrap' }}>
        <h3 className="titulo" style={{ fontSize: 16, color: 'var(--color-accent-2-900)' }}>
          Vendas por semana
        </h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-500)' }}>
          meta {brlCurto(metaCentavos)} ·{' '}
          <span style={{ color: 'var(--color-accent-2-700)' }}>ver detalhes ↗</span>
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `calc(23px + ${alturaMeta}px)`,
            borderTop: '2px dashed var(--color-accent-400)',
          }}
        />
        <div className="colunas" style={{ height: ALTURA }}>
          {semanas.map((semana) => (
            <div key={semana.inicio} className="coluna">
              <span
                className="numerico"
                style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-neutral-600)' }}
              >
                {(semana.totalCentavos / 100000).toFixed(1).replace('.', ',')}k
              </span>
              <span
                className="barra"
                style={{
                  height: Math.round((semana.totalCentavos / escalaVenda) * ALTURA),
                  background: semana.ehSemanaAtual
                    ? 'var(--color-accent)'
                    : semana.bateuMeta
                      ? 'var(--color-accent-2)'
                      : 'var(--color-accent-2-300)',
                }}
              />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-neutral-500)' }}>
                {semana.rotulo}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-neutral-500)',
        }}
      >
        <Legenda tracejada>meta semanal</Legenda>
        <Legenda cor="var(--color-accent-2)">acima da meta</Legenda>
        <Legenda cor="var(--color-accent)">semana atual (parcial)</Legenda>
      </div>
    </button>
  )
}

function Legenda({
  cor,
  tracejada = false,
  children,
}: {
  cor?: string
  tracejada?: boolean
  children: React.ReactNode
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {tracejada ? (
        <span style={{ width: 22, borderTop: '2px dashed var(--color-accent-400)' }} />
      ) : (
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: cor }} />
      )}
      {children}
    </span>
  )
}
