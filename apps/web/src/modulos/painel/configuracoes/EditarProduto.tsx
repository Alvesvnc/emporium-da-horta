import { useState } from 'react'
import { chamar, ErroApi } from '../../../comum/api/http'
import type { Produto } from '@emporium/shared'
import { Janela } from '../../../comum/componentes/Janela'
import { paraCampo } from '../../../comum/formato/dinheiro'
import { rotuloUnidade } from '../../../comum/formato/unidades'

/**
 * Edição de um produto: preço, foto e visibilidade.
 *
 * Ocultar NUNCA apaga — o produto some da loja e continua aqui e nos pedidos
 * antigos, que precisam dele para mostrar o que foi vendido.
 */
export function EditarProduto({
  produto,
  aoFechar,
  aoMudar,
}: {
  produto: Produto
  aoFechar: () => void
  aoMudar: (produto: Produto) => void
}) {
  const [preco, setPreco] = useState(paraCampo(produto.precoCentavos))
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function aplicar(mudanca: Record<string, unknown>) {
    setOcupado(true)
    setErro('')
    try {
      const resposta = await chamar<{ produto: Produto }>(`/api/admin/produtos/${produto.id}`, {
        metodo: 'PATCH',
        corpo: mudanca,
      })
      aoMudar({ ...resposta.produto, categoria: produto.categoria })
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui salvar.')
    } finally {
      setOcupado(false)
    }
  }

  async function trocarFoto(arquivo: File) {
    setOcupado(true)
    setErro('')
    try {
      const pacote = new FormData()
      pacote.append('foto', arquivo)
      const resposta = await chamar<{ produto: Produto }>(`/api/admin/produtos/${produto.id}/foto`, {
        arquivo: pacote,
      })
      aoMudar({ ...resposta.produto, categoria: produto.categoria })
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui trocar a foto.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Janela titulo="Editar produto" larguraMaxima={400} aoFechar={aoFechar}>
      <div
        className="miniatura"
        style={{ height: 150, borderRadius: 16, background: 'var(--color-accent-2-100)' }}
      >
        {produto.fotoUrl ? (
          <img src={produto.fotoUrl} alt="" />
        ) : (
          <span style={{ fontSize: 56 }}>{produto.emoji}</span>
        )}
        {produto.oculto && <span className="selo selo-oculto">OCULTO DA LOJA</span>}
      </div>

      <div>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{produto.nome}</div>
        <div className="legenda" style={{ marginTop: 2 }}>
          {produto.categoria} · vendido por {rotuloUnidade(produto.unidade)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-accent-2-900)' }}>R$</span>
        <input
          className="campo numerico"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          onBlur={() => preco !== paraCampo(produto.precoCentavos) && void aplicar({ preco })}
          onKeyDown={(e) => e.key === 'Enter' && void aplicar({ preco })}
          inputMode="decimal"
          aria-label="Preço do produto"
          style={{ width: 110, padding: '11px 16px', fontSize: 14.5, textAlign: 'right', fontWeight: 700 }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-neutral-500)' }}>
          /{rotuloUnidade(produto.unidade)}
        </span>
      </div>
      <p className="legenda" style={{ margin: '-8px 0 0' }}>
        O novo preço passa a valer na loja assim que você sai do campo.
      </p>

      <label className="botao botao-contorno" style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>
        Trocar foto
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const arquivo = e.target.files?.[0]
            if (arquivo) void trocarFoto(arquivo)
          }}
          style={{ display: 'none' }}
        />
      </label>

      <button
        type="button"
        className="botao"
        disabled={ocupado}
        onClick={() => void aplicar({ oculto: !produto.oculto })}
        style={{
          padding: 12,
          background: 'none',
          fontWeight: 700,
          fontSize: 13,
          border: `1.5px solid ${produto.oculto ? 'var(--color-accent-2-300)' : 'var(--color-accent-200)'}`,
          color: produto.oculto ? 'var(--color-accent-2-800)' : 'var(--color-accent-700)',
        }}
      >
        {produto.oculto ? 'Mostrar na loja' : 'Ocultar da loja'}
      </button>
      <p className="legenda" style={{ margin: '-8px 0 0' }}>
        Ocultar não apaga nada: o produto some da loja e continua aqui e nos pedidos antigos.
      </p>

      {erro && <div className="erro">{erro}</div>}
    </Janela>
  )
}
