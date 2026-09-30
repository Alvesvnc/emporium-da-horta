import { useEffect, useRef, useState } from 'react'
import type { RespostaRota } from '@emporium/shared'
import type { PosicaoAoVivo } from '../../comum/ganchos/useLocalizacaoAoVivo'
import {
  ESTILO_MAPA,
  GeoJSONSource,
  LngLatBounds,
  Map as MapaGL,
  Marker,
  NavigationControl,
  Popup,
} from '../../comum/mapa/maplibre'

/**
 * O mapa da rota, com ruas de verdade.
 *
 * A biblioteca é o MapLibre, que é o Mapbox GL de antes da licença fechar.
 * Mesma tecnologia, sem amarração de fornecedor.
 */

const COR_ROTA = '#56633f' // --color-accent-2-700
const COR_PARADA = '#c67139' // --color-accent
const COR_CENTRAL = '#272e1b' // --color-accent-2-900

/** Pino desenhado à mão: o do MapLibre não aceita número dentro. */
function criarPino(rotulo: string, cor: string, tracejado: boolean): HTMLElement {
  const pino = document.createElement('div')
  pino.textContent = rotulo
  Object.assign(pino.style, {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: cor,
    color: '#f9f4ed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '12px',
    // Borda tracejada = endereço aproximado. O motorista vê de relance em
    // qual pino não pode confiar de olhos fechados.
    border: `2.5px ${tracejado ? 'dashed' : 'solid'} #f9f4ed`,
    boxShadow: '0 1px 4px rgba(46,43,37,.4)',
  })
  return pino
}

/** O ponto do motorista: bolinha azul com um halo que pulsa, como todo mapa faz. */
function criarPontoDoMotorista(): HTMLElement {
  const ponto = document.createElement('div')
  ponto.className = 'ponto-motorista'
  ponto.innerHTML = '<span class="ponto-motorista-halo"></span><span class="ponto-motorista-nucleo"></span>'
  return ponto
}

/**
 * O círculo de incerteza do GPS, como polígono.
 *
 * Vira polígono em vez de círculo de tela porque precisão é medida em metros:
 * um círculo de raio fixo em pixels mentiria em cada nível de zoom. Assim o
 * motorista vê do tamanho real a dúvida do aparelho — e entende sozinho por
 * que o sistema não afirma que ele chegou.
 */
function circuloDePrecisao(
  latitude: number,
  longitude: number,
  raioMetros: number,
): Array<[number, number]> {
  const LADOS = 48
  const grausPorMetroLat = 1 / 111_320
  const grausPorMetroLon = 1 / (111_320 * Math.cos((latitude * Math.PI) / 180))

  return Array.from({ length: LADOS + 1 }, (_, i) => {
    const angulo = (i / LADOS) * 2 * Math.PI
    return [
      longitude + raioMetros * grausPorMetroLon * Math.cos(angulo),
      latitude + raioMetros * grausPorMetroLat * Math.sin(angulo),
    ] as [number, number]
  })
}

