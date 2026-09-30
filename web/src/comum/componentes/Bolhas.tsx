/**
 * Círculos decorativos dos fundos verdes. Puro enfeite do design system:
 * não carregam informação nenhuma, por isso ficam fora do fluxo de leitura.
 */
export function Bolhas({ variante }: { variante: 'marca' | 'vitrine' | 'faixa' }) {
  if (variante === 'marca') {
    return (
      <>
        <span
          className="bolha"
          style={{ right: -70, top: -70, width: 220, height: 220, background: 'var(--color-accent-2-700)' }}
        />
        <span
          className="bolha"
          style={{ left: -50, bottom: -80, width: 190, height: 190, background: 'var(--color-accent-2-900)' }}
        />
      </>
    )
  }

  if (variante === 'vitrine') {
    return (
      <>
        <span
          className="bolha"
          style={{ right: -46, top: -52, width: 200, height: 200, background: 'var(--color-accent-2-200)' }}
        />
        <span
          className="bolha"
          style={{ right: 90, bottom: -64, width: 130, height: 130, background: 'var(--color-accent-100)' }}
        />
      </>
    )
  }

  return (
    <>
      <span
        className="bolha"
        style={{ right: -56, top: -64, width: 210, height: 210, background: 'var(--color-accent-2-700)' }}
      />
      <span
        className="bolha"
        style={{ right: 120, bottom: -70, width: 130, height: 130, background: 'var(--color-accent-2-900)' }}
      />
    </>
  )
}
