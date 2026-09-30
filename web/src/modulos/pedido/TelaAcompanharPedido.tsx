import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { chamar, ErroApi } from '../../comum/api/http'
import { Cabecalho } from '../../comum/componentes/Cabecalho'
import { brl } from '../../comum/formato/dinheiro'
import { formatarTelefone } from '../../comum/formato/telefone'
import { rotuloUnidade } from '../../comum/formato/unidades'
import type { PedidoDoCliente } from '../../comum/api/tipos'
import { ESTADO_DO_PEDIDO } from './pedido.formato'

/**
 * Acompanhar um pedido sem ter conta nenhuma.
 *
 * A loja não cadastra cliente: ele compra informando nome, telefone e endereço,
 * e volta aqui com o número do pedido. O telefone é pedido junto porque só o
 * número seria um convite a ler o pedido dos outros chutando sequência — e a
 * conferência acontece no servidor, não aqui.
 *
 * O número chega pela URL quando a pessoa vem da tela de confirmação, então o
 * caminho comum é digitar só o telefone.
 */
export function TelaAcompanharPedido() {
  const [parametros] = useSearchParams()

  const [numero, setNumero] = useState(parametros.get('numero') ?? '')
  const [telefone, setTelefone] = useState('')
  const [pedido, setPedido] = useState<PedidoDoCliente | null>(null)
  const [erro, setErro] = useState('')
  const [buscando, setBuscando] = useState(false)

  async function procurar() {
    const digitos = numero.replace(/\D/g, '')
    if (!digitos) return setErro('Informe o número do pedido.')
    if (telefone.replace(/\D/g, '').length < 10) return setErro('Informe o telefone do pedido.')

    setBuscando(true)
    setErro('')
    try {
      const resposta = await chamar<{ pedido: PedidoDoCliente; itens: PedidoDoCliente['itens'] }>(
        `/api/pedidos/${digitos}?telefone=${encodeURIComponent(telefone)}`,
      )
      setPedido({ ...resposta.pedido, itens: resposta.itens })
    } catch (falha) {
      setPedido(null)
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui buscar o pedido.')
    } finally {
      setBuscando(false)
    }
  }

  const estado = pedido ? ESTADO_DO_PEDIDO[pedido.status] : null

  return (
    <div className="aplicacao">
      <Cabecalho subtitulo="Acompanhar pedido" area="loja" />

      <main className="conteudo" style={{ maxWidth: 620, gap: 16 }}>
        <section className="cartao" style={{ gap: 12 }}>
          <div>
            <h1 className="titulo" style={{ fontSize: 20, color: 'var(--color-accent-2-900)' }}>
              Acompanhar pedido
            </h1>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-neutral-600)',
                margin: '4px 0 0',
              }}
            >
              Informe o número do pedido e o telefone que você usou na compra.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8 }}>
            <input
              className="campo numerico"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Nº"
              inputMode="numeric"
              maxLength={10}
              style={{ padding: '12px 18px' }}
            />
            <input
              className="campo"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && void procurar()}
              placeholder="Telefone do pedido"
              inputMode="tel"
              style={{ padding: '12px 18px' }}
            />
          </div>

          <button
            type="button"
            className="botao botao-verde"
            onClick={() => void procurar()}
            disabled={buscando}
            style={{ padding: 13 }}
          >
            {buscando ? 'Procurando…' : 'Ver meu pedido'}
          </button>

          {erro && <div className="erro">{erro}</div>}
        </section>

        {pedido && estado && (
          <section className="cartao" style={{ gap: 12 }}>
            <div className="entre">
              <h2 className="titulo" style={{ fontSize: 17, color: 'var(--color-accent-2-900)' }}>
                Pedido #{pedido.numero}
              </h2>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '5px 15px',
                  borderRadius: 999,
                  background: estado.fundo,
                  color: estado.cor,
                  whiteSpace: 'nowrap',
                }}
              >
                {estado.texto}
              </span>
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-600)', margin: 0 }}>
              {pedido.rua}, {pedido.numeroEndereco}
              {pedido.complemento && ` · ${pedido.complemento}`} — {pedido.bairro}
            </p>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {pedido.itens.map((item) => (
                <li
                  key={item.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}
                >
                  <span style={{ fontSize: 17 }}>{item.emojiProduto}</span>
                  <span style={{ flex: 1 }}>{item.nomeProduto}</span>
                  <span className="legenda numerico">
                    {item.quantidade} {rotuloUnidade(item.unidade)}
                  </span>
                  <span className="numerico" style={{ fontWeight: 700 }}>
                    {brl(item.subtotalCentavos)}
                  </span>
                </li>
              ))}
            </ul>

            <div
              style={{
                borderTop: '1px solid var(--color-neutral-200)',
                paddingTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              <span>Total</span>
              <span className="numerico">{brl(pedido.totalCentavos)}</span>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
