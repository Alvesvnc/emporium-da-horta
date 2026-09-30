import type { Metricas } from '@emporium/shared'
import { Bolhas } from '../../../comum/componentes/Bolhas'
import { brl } from '../../../comum/formato/dinheiro'
import { sinal } from './metricas.formato'

/** Faixa verde do topo: o número que resume a semana e três apoios. */
export function FaixaResumo({ dados }: { dados: Metricas }) {
  const { resumo, entregas } = dados

  return (
    <section className="faixa">
      <Bolhas variante="faixa" />

      <div style={{ position: 'relative', minWidth: 210 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent-2-300)' }}>
          Vendas da semana
        </div>
        <div
          className="titulo numerico"
          style={{ fontSize: 38, color: 'var(--color-neutral-100)', lineHeight: 1.1, marginTop: 4 }}
        >
          {brl(resumo.vendasSemanaCentavos)}
        </div>
        <div
          style={{
            display: 'inline-block',
            background: 'var(--color-accent-2-100)',
            color: 'var(--color-accent-2-900)',
            fontSize: 12,
            fontWeight: 800,
            padding: '4px 14px',
            borderRadius: 999,
            marginTop: 12,
          }}
        >
          {sinal(resumo.variacaoVendasPercentual)}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          gap: 36,
          flexWrap: 'wrap',
          marginLeft: 'auto',
          paddingRight: 10,
        }}
      >
        <MiniIndicador
          rotulo="Pedidos hoje"
          valor={String(resumo.pedidosHoje)}
          nota={`${resumo.variacaoPedidosDia >= 0 ? '+' : ''}${resumo.variacaoPedidosDia} vs. ontem`}
          positivo={resumo.variacaoPedidosDia >= 0}
        />
        <MiniIndicador
          rotulo="Ticket médio"
          valor={brl(resumo.ticketMedioCentavos)}
          nota={sinal(resumo.variacaoTicketPercentual).replace(' vs. semana anterior', '')}
          positivo={(resumo.variacaoTicketPercentual ?? 0) >= 0}
        />
        <MiniIndicador
          rotulo="Entregas concluídas"
          valor={
            resumo.entregasConcluidasPercentual === null
              ? '—'
              : `${resumo.entregasConcluidasPercentual}%`
          }
          nota={`${entregas.entregues} de ${entregas.total} hoje`}
          positivo
        />
      </div>
    </section>
  )
}

function MiniIndicador({
  rotulo,
  valor,
  nota,
  positivo,
}: {
  rotulo: string
  valor: string
  nota: string
  positivo: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-2-300)' }}>{rotulo}</div>
      <div
        className="titulo numerico"
        style={{ fontSize: 24, color: 'var(--color-neutral-100)', marginTop: 2 }}
      >
        {valor}
      </div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: positivo ? 'var(--color-accent-2-200)' : 'var(--color-accent-300)',
        }}
      >
        {nota}
      </div>
    </div>
  )
}
