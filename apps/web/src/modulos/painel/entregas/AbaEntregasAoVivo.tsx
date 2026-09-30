import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { chamar, ErroApi } from '../../../comum/api/http'
import type { MotoristaNoMapa, RespostaRota } from '@emporium/shared'
import { BarreiraDeErro } from '../../../comum/componentes/BarreiraDeErro'
import { brl } from '../../../comum/formato/dinheiro'
import { ListaDeParadas } from './ListaDeParadas'
import { OndeEstaOMotorista } from './OndeEstaOMotorista'

/**
 * O mapa é o mesmo da tela do motorista.
 *
 * Reaproveitar não é economia de código: é garantia de que dono e motorista
 * estão olhando exatamente o mesmo desenho da rota. Duas versões de um mapa
 * acabam discordando, e aí ninguém sabe qual acreditar.
 */
const MapaDaRota = lazy(() =>
  import('../../entregas/MapaDaRota').then((m) => ({ default: m.MapaDaRota })),
)

/** De quanto em quanto tempo a tela se atualiza sozinha. */
const INTERVALO_MS = 30_000

/**
 * Acompanhar o dia da entrega, ao vivo.
 *
 * Responde a três perguntas que o dono faz o tempo todo pelo telefone: onde
 * está o motorista, o que já saiu e o que ainda falta.
 *
 * A rota vem do MESMO endpoint que o motorista usa, com a mesma ordem
 * otimizada. Se aqui mostrasse outra coisa, o dono ligaria para cobrar uma
 * sequência que o motorista nunca viu.
 */
export function AbaEntregasAoVivo() {
  const [rota, setRota] = useState<RespostaRota | null>(null)
  const [motoristas, setMotoristas] = useState<MotoristaNoMapa[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [respostaRota, respostaMotoristas] = await Promise.all([
        chamar<RespostaRota>('/api/rota/hoje'),
        chamar<{ motoristas: MotoristaNoMapa[] }>('/api/admin/motoristas'),
      ])
      setRota(respostaRota)
      setMotoristas(respostaMotoristas.motoristas)
      setAtualizadoEm(Date.now())
      setErro(null)
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui carregar as entregas.')
    }
  }, [])

  useEffect(() => {
    void carregar()
    const relogio = setInterval(() => void carregar(), INTERVALO_MS)
    return () => clearInterval(relogio)
  }, [carregar])

  if (erro && !rota) return <div className="aviso-falha">{erro}</div>
  if (!rota) return <div className="carregando">Vendo como está o dia…</div>

  // O primeiro motorista com posição é quem o mapa segue. Na prática há um só;
  // com mais de um, os outros aparecem na lista com a posição em texto.
  const noMapa = motoristas.find((m) => m.latitude !== null && m.longitude !== null)
  const posicaoNoMapa =
    noMapa && noMapa.latitude !== null && noMapa.longitude !== null
      ? {
          latitude: noMapa.latitude,
          longitude: noMapa.longitude,
          precisaoMetros: noMapa.precisaoMetros ?? 0,
          rumo: null,
          em: noMapa.vistoEm ? new Date(noMapa.vistoEm).getTime() : Date.now(),
        }
      : null

  const feitas = rota.resumo.total - rota.resumo.restantes

  return (
    <>
      <section className="cartao" style={{ gap: 12 }}>
        <div className="entre">
          <div>
            <h2 className="titulo" style={{ fontSize: 17, color: 'var(--color-accent-2-900)' }}>
              Entregas de hoje
            </h2>
            <p className="legenda" style={{ margin: '2px 0 0' }}>
              {feitas} de {rota.resumo.total} entregues · {rota.resumo.restantes} restando ·{' '}
              {rota.resumo.distanciaKm.toFixed(1).replace('.', ',')} km no dia
            </p>
          </div>
          {atualizadoEm && (
            <span className="legenda" style={{ whiteSpace: 'nowrap' }}>
              atualizado{' '}
              {new Date(atualizadoEm).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <OndeEstaOMotorista motoristas={motoristas} />
      </section>

      {rota.paradas.length > 0 && (
        <BarreiraDeErro
          aoFalhar={() => (
            <div className="aviso-falha">
              O mapa não carregou. As listas abaixo continuam funcionando.
            </div>
          )}
        >
          <Suspense
            fallback={<div className="mapa-tela mapa-carregando">Carregando o mapa…</div>}
          >
            <MapaDaRota rota={rota} posicao={posicaoNoMapa} />
          </Suspense>
        </BarreiraDeErro>
      )}

      <ListaDeParadas rota={rota} />

      {rota.resumo.total > 0 && (
        <section className="cartao" style={{ gap: 6 }}>
          <h2 className="titulo" style={{ fontSize: 15, color: 'var(--color-accent-2-900)' }}>
            A receber hoje
          </h2>
          <p className="legenda" style={{ margin: 0 }}>
            {brl(
              [...rota.paradas, ...rota.semLocalizacao].reduce((s, p) => s + p.totalCentavos, 0),
            )}{' '}
            ainda na rua ·{' '}
            {brl(rota.entregues.reduce((s, e) => s + (e.totalCentavos ?? 0), 0))} já entregue
          </p>
        </section>
      )}
    </>
  )
}
