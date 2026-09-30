/** Contas de mapa no navegador. A API tem as suas; estas servem ao que muda ao vivo. */

const RAIO_TERRA_KM = 6371

export type Ponto = { latitude: number; longitude: number }

/**
 * Distância em linha reta, em quilômetros.
 *
 * É a distância do passarinho, não a da rua — serve para "estou perto?", não
 * para prever quanto falta dirigindo. Quem calcula a rota de verdade é o
 * servidor; isto aqui roda a cada leitura do GPS e precisa ser instantâneo.
 */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (grau: number) => (grau * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** "850 m" perto, "2,4 km" longe — a unidade que faz sentido na distância. */
export function distanciaCurta(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

/** "em 300 m", "em 1,2 km" — arredondado como quem fala, não como quem mede. */
export function metrosFalados(metros: number): string {
  if (metros < 30) return 'agora'
  if (metros < 100) return `em ${Math.round(metros / 10) * 10} metros`
  if (metros < 1000) return `em ${Math.round(metros / 50) * 50} metros`
  const km = metros / 1000
  return `em ${km.toFixed(1).replace('.', ',')} quilômetros`
}

export type ProjecaoNaRota = {
  /** Distância da posição até o traçado. Grande = o motorista saiu do caminho. */
  desvioMetros: number
  /** Quanto do traçado já ficou para trás. */
  percorridosMetros: number
  /** Quanto falta até o fim do traçado. */
  restantesMetros: number
}

/**
 * Onde a posição do motorista cai sobre o traçado da rota.
 *
 * É a conta que sustenta a navegação inteira: de quanto ele já andou saem a
 * manobra da vez e a distância até ela; do quanto ele está afastado da linha
 * sai a decisão de recalcular o caminho.
 *
 * Projeta para metros com aproximação plana antes de medir. Em escala de
 * cidade o erro é desprezível, e faz a conta virar geometria de plano — que
 * roda a cada leitura do GPS sem pesar no aparelho.
 */
export function projetarNaRota(
  posicao: Ponto,
  tracado: Array<[number, number]>,
): ProjecaoNaRota | null {
  if (tracado.length < 2) return null

  const [latRef, lonRef] = tracado[0]!
  const metrosPorGrauLat = 111_320
  const metrosPorGrauLon = 111_320 * Math.cos((latRef * Math.PI) / 180)

  const paraPlano = (lat: number, lon: number): [number, number] => [
    (lon - lonRef) * metrosPorGrauLon,
    (lat - latRef) * metrosPorGrauLat,
  ]

  const [px, py] = paraPlano(posicao.latitude, posicao.longitude)

  let melhorDesvio = Number.POSITIVE_INFINITY
  let melhorPercorrido = 0
  let acumulado = 0

  for (let i = 0; i < tracado.length - 1; i++) {
    const [ax, ay] = paraPlano(tracado[i]![0], tracado[i]![1])
    const [bx, by] = paraPlano(tracado[i + 1]![0], tracado[i + 1]![1])

    const dx = bx - ax
    const dy = by - ay
    const comprimento = Math.hypot(dx, dy)

    // Onde no segmento cai a projeção da posição, entre 0 (início) e 1 (fim).
    const t =
      comprimento === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (comprimento * comprimento)))

    const desvio = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    if (desvio < melhorDesvio) {
      melhorDesvio = desvio
      melhorPercorrido = acumulado + t * comprimento
    }

    acumulado += comprimento
  }

  return {
    desvioMetros: melhorDesvio,
    percorridosMetros: melhorPercorrido,
    restantesMetros: Math.max(0, acumulado - melhorPercorrido),
  }
}
