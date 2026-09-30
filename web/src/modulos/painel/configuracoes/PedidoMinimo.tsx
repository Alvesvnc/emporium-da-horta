import { useState } from 'react'
import { chamar, ErroApi } from '../../../comum/api/http'
import type { Configuracoes } from '../../../comum/api/tipos'
import { paraCampo } from '../../../comum/formato/dinheiro'

/** Valor mínimo para fechar um pedido. Vale na loja e no checkout na hora. */
export function PedidoMinimo({
  config,
  aoSalvar,
}: {
  config: Configuracoes
  aoSalvar: (config: Configuracoes) => void
}) {
  const [texto, setTexto] = useState(paraCampo(config.pedidoMinimoCentavos))
  const [estado, setEstado] = useState<'parado' | 'salvando' | 'salvo'>('parado')
  const [erro, setErro] = useState('')

  async function salvar() {
    setEstado('salvando')
    setErro('')
    try {
      const resposta = await chamar<{ configuracoes: Configuracoes }>('/api/admin/configuracoes', {
        metodo: 'PUT',
        corpo: { pedidoMinimo: texto },
      })
      aoSalvar(resposta.configuracoes)
      setTexto(paraCampo(resposta.configuracoes.pedidoMinimoCentavos))
      setEstado('salvo')
      setTimeout(() => setEstado('parado'), 2500)
    } catch (falha) {
      setEstado('parado')
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui salvar.')
    }
  }

  return (
    <section className="cartao" style={{ gap: 10 }}>
      <h2 className="titulo" style={{ fontSize: 16, color: 'var(--color-accent-2-900)' }}>
        Pedido mínimo
      </h2>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-600)', margin: 0 }}>
        Valor mínimo para o cliente fechar um pedido na loja.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-accent-2-900)' }}>R$</span>
        <input
          className="campo numerico"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void salvar()}
          inputMode="decimal"
          aria-label="Valor do pedido mínimo"
          style={{ width: 110, padding: '11px 18px', fontWeight: 700 }}
        />
        <button
          type="button"
          className="botao botao-verde"
          style={{ padding: '11px 24px', fontSize: 13.5 }}
          onClick={() => void salvar()}
          disabled={estado === 'salvando'}
        >
          {estado === 'salvando' ? 'Salvando…' : 'Salvar'}
        </button>
        {estado === 'salvo' && (
          <span
            style={{
              background: 'var(--color-accent-2-100)',
              color: 'var(--color-accent-2-800)',
              fontSize: 11.5,
              fontWeight: 700,
              padding: '5px 14px',
              borderRadius: 999,
            }}
          >
            já vale na loja e no checkout
          </span>
        )}
      </div>

      {erro && <div className="erro">{erro}</div>}
    </section>
  )
}
