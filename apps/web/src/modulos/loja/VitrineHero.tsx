import { Bolhas } from '../../comum/componentes/Bolhas'
import { brl } from '../../comum/formato/dinheiro'
import type { Configuracoes } from '@emporium/shared'

/** Faixa de boas-vindas com as regras da loja em uma linha. */
export function VitrineHero({
  primeiroNome,
  configuracoes,
}: {
  primeiroNome: string | undefined
  configuracoes: Configuracoes | null
}) {
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}! Colhido de manhã.` : 'Colhido de manhã.'

  return (
    <section className="vitrine">
      <Bolhas variante="vitrine" />

      <h1 className="titulo" style={{ fontSize: 'clamp(24px, 4vw, 32px)', position: 'relative' }}>
        <span style={{ color: 'var(--color-accent-2-900)' }}>{saudacao}</span>
        <br />
        <span style={{ color: 'var(--color-accent-600)' }}>Na sua porta à tarde.</span>
      </h1>

      {configuracoes && (
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--color-accent-2-800)',
            margin: '10px 0 0',
            position: 'relative',
          }}
        >
          Pedidos até {configuracoes.horaLimitePedido}h chegam no mesmo dia · entrega grátis acima de{' '}
          {brl(configuracoes.entregaGratisAcimaCentavos)} · pedido mínimo{' '}
          {brl(configuracoes.pedidoMinimoCentavos)}
        </p>
      )}
    </section>
  )
}
