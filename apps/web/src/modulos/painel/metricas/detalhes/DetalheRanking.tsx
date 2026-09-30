import type { Metricas } from '@emporium/shared'
import { Trilho } from '../../../../comum/componentes/Trilho'
import { brl } from '../../../../comum/formato/dinheiro'
import { rotuloUnidade } from '../../../../comum/formato/unidades'

/** Ranking completo dos produtos, com unidades e receita dos últimos 7 dias. */
export function DetalheRanking({
  produtos,
  escalaProduto,
}: {
  produtos: Metricas['maisVendidos']
  escalaProduto: number
}) {
  return (
    <>
      {produtos.map((produto, i) => (
        <div key={`${produto.nome}-${i}`} className="linha" style={{ padding: '7px 0' }}>
          <span
            style={{
              width: 30,
              fontWeight: 800,
              fontSize: 13,
              flexShrink: 0,
              color: i < 3 ? 'var(--color-accent-700)' : 'var(--color-neutral-400)',
            }}
          >
            {i + 1}º
          </span>

          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--color-accent-2-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {produto.emoji}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {produto.nome}
            </div>
            <div style={{ marginTop: 4 }}>
              <Trilho
                porcentagem={(produto.unidadesVendidas / escalaProduto) * 100}
                cor="var(--color-accent-2)"
                altura={6}
              />
            </div>
          </div>

          <span
            className="numerico"
            style={{
              width: 86,
              textAlign: 'right',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-neutral-600)',
              flexShrink: 0,
            }}
          >
            {produto.unidadesVendidas} {rotuloUnidade(produto.unidade)}
          </span>

          <span
            className="numerico"
            style={{
              width: 92,
              textAlign: 'right',
              fontSize: 12.5,
              fontWeight: 800,
              color: 'var(--color-accent-2-900)',
              flexShrink: 0,
            }}
          >
            {brl(produto.receitaCentavos)}
          </span>
        </div>
      ))}

      <p className="legenda" style={{ margin: 0 }}>
        Unidades vendidas e receita dos últimos 7 dias, somadas dos pedidos.
      </p>
    </>
  )
}
