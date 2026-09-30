import { useEffect, type ReactNode } from 'react'

/**
 * Caixa que abre por cima da tela. Fecha no botão, no clique fora e no Esc —
 * as três saídas que as pessoas tentam.
 */
export function Janela({
  titulo,
  larguraMaxima = 680,
  aoFechar,
  children,
}: {
  titulo: string
  larguraMaxima?: number
  aoFechar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const naTecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', naTecla)
    return () => window.removeEventListener('keydown', naTecla)
  }, [aoFechar])

  return (
    <div className="cortina" role="dialog" aria-modal="true" aria-label={titulo} onClick={aoFechar}>
      <div
        className="janela"
        style={{ maxWidth: larguraMaxima }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 className="titulo" style={{ fontSize: 19, color: 'var(--color-accent-2-900)' }}>
            {titulo}
          </h3>
          <button type="button" className="botao botao-discreto" onClick={aoFechar}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
