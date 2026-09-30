import { useNavigate } from 'react-router-dom'
import { Cabecalho } from '../../comum/componentes/Cabecalho'
import { brl } from '../../comum/formato/dinheiro'
import type { Confirmacao } from './checkout.tipos'

/** O que a pessoa vê depois de fechar o pedido: número, valor e previsão. */
export function TelaPedidoConfirmado({
  confirmacao,
}: {
  confirmacao: Confirmacao
}) {
  const navegar = useNavigate()

  return (
    <div className="aplicacao">
      <Cabecalho subtitulo="Pedido confirmado" />

      <main className="conteudo" style={{ maxWidth: 920, padding: '24px 20px 48px', gap: 16 }}>
        <div
          className="cartao"
          style={{
            borderRadius: 28,
            padding: '42px 26px',
            alignItems: 'center',
            gap: 12,
            textAlign: 'center',
            animation: 'surgir .4s ease',
            maxWidth: 460,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'var(--color-accent-2-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent-2-700)"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12.5l5 5L20 7" />
            </svg>
          </div>

          <h1 className="titulo" style={{ fontSize: 22, color: 'var(--color-accent-2-900)' }}>
            Pedido confirmado
          </h1>

          <p
            style={{
              fontWeight: 600,
              color: 'var(--color-neutral-600)',
              fontSize: 13.5,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Pedido <b style={{ color: 'var(--color-accent-2-900)' }}>#{confirmacao.numero}</b> ·{' '}
            {brl(confirmacao.totalCentavos)}
            <br />
            {confirmacao.previsao}
          </p>

          {/* Sem conta: o número do pedido é a chave. Guardá-lo é o que
              permite acompanhar depois, junto com o telefone da compra. */}
          <button
            type="button"
            className="botao botao-verde"
            style={{ marginTop: 6, padding: '12px 28px', fontSize: 13.5 }}
            onClick={() => navegar(`/pedido?numero=${confirmacao.numero}`)}
          >
            Acompanhar este pedido
          </button>

          <p
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--color-neutral-600)',
              margin: '2px 0 0',
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            Anote o número <b>#{confirmacao.numero}</b>. Com ele e o telefone da compra você
            acompanha a entrega quando quiser — não precisa criar conta.
          </p>

          <button
            type="button"
            className="botao botao-contorno"
            style={{ marginTop: 2, padding: '12px 28px', fontSize: 13.5 }}
            onClick={() => navegar('/')}
          >
            Voltar à loja
          </button>
        </div>
      </main>
    </div>
  )
}
