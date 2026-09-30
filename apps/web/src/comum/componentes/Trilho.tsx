/** Barra de proporção. A largura é a única coisa que ela comunica. */
export function Trilho({
  porcentagem,
  cor,
  altura = 7,
}: {
  porcentagem: number
  cor: string
  altura?: number
}) {
  const largura = Math.max(0, Math.min(100, Math.round(porcentagem)))
  return (
    <div className="trilho" style={{ height: altura }}>
      <div style={{ background: cor, width: `${largura}%` }} />
    </div>
  )
}
