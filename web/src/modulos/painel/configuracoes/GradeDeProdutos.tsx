import type { Produto } from '../../../comum/api/tipos'
import { brl } from '../../../comum/formato/dinheiro'
import { rotuloUnidade } from '../../../comum/formato/unidades'

/** Todos os produtos, inclusive os ocultos — que aparecem esmaecidos. */
export function GradeDeProdutos({
  produtos,
  aoEscolher,
}: {
  produtos: Produto[]
  aoEscolher: (id: number) => void
}) {
  return (
    <section className="cartao" style={{ gap: 2 }}>
      <div className="entre" style={{ marginBottom: 8 }}>
        <h2 className="titulo" style={{ fontSize: 16, color: 'var(--color-accent-2-900)' }}>
          Produtos à venda — preço, foto e visibilidade
        </h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-500)' }}>
          {produtos.length} itens
        </span>
      </div>

      <div className="grade-gerencia">
        {produtos.map((produto) => (
          <button
            key={produto.id}
            type="button"
            className="item-gerencia"
            style={{ opacity: produto.oculto ? 0.55 : 1 }}
            onClick={() => aoEscolher(produto.id)}
          >
            <div
              className="miniatura"
              style={{ height: 88, borderRadius: 12, background: 'var(--color-accent-2-100)' }}
            >
              {produto.fotoUrl ? (
                <img src={produto.fotoUrl} alt="" loading="lazy" />
              ) : (
                <span style={{ fontSize: 38 }}>{produto.emoji}</span>
              )}
              {produto.oculto && <span className="selo selo-oculto">OCULTO</span>}
            </div>

            <span style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{produto.nome}</span>

            <span className="entre">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-500)' }}>
                {produto.categoria}
              </span>
              <span
                className="numerico"
                style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-accent-2-900)' }}
              >
                {brl(produto.precoCentavos)}
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-500)' }}>
                  /{rotuloUnidade(produto.unidade)}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="legenda" style={{ paddingTop: 12, margin: 0 }}>
        Clique em um produto para abrir a edição.
      </p>
    </section>
  )
}
