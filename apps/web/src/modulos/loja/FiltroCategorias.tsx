/** Pílulas de categoria. Grudam abaixo do cabeçalho quando a página rola. */
export function FiltroCategorias({
  opcoes,
  ativa,
  aoEscolher,
}: {
  opcoes: string[]
  ativa: string
  aoEscolher: (nome: string) => void
}) {
  return (
    <div className="categorias">
      {opcoes.map((nome) => (
        <button
          key={nome}
          type="button"
          className="pilula"
          aria-pressed={ativa === nome}
          onClick={() => aoEscolher(nome)}
        >
          {nome}
        </button>
      ))}
    </div>
  )
}
