const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "2026-09-08" → "seg". O dia de hoje ganha nome próprio. */
export function rotuloDoDia(iso: string, ehHoje: boolean): string {
  if (ehHoje) return 'Hoje'
  const [ano, mes, dia] = iso.split('-').map(Number)
  const data = new Date(ano!, (mes ?? 1) - 1, dia ?? 1)
  return DIAS_CURTOS[data.getDay()] ?? iso
}

/** Variação percentual com seta e sinal, ou o aviso de que não há com o quê comparar. */
export function sinal(valor: number | null, sufixo = '%'): string {
  if (valor === null) return 'sem base de comparação'
  const seta = valor >= 0 ? '▲' : '▼'
  return `${seta} ${valor >= 0 ? '+' : ''}${valor}${sufixo} vs. semana anterior`
}

/** Escalas dos gráficos: o maior valor de cada série define a altura cheia. */
export type Escalas = {
  venda: number
  dia: number
  produto: number
}
