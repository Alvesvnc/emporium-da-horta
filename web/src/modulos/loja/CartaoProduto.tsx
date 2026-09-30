import type { Produto } from '../../comum/api/tipos'
import { useCarrinho } from '../../comum/estado/CarrinhoContexto'
import { brl } from '../../comum/formato/dinheiro'
import { rotuloUnidade } from '../../comum/formato/unidades'

/**
 * Um produto na grade. O botão "Adicionar" vira contador assim que o item
 * entra no carrinho — a mesma área da tela passa a servir para ajustar.
 */
export function CartaoProduto({ produto, indice }: { produto: Produto; indice: number }) {
  const { quantidadeDe, adicionar, remover } = useCarrinho()
  const quantidade = quantidadeDe(produto.id)

  // Os tons alternam para a grade não virar um bloco chapado.
  const fundo = indice % 2 ? 'var(--color-accent-100)' : 'var(--color-accent-2-100)'

  return (
    <article className="produto">
      <div className="miniatura" style={{ background: fundo }}>
        {produto.fotoUrl ? (
          <img src={produto.fotoUrl} alt={produto.nome} loading="lazy" />
        ) : (
          <span style={{ fontSize: 46 }} aria-hidden="true">
            {produto.emoji}
          </span>
        )}
        {produto.oferta && <span className="selo">OFERTA</span>}
      </div>

      <h3 style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, minHeight: 36, margin: 0 }}>
        {produto.nome}
      </h3>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          className="numerico"
          style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-accent-2-900)' }}
        >
          {brl(produto.precoCentavos)}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-neutral-500)' }}>
          /{rotuloUnidade(produto.unidade)}
        </span>
      </div>

      {quantidade > 0 ? (
        <div className="contador">
          <button
            type="button"
            className="contador-menos"
            onClick={() => remover(produto.id)}
            aria-label={`Tirar uma unidade de ${produto.nome}`}
          >
            −
          </button>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-accent-2-900)' }}>
            {quantidade}
          </span>
          <button
            type="button"
            className="contador-mais"
            onClick={() => adicionar(produto.id)}
            aria-label={`Adicionar uma unidade de ${produto.nome}`}
          >
            +
          </button>
        </div>
      ) : (
        <button type="button" className="botao-adicionar" onClick={() => adicionar(produto.id)}>
          Adicionar
        </button>
      )}
    </article>
  )
}
