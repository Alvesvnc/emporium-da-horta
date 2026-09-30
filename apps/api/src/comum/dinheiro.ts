/**
 * Dinheiro no sistema é sempre inteiro, em centavos. Estas funções são a
 * única fronteira entre "5,99" (o que a pessoa digita) e 599 (o que grava).
 */

/** "5,99" | "5.99" | 5.99 → 599. Devolve null se não for um valor válido. */
export function paraCentavos(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) return null
    return Math.round(valor * 100)
  }

  // Aceita "R$ 1.234,56" e "1234.56": tira tudo que não é dígito ou separador,
  // e trata o último separador como o decimal.
  const limpo = valor.trim().replace(/[^\d,.-]/g, '')
  if (!limpo) return null

  const ultimaVirgula = limpo.lastIndexOf(',')
  const ultimoPonto = limpo.lastIndexOf('.')
  const posDecimal = Math.max(ultimaVirgula, ultimoPonto)

  let normalizado: string
  if (posDecimal === -1) {
    normalizado = limpo
  } else {
    const inteiro = limpo.slice(0, posDecimal).replace(/[.,]/g, '')
    const decimal = limpo.slice(posDecimal + 1).replace(/[.,]/g, '')
    normalizado = `${inteiro}.${decimal}`
  }

  const numero = Number(normalizado)
  if (!Number.isFinite(numero) || numero < 0) return null
  return Math.round(numero * 100)
}

/** 599 → "R$ 5,99" */
export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/** 599 → "5,99" (sem o símbolo, para campos de formulário) */
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}
