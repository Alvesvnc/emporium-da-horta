/** Busca por nome do produto, com a lupa desenhada em SVG. */
export function CampoBusca({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', maxWidth: 440 }}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-neutral-500)"
        strokeWidth="2.75"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)' }}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        className="campo"
        type="search"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder="Buscar produtos"
        aria-label="Buscar produtos"
        style={{ padding: '13px 20px 13px 44px' }}
      />
    </div>
  )
}
