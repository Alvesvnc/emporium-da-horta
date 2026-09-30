/** Título de bloco do formulário, com a etiqueta de obrigatório ou opcional. */
export function SecaoFormulario({
  titulo,
  obrigatorio = false,
}: {
  titulo: string
  obrigatorio?: boolean
}) {
  return (
    <div className="entre" style={{ marginTop: 6, alignItems: 'center' }}>
      <h2 className="titulo" style={{ fontSize: 16, color: 'var(--color-accent-2-900)' }}>
        {titulo}
      </h2>
      <span className={`etiqueta ${obrigatorio ? 'etiqueta-obrigatorio' : 'etiqueta-opcional'}`}>
        {obrigatorio ? 'OBRIGATÓRIO' : 'OPCIONAL'}
      </span>
    </div>
  )
}
