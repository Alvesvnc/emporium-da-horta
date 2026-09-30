import { useEffect, useRef, useState } from 'react'
import { ESTILO_MAPA, Map as MapaGL, Marker, NavigationControl } from '../mapa/maplibre'

/**
 * Mapa pequeno com um pino que se arrasta.
 *
 * Existe porque geocodificação erra. Em Manaus erra bastante: rua sem número
 * no mapa aberto, conjunto que o serviço não conhece, CEP que devolve o centro
 * do bairro. Deixar o dono arrastar o pino é a diferença entre "mais ou menos
 * ali" e o portão certo — e a sede errada estraga o cálculo de todas as
 * entregas do dia.
 *
 * Clicar no mapa também move o pino: no celular é mais fácil que arrastar.
 */
export function SeletorDePonto({
  latitude,
  longitude,
  aoMover,
}: {
  latitude: number
  longitude: number
  aoMover: (latitude: number, longitude: number) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaGL | null>(null)
  const pino = useRef<Marker | null>(null)
  const [falha, setFalha] = useState<string | null>(null)

  // `aoMover` costuma ser uma função nova a cada render. Guardada numa ref, o
  // mapa não precisa ser recriado só porque o componente pai redesenhou.
  const aoMoverRef = useRef(aoMover)
  aoMoverRef.current = aoMover

  useEffect(() => {
    const alvo = container.current
    if (!alvo) return

    const instancia = new MapaGL({
      container: alvo,
      style: ESTILO_MAPA,
      center: [longitude, latitude],
      zoom: 16,
      attributionControl: { compact: true },
    })
    mapa.current = instancia
    instancia.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    instancia.on('error', (evento) => {
      setFalha(evento?.error?.message ?? 'erro desconhecido ao carregar o mapa')
    })

    // Sem isto o canvas nasce com tamanho zero quando o cartão ainda não foi
    // pintado, e o mapa fica em branco para sempre.
    const observador = new ResizeObserver(() => instancia.resize())
    observador.observe(alvo)

    const marcador = new Marker({ draggable: true, color: '#c67139' })
      .setLngLat([longitude, latitude])
      .addTo(instancia)
    marcador.on('dragend', () => {
      const { lat, lng } = marcador.getLngLat()
      aoMoverRef.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)))
    })
    pino.current = marcador

    instancia.on('click', (evento) => {
      const { lat, lng } = evento.lngLat
      marcador.setLngLat([lng, lat])
      aoMoverRef.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)))
    })

    return () => {
      observador.disconnect()
      instancia.remove()
      mapa.current = null
      pino.current = null
    }
    // Só na montagem: mover o pino depois é trabalho do efeito abaixo, que não
    // recria o mapa nem perde o zoom que o dono ajustou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Coordenada trocada de fora (o dono clicou em "Localizar pelo endereço").
  useEffect(() => {
    if (!mapa.current || !pino.current) return
    const atual = pino.current.getLngLat()
    if (Math.abs(atual.lat - latitude) < 1e-6 && Math.abs(atual.lng - longitude) < 1e-6) return
    pino.current.setLngLat([longitude, latitude])
    mapa.current.easeTo({ center: [longitude, latitude], zoom: 16, duration: 600 })
  }, [latitude, longitude])

  return (
    <div className="seletor-ponto">
      <div ref={container} className="seletor-ponto-tela" />
      {falha ? (
        <div className="aviso-falha">O mapa não carregou: {falha}</div>
      ) : (
        <p className="legenda seletor-ponto-dica">
          Arraste o pino ou toque no mapa para acertar o ponto exato do portão.
        </p>
      )}
    </div>
  )
}
