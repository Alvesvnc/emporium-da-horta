/** Número grande com rótulo. Usado nos resumos do painel e da rota. */
export function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="cartao" style={{ borderRadius: 20, padding: '16px 18px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-500)' }}>{rotulo}</div>
      <div
        className="titulo numerico"
        style={{ fontSize: 22, color: 'var(--color-accent-2-900)', marginTop: 4 }}
      >
        {valor}
      </div>
      {nota && (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-500)', marginTop: 2 }}>
          {nota}
        </div>
      )}
    </div>
  )
}
