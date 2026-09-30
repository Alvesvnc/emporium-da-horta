import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// O `?worker&url` manda o Vite empacotar o worker como arquivo próprio e
// devolver o endereço dele. Sem isto, o MapLibre calcula o caminho do worker a
// partir de onde ele mesmo está — conta que dá errado depois do empacotamento,
// e worker que não carrega é mapa que desenha só o fundo do estilo.
import urlDoWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

/**
 * Ponto único de entrada do MapLibre.
 *
 * Toda tela que mostra mapa importa daqui, nunca de 'maplibre-gl' direto.
 * Assim a configuração do worker acontece uma vez só, antes de qualquer mapa
 * ser criado, e não há como uma tela nova nascer com o defeito de volta.
 */
setWorkerUrl(urlDoWorker)

export * from 'maplibre-gl'

/**
 * Os tiles vêm do [OpenFreeMap](https://openfreemap.org): OpenStreetMap
 * servido de graça, sem chave e sem limite declarado. Trocar por Mapbox ou
 * MapTiler um dia é mudar esta constante — nenhuma tela sabe de onde vem o
 * desenho.
 */
export const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/liberty'
