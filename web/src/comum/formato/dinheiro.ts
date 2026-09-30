/** 599 → "R$ 5,99" */
export function brl(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** 599 → "5,99" (para preencher campos de formulário) */
export function paraCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

/** 1200000 → "R$ 12 mil" (resumos onde o centavo só atrapalha) */
export function brlCurto(centavos: number): string {
  const reais = centavos / 100
  if (reais >= 1000) return `R$ ${(reais / 1000).toFixed(reais >= 10000 ? 0 : 1).replace('.', ',')} mil`
  return brl(centavos)
}

/** "5,99" → 599, ou null quando não dá para ler como dinheiro. */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/[^\d,.-]/g, '')
  if (!limpo) return null
  const numero = Number(limpo.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  if (!Number.isFinite(numero) || numero < 0) return null
  return Math.round(numero * 100)
}
