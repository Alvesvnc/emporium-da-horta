/**
 * Contas de mapa puras: distância, tempo e ordem das paradas.
 *
 * Nada aqui sabe onde fica a Central — quem informa é quem chama, e o valor
 * vem do banco (ver central.ts). Assim este arquivo continua sendo só
 * matemática, testável sem banco e sem configuração.
 */

const RAIO_TERRA_KM = 6371

export type Ponto = { latitude: number; longitude: number }

/** Distância em linha reta entre dois pontos, em quilômetros. */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Ordena as paradas pelo vizinho mais próximo, saindo da Central.
 *
 * É uma heurística: rápida, sempre devolve uma ordem razoável, mas não é o
 * caminho ótimo e ignora o traçado das ruas. Quando a operação crescer, troque
 * esta função por uma chamada ao OSRM (grátis, self-host) ou ao Google
 * Directions — a interface de entrada e saída pode continuar a mesma.
 */
export function ordenarPorVizinhoMaisProximo<T extends Ponto>(
  paradas: readonly T[],
  origem: Ponto,
): Array<T & { distanciaKm: number; ordem: number }> {
  const restantes = [...paradas]
  const ordenadas: Array<T & { distanciaKm: number; ordem: number }> = []
  let atual: Ponto = origem

  while (restantes.length > 0) {
    let melhorIndice = 0
    let melhorDistancia = Number.POSITIVE_INFINITY

    for (let i = 0; i < restantes.length; i++) {
      const candidato = restantes[i]!
      const d = distanciaKm(atual, candidato)
      if (d < melhorDistancia) {
        melhorDistancia = d
        melhorIndice = i
      }
    }

    const escolhida = restantes.splice(melhorIndice, 1)[0]!
    ordenadas.push({
      ...escolhida,
      distanciaKm: Number(melhorDistancia.toFixed(2)),
      ordem: ordenadas.length + 1,
    })
    atual = escolhida
  }

  return ordenadas
}

/**
 * Estimativa grosseira de tempo: a distância em linha reta vira rua real com
 * um fator de desvio, mais o tempo parado em cada entrega.
 */
export function estimarMinutos(distanciaTotalKm: number, paradas: number): number {
  const kmPorRua = distanciaTotalKm * 1.35
  const minutosDirigindo = (kmPorRua / 22) * 60 // 22 km/h médios no trânsito urbano
  const minutosParado = paradas * 6
  return Math.round(minutosDirigindo + minutosParado)
}