export function MapaDaRota({
  rota,
  paradaEmFoco,
  posicao,
  seguindo = false,
  caminho = null,
}: {
  rota: RespostaRota
  paradaEmFoco?: number
  /** Onde o motorista está agora, quando ele ligou o GPS. */
  posicao?: PosicaoAoVivo | null
  /** Com o GPS ligado, o mapa acompanha o motorista em vez da parada. */
  seguindo?: boolean
  /** Traçado da navegação em curso, em [latitude, longitude]. */
  caminho?: Array<[number, number]> | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaGL | null>(null)
  const pinos = useRef<Marker[]>([])
  const pontoMotorista = useRef<Marker | null>(null)

  // Lido dentro do efeito de desenho sem entrar nas dependências dele: mudar o
  // modo de seguir não deve redesenhar traçado e pinos.
  const seguindoRef = useRef(seguindo)
  seguindoRef.current = seguindo

  /**
   * `pronto` separa "o mapa existe" de "o estilo carregou". Desenhar antes do
   * estilo estar pronto estoura, e mapa em branco sem explicação é o pior
   * defeito possível — por isso `falha` aparece na tela em vez de só no console.
   */
  const [pronto, setPronto] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  // ── Ciclo de vida do mapa ────────────────────────────────────
  useEffect(() => {
    const alvo = container.current
    if (!alvo) return

    const instancia = new MapaGL({
      container: alvo,
      style: ESTILO_MAPA,
      center: [rota.central.longitude, rota.central.latitude],
      zoom: 11,
      attributionControl: { compact: true },
    })
    mapa.current = instancia
    instancia.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    instancia.on('load', () => setPronto(true))
    instancia.on('error', (evento) => {
      const mensagem = evento?.error?.message ?? 'erro desconhecido ao carregar o mapa'
      console.error('[mapa]', mensagem, evento)
      setFalha(mensagem)
    })

    /**
     * O canvas nasce do tamanho que o container tinha no momento da criação.
     * Se o CSS ainda não pintou — comum quando o componente entra por
     * carregamento sob demanda — ele nasce com zero e fica branco para sempre.
     * O observador conserta isso e também cobre girar o celular.
     */
    const observador = new ResizeObserver(() => instancia.resize())
    observador.observe(alvo)

    return () => {
      observador.disconnect()
      instancia.remove()
      mapa.current = null
      // O mapa levou os marcadores junto; a referência ficaria apontando para
      // um pino que não existe mais.
      pontoMotorista.current = null
      setPronto(false)
    }
  }, [rota.central.latitude, rota.central.longitude])

  // ── Traçado e pinos ──────────────────────────────────────────
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !pronto) return

    // A geometria vem [lat, lon]; o GeoJSON quer [lon, lat].
    const linha = rota.geometria.map(([lat, lon]) => [lon, lat])
    const dados = {
      type: 'FeatureCollection' as const,
      features: linha.length
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'LineString' as const, coordinates: linha },
            },
          ]
        : [],
    }

    const fonte = instancia.getSource('rota') as GeoJSONSource | undefined
    if (fonte) {
      fonte.setData(dados)
    } else {
      instancia.addSource('rota', { type: 'geojson', data: dados })
      instancia.addLayer({
        id: 'rota-borda',
        type: 'line',
        source: 'rota',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#f9f4ed', 'line-width': 8, 'line-opacity': 0.9 },
      })
      instancia.addLayer({
        id: 'rota-linha',
        type: 'line',
        source: 'rota',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': COR_ROTA,
          'line-width': 4,
          // Sem serviço de rotas a linha é reta entre pontos: tracejada, para
          // ninguém confundir com caminho de verdade.
          'line-dasharray': rota.provedor === 'linha-reta' ? [2, 1.5] : [1],
        },
      })
    }

    for (const pino of pinos.current) pino.remove()
    pinos.current = []

    pinos.current.push(
      new Marker({ element: criarPino('C', COR_CENTRAL, false) })
        .setLngLat([rota.central.longitude, rota.central.latitude])
        .setPopup(new Popup({ offset: 18 }).setText(rota.central.nome))
        .addTo(instancia),
    )

    for (const parada of rota.paradas) {
      pinos.current.push(
        new Marker({ element: criarPino(String(parada.ordem), COR_PARADA, parada.precisao !== 'exata') })
          .setLngLat([parada.longitude, parada.latitude])
          .setPopup(new Popup({ offset: 18 }).setText(`${parada.cliente} — ${parada.bairro}`))
          .addTo(instancia),
      )
    }

    // ── Enquadramento ──────────────────────────────────────────
    // Enquanto o mapa segue o motorista, quem manda no enquadramento é ele:
    // reenquadrar a rota inteira a cada entrega tiraria o mapa de baixo dele.
    const pontos: Array<[number, number]> = [
      [rota.central.longitude, rota.central.latitude],
      ...rota.paradas.map((p) => [p.longitude, p.latitude] as [number, number]),
    ]
    if (!seguindoRef.current && pontos.length > 1) {
      const limites = pontos.reduce(
        (caixa, ponto) => caixa.extend(ponto),
        new LngLatBounds(pontos[0], pontos[0]),
      )
      instancia.fitBounds(limites, { padding: 56, maxZoom: 14, duration: 0 })
    }
  }, [rota, pronto])

  /**
   * O caminho da navegação em curso.
   *
   * Vai por cima da rota do dia, em azul e mais grosso: durante a navegação é
   * ele que importa, e a rota do dia vira contexto. Camada própria para que
   * ligar e desligar a navegação não redesenhe o resto do mapa.
   */
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !pronto) return

    const dados = {
      type: 'FeatureCollection' as const,
      features: caminho?.length
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'LineString' as const,
                coordinates: caminho.map(([lat, lon]) => [lon, lat]),
              },
            },
          ]
        : [],
    }

    const fonte = instancia.getSource('caminho') as GeoJSONSource | undefined
    if (fonte) {
      fonte.setData(dados)
      return
    }

    instancia.addSource('caminho', { type: 'geojson', data: dados })
    instancia.addLayer({
      id: 'caminho-borda',
      type: 'line',
      source: 'caminho',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#f9f4ed', 'line-width': 11, 'line-opacity': 0.95 },
    })
    instancia.addLayer({
      id: 'caminho-linha',
      type: 'line',
      source: 'caminho',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#2f6fd0', 'line-width': 6 },
    })
  }, [caminho, pronto])

  // ── Onde o motorista está agora ──────────────────────────────
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !pronto) return

    if (!posicao) {
      pontoMotorista.current?.remove()
      pontoMotorista.current = null
      const vazio = instancia.getSource('precisao-gps') as GeoJSONSource | undefined
      vazio?.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    const aqui: [number, number] = [posicao.longitude, posicao.latitude]

    if (pontoMotorista.current) {
      pontoMotorista.current.setLngLat(aqui)
    } else {
      pontoMotorista.current = new Marker({ element: criarPontoDoMotorista() })
        .setLngLat(aqui)
        .addTo(instancia)
    }

    const circulo = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [circuloDePrecisao(posicao.latitude, posicao.longitude, posicao.precisaoMetros)],
          },
        },
      ],
    }

    const fonte = instancia.getSource('precisao-gps') as GeoJSONSource | undefined
    if (fonte) {
      fonte.setData(circulo)
    } else {
      instancia.addSource('precisao-gps', { type: 'geojson', data: circulo })
      // Abaixo dos pinos das paradas: é contexto, não informação principal.
      instancia.addLayer({
        id: 'precisao-gps-area',
        type: 'fill',
        source: 'precisao-gps',
        paint: { 'fill-color': '#2f6fd0', 'fill-opacity': 0.12 },
      })
    }
  }, [posicao, pronto])

  /**
   * Para onde o mapa olha.
   *
   * Com o GPS ligado, quem manda é o motorista: o mapa anda com ele. Sem GPS,
   * centraliza na parada da vez. Os dois juntos brigariam pelo enquadramento a
   * cada leitura do aparelho.
   */
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !pronto) return

    if (seguindo && posicao) {
      instancia.easeTo({ center: [posicao.longitude, posicao.latitude], zoom: 16, duration: 700 })
      return
    }

    const parada = rota.paradas.find((p) => p.pedidoId === paradaEmFoco)
    if (!parada) return
    instancia.easeTo({ center: [parada.longitude, parada.latitude], zoom: 14, duration: 600 })
  }, [paradaEmFoco, rota.paradas, pronto, seguindo, posicao])

  return (
    <div className="mapa-real">
      <div ref={container} className="mapa-tela" />

      {falha && (
        <div className="aviso-falha">
          O mapa não carregou: {falha}. As paradas e a navegação continuam funcionando.
        </div>
      )}

      {!falha && rota.resumo.aproximadas > 0 && (
        <p className="legenda mapa-nota">
          {rota.resumo.aproximadas} parada(s) com endereço aproximado — pino de borda tracejada.
        </p>
      )}
    </div>
  )
}
