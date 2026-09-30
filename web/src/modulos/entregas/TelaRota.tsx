import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import './entregas.css'
import { chamar, ErroApi } from '../../comum/api/http'
import type { MotivoNaoEntrega, RespostaRota } from '../../comum/api/tipos'
import { BarreiraDeErro } from '../../comum/componentes/BarreiraDeErro'
import { Cabecalho } from '../../comum/componentes/Cabecalho'
import { useLocalizacaoAoVivo } from '../../comum/ganchos/useLocalizacaoAoVivo'
import { useConexao } from '../../comum/ganchos/useConexao'
import { useTelaAcesa } from '../../comum/ganchos/useTelaAcesa'
import {
  aplicarLocalmente,
  descarregar,
  enfileirar,
  enviarUma,
  fotoParaFila,
  guardarRotaLocal,
  lerRotaLocal,
  pendentes,
  vaiAdiantarTentarDeNovo,
  type AcaoPendente,
} from './filaOffline'
import { BarraGps } from './BarraGps'
import { CartaoParada } from './CartaoParada'
import { PainelDeNavegacao } from './PainelDeNavegacao'
import { useNavegacao } from './useNavegacao'
import { usePublicarPosicao } from './usePublicarPosicao'
import { ProximaParada } from './ProximaParada'

/**
 * O mapa entra sob demanda. A biblioteca tem quase 1 MB, e quem compra na loja
 * não deveria baixar isso — só o motorista abre esta tela.
 */
const MapaDaRota = lazy(() =>
  import('./MapaDaRota').then((modulo) => ({ default: modulo.MapaDaRota })),
)

/**
 * O dia do motorista, em três blocos e nesta ordem de importância:
 *
 *   1. a parada de AGORA, grande, com tudo que ele precisa sem tocar em nada
 *   2. o mapa, para entender o formato do dia
 *   3. o resto das paradas, em lista enxuta
 *
 * A ordem importa porque isto é usado no celular, com uma mão, no trânsito.
 */

const ROTULO_PROVEDOR: Record<RespostaRota['provedor'], { texto: string; bom: boolean }> = {
  tomtom: { texto: 'ROTA COM TRÂNSITO', bom: true },
  google: { texto: 'ROTA COM TRÂNSITO', bom: true },
  osrm: { texto: 'ROTA PELAS RUAS', bom: true },
  'linha-reta': { texto: 'ROTA EM LINHA RETA', bom: false },
}

export function TelaRota() {
  const [rota, setRota] = useState<RespostaRota | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<number | null>(null)
  const { posicao, estado: gps, ligar, desligar } = useLocalizacaoAoVivo()
  const [navegandoPara, setNavegandoPara] = useState<number | null>(null)
  const { conectado, marcarQueda, marcarVolta } = useConexao()
  const [naFila, setNaFila] = useState(0)
  /** Quando a rota na tela veio do aparelho, e não da rede. */
  const [rotaAntiga, setRotaAntiga] = useState<number | null>(null)
  const navegacao = useNavegacao({
    pedidoId: navegandoPara,
    posicao,
    ativa: navegandoPara !== null,
  })

  // Enquanto guia, o celular não pode apagar: ele está dirigindo e a próxima
  // curva precisa estar na tela sem ninguém tocar em nada.
  useTelaAcesa(navegandoPara !== null)

  // Com o GPS ligado, o dono passa a ver onde o carro está. Desligou o GPS,
  // para de enviar — o controle é de quem está dirigindo.
  usePublicarPosicao(posicao, gps === 'seguindo')

  // Devolve a rota recém-carregada, e não só guarda no estado: quem acabou de
  // entregar precisa saber AGORA qual é a próxima parada, e o estado do React
  // só estaria atualizado no render seguinte.
  const carregar = useCallback(async (): Promise<RespostaRota | null> => {
    try {
      const doServidor = await chamar<RespostaRota>('/api/rota/hoje')

      /**
       * A fila pode ter ações que o servidor ainda não viu.
       *
       * Sem aplicá-las por cima, uma parada que o motorista já marcou como
       * entregue reapareceria na lista assim que a rota recarregasse — e ele
       * marcaria de novo, achando que o primeiro toque não pegou.
       */
      const fila = await pendentes()
      const nova = fila.reduce(aplicarLocalmente, doServidor)

      setRota(nova)
      setErro(null)
      setRotaAntiga(null)
      marcarVolta()
      // Guardada para o dia em que a rede não responder.
      void guardarRotaLocal(nova)
      return nova
    } catch (falha) {
      /**
       * Sem rede, a rota guardada no aparelho vale mais que uma tela vazia:
       * endereço, telefone, itens e valores continuam à mão. O que ela não tem
       * é pedido que entrou depois — por isso a tela diz de quando ela é.
       */
      const guardada = await lerRotaLocal()
      if (guardada) {
        marcarQueda()
        setRota(guardada.rota)
        setRotaAntiga(guardada.em)
        setErro(null)
        return guardada.rota
      }
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui carregar a rota.')
      return null
    }
  }, [marcarQueda, marcarVolta])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /**
   * Registra uma ação da rota, com ou sem sinal.
   *
   * Caminho normal: envia, o servidor confirma, a tela recarrega com a ordem
   * recalculada. Sem rede: a ação entra na fila do aparelho e é aplicada na
   * tela na hora, para o motorista seguir trabalhando como se nada tivesse
   * acontecido. Ele descobre a queda por um aviso, não por um botão que trava.
   *
   * Erro definitivo (4xx) não vai para a fila: é o servidor dizendo que aquilo
   * não vale — pedido cancelado enquanto ele dirigia, por exemplo. Isso aparece
   * na tela, porque ele precisa saber.
   */
  const registrar = useCallback(
    async (acao: AcaoPendente): Promise<RespostaRota | null> => {
      try {
        await enviarUma(acao)
        marcarVolta()
        return await carregar()
      } catch (falha) {
        if (!vaiAdiantarTentarDeNovo(falha)) {
          setErro(falha instanceof ErroApi ? falha.message : 'Não consegui registrar.')
          return null
        }

        marcarQueda()
        await enfileirar(acao)
        setNaFila((quantas) => quantas + 1)

        // A tela responde na hora. A ordem das paradas restantes NÃO é
        // recalculada: quem otimiza é o serviço de rotas, do outro lado da
        // conexão que caiu.
        const local = rota ? aplicarLocalmente(rota, acao) : null
        if (local) {
          setRota(local)
          void guardarRotaLocal(local)
        }
        return local
      }
    },
    [carregar, marcarQueda, marcarVolta, rota],
  )

  /**
   * Navegar exige saber onde ele está. Se o GPS estiver desligado, liga junto:
   * obrigar o motorista a tocar em dois lugares para uma coisa só é atrito à
   * toa, e ele vai estar com o carro na rua.
   */
  async function navegarAte(pedidoId: number) {
    if (gps !== 'seguindo') ligar()
    setNavegandoPara(pedidoId)
    // Ele está indo: acende "Saiu para entrega" na tela do cliente e a barra
    // "Em rota" no painel do dono.
    await registrar({ tipo: 'em_rota', pedidoId, em: Date.now() })
  }

  /**
   * A entrega que não aconteceu.
   *
   * O pedido continua vivo — volta para a rota amanhã até alguém resolver.
   */
  async function marcarNaoEntregue(
    pedidoId: number,
    motivo: MotivoNaoEntrega,
    observacao: string,
  ) {
    const estavaGuiando = navegandoPara === pedidoId
    setSalvando(pedidoId)
    const atualizada = await registrar({
      tipo: 'nao_entregue',
      pedidoId,
      motivo,
      observacao,
      em: Date.now(),
    })
    if (estavaGuiando) setNavegandoPara(atualizada?.paradas[0]?.pedidoId ?? null)
    setSalvando(null)
  }

  /**
   * Marca a entrega e emenda na parada seguinte.
   *
   * Quem estava sendo guiado continua sendo guiado: o motorista não deveria
   * precisar tocar em "Navegar" vinte vezes por dia. Do lado dele parece uma
   * rota só, do começo ao fim.
   */
  async function marcarEntregue(pedidoId: number, recebidoPor: string, foto: File | null) {
    const estavaGuiando = navegandoPara === pedidoId
    setSalvando(pedidoId)

    // Encolhida já aqui: se for para a fila, vai pequena para o aparelho e sobe
    // rápido quando o sinal voltar.
    const atualizada = await registrar({
      tipo: 'entregue',
      pedidoId,
      recebidoPor,
      foto: await fotoParaFila(foto),
      em: Date.now(),
    })

    if (estavaGuiando) {
      // A rota volta reordenada pelo servidor, então a próxima parada é a
      // primeira da lista nova — não a que estava em segundo lugar antes.
      setNavegandoPara(atualizada?.paradas[0]?.pedidoId ?? null)
    }
    setSalvando(null)
  }

  /** Quantas ações ficaram esperando de sessões anteriores. */
  useEffect(() => {
    void pendentes().then((fila) => setNaFila(fila.length))
  }, [])

  /**
   * Esvazia a fila quando o sinal volta.
   *
   * Também tenta de tempos em tempos: `navigator.onLine` mente com frequência
   * — celular pendurado numa antena que não passa dado aparece como conectado,
   * e o evento de volta nunca chega.
   */
  useEffect(() => {
    let vivo = true

    const tentar = async () => {
      const fila = await pendentes()
      if (!vivo || fila.length === 0) return

      const resultado = await descarregar()
      if (!vivo) return

      setNaFila(resultado.restantes)
      if (resultado.enviadas > 0) {
        marcarVolta()
        await carregar()
      }
    }

    void tentar()
    const relogio = setInterval(() => void tentar(), 30_000)
    return () => {
      vivo = false
      clearInterval(relogio)
    }
  }, [conectado, carregar, marcarVolta])

  const proxima = rota?.paradas[0]
  const seguintes = rota?.paradas.slice(1) ?? []
  const feitas = rota ? rota.resumo.total - rota.resumo.restantes : 0
  const provedor = rota ? ROTULO_PROVEDOR[rota.provedor] : null
  const acabou = rota && rota.paradas.length === 0 && rota.semLocalizacao.length === 0

  return (
    <div className="aplicacao">
      <Cabecalho subtitulo="Rota do motorista" area="equipe" />

      <main className="conteudo rota-conteudo">
        <div className="rota-cabecalho">
          <div>
            <h1 className="titulo rota-titulo">Entregas de hoje</h1>
            {rota && (
              <p className="legenda">
                {feitas} de {rota.resumo.total} entregues ·{' '}
                {rota.resumo.distanciaKm.toFixed(1).replace('.', ',')} km ·{' '}
                {rota.resumo.minutosEstimados} min dirigindo
              </p>
            )}
          </div>
          {provedor && (
            <span className={`selo-rota ${provedor.bom ? 'selo-rota-bom' : 'selo-rota-fraco'}`}>
              {provedor.texto}
            </span>
          )}
        </div>

        {rota && rota.resumo.total > 0 && (
          <div className="rota-progresso" aria-label={`${feitas} de ${rota.resumo.total} entregues`}>
            <div style={{ width: `${(feitas / rota.resumo.total) * 100}%` }} />
          </div>
        )}

        {/*
          O motorista precisa saber em que pé está a conexão, e principalmente
          que o trabalho dele não se perdeu. Um sistema que engole a queda em
          silêncio faz alguém marcar a mesma entrega duas vezes por desconfiança.
        */}
        {(rotaAntiga !== null || naFila > 0) && (
          <div className="sem-sinal">
            {rotaAntiga !== null && (
              <div className="sem-sinal-linha">
                <b>Sem conexão.</b> Mostrando a rota de{' '}
                {new Date(rotaAntiga).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                . Pedidos feitos depois disso não aparecem aqui.
              </div>
            )}
            {naFila > 0 && (
              <div className="sem-sinal-linha">
                <b>
                  {naFila} {naFila === 1 ? 'entrega marcada' : 'entregas marcadas'} esperando envio.
                </b>{' '}
                Vai sozinho quando o sinal voltar — pode continuar trabalhando.
              </div>
            )}
            {rotaAntiga !== null && (
              <div className="sem-sinal-linha sem-sinal-fraco">
                Navegar por aqui precisa de internet. Use o Google Maps enquanto isso.
              </div>
            )}
          </div>
        )}

        {erro && <div className="aviso-falha">{erro}</div>}
        {rota?.aviso && <div className="aviso-falha">{rota.aviso}</div>}
        {rota && !rota.central.configurada && (
          <div className="aviso-falha">
            A sede ainda não foi definida no painel. Os quilômetros e horários abaixo saem de um
            endereço provisório — peça ao dono para preencher a Central em Configurações.
          </div>
        )}
        {rota && rota.resumo.retentativas > 0 && (
          <div className="rota-retentativas">
            {rota.resumo.retentativas === 1
              ? '1 entrega de outro dia não deu certo e voltou para a rota.'
              : `${rota.resumo.retentativas} entregas de outros dias não deram certo e voltaram para a rota.`}{' '}
            Ligue antes de ir.
          </div>
        )}
        {!rota && !erro && <div className="carregando">Montando a rota…</div>}

        {acabou && (
          <div className="rota-fim">
            {rota.resumo.total === 0
              ? 'Nenhum pedido para entregar hoje.'
              : 'Todas as entregas concluídas. Bom trabalho.'}
          </div>
        )}

        {rota && proxima && (
          <>
            <ProximaParada
              parada={proxima}
              indice={feitas + 1}
              total={rota.resumo.total}
              salvando={salvando === proxima.pedidoId}
              aoEntregar={(recebidoPor, foto) =>
                void marcarEntregue(proxima.pedidoId, recebidoPor, foto)
              }
              ondeEstou={posicao}
              aoNavegar={() => void navegarAte(proxima.pedidoId)}
              navegando={navegandoPara === proxima.pedidoId}
              aoNaoEntregar={(motivo, observacao) =>
                void marcarNaoEntregue(proxima.pedidoId, motivo, observacao)
              }
            />

            <PainelDeNavegacao
              passo={navegacao.passo}
              estado={navegacao.estado}
              erro={navegacao.erro}
              precisaoDestino={proxima.precisao}
              aoRefazer={navegacao.refazer}
              aoSair={() => setNavegandoPara(null)}
            />
          </>
        )}

        {rota && rota.paradas.length > 0 && (
          <>
            <BarraGps estado={gps} posicao={posicao} ligar={ligar} desligar={desligar} />

            {/* O mapa é o único pedaço que baixa sob demanda, e é quase 1 MB.
                Falhando, leva só a si mesmo: as paradas continuam na tela. */}
            <BarreiraDeErro
              aoFalhar={(tentarDeNovo) => (
                <div className="mapa-real">
                  <div className="aviso-falha">
                    O mapa não carregou. As paradas, a navegação pelo Google Maps e o registro das
                    entregas continuam funcionando.
                  </div>
                  <button
                    type="button"
                    className="botao botao-contorno"
                    style={{ alignSelf: 'flex-start', padding: '9px 18px', fontSize: 13 }}
                    onClick={tentarDeNovo}
                  >
                    Tentar carregar o mapa
                  </button>
                </div>
              )}
            >
              <Suspense fallback={<div className="mapa-tela mapa-carregando">Carregando o mapa…</div>}>
                <MapaDaRota
                  rota={rota}
                  paradaEmFoco={proxima?.pedidoId}
                  posicao={posicao}
                  seguindo={gps === 'seguindo'}
                  caminho={navegacao.rota?.geometria ?? null}
                />
              </Suspense>
            </BarreiraDeErro>
            {rota.linkProximoTrecho && rota.paradasNoLink > 1 && (
              <a
                href={rota.linkProximoTrecho}
                target="_blank"
                rel="noreferrer"
                className="botao botao-contorno rota-link-completo"
              >
                Seguir as próximas {rota.paradasNoLink} no Google Maps
              </a>
            )}
          </>
        )}

        {seguintes.length > 0 && (
          <section className="rota-seguintes">
            <h2 className="titulo rota-subtitulo">Depois desta ({seguintes.length})</h2>
            {seguintes.map((parada) => (
              <CartaoParada
                key={parada.pedidoId}
                parada={parada}
                salvando={salvando === parada.pedidoId}
                aoEntregar={(recebidoPor, foto) =>
                  void marcarEntregue(parada.pedidoId, recebidoPor, foto)
                }
                aoNaoEntregar={(motivo, observacao) =>
                  void marcarNaoEntregue(parada.pedidoId, motivo, observacao)
                }
              />
            ))}
          </section>
        )}

        {rota && rota.semLocalizacao.length > 0 && (
          <section className="rota-seguintes">
            <div className="aviso-falha">
              {rota.semLocalizacao.length} parada(s) que o mapa não localizou. Entregue por último,
              conferindo o endereço escrito.
            </div>
            {rota.semLocalizacao.map((parada) => (
              <CartaoParada
                key={parada.pedidoId}
                parada={{ ...parada, ordem: 0, precisao: 'desconhecida', distanciaKm: 0, minutos: 0 }}
                salvando={salvando === parada.pedidoId}
                aoEntregar={(recebidoPor, foto) =>
                  void marcarEntregue(parada.pedidoId, recebidoPor, foto)
                }
                aoNaoEntregar={(motivo, observacao) =>
                  void marcarNaoEntregue(parada.pedidoId, motivo, observacao)
                }
              />
            ))}
          </section>
        )}

        {rota && rota.entregues.length > 0 && (
          <details className="rota-feitas">
            <summary>{rota.entregues.length} já entregues hoje</summary>
            <div>
              {rota.entregues.map((entrega) => (
                <div key={entrega.pedidoId} className="legenda">
                  #{entrega.numero} · {entrega.cliente} — {entrega.bairro}
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  )
}
