import { useEffect } from 'react'
import type { IconeManobra } from '../../comum/api/tipos'
import { useVoz } from '../../comum/ganchos/useVoz'
import { distanciaCurta, metrosFalados } from '../../comum/mapa/geo'
import type { EstadoNavegacao, PassoAtual } from './useNavegacao'

/**
 * A faixa de navegação: o que fazer AGORA, grande o bastante para se ler de
 * relance com o carro andando.
 *
 * A hierarquia é deliberada e nesta ordem: a seta, a distância, a instrução, e
 * só então o que vem depois. É a ordem em que quem dirige precisa da
 * informação — a ação primeiro, o detalhe por último.
 */

/** Setas desenhadas em SVG: escalam sem borrar e não dependem de fonte de ícones. */
const SETA: Record<IconeManobra, string> = {
  partida: 'M12 20V7m0 0-5 5m5-5 5 5',
  esquerda: 'M4 12h11a3 3 0 0 1 3 3v5M4 12l5-5M4 12l5 5',
  direita: 'M20 12H9a3 3 0 0 0-3 3v5M20 12l-5-5M20 12l-5 5',
  'leve-esquerda': 'M8 21v-8a4 4 0 0 1 1.2-2.8L15 5M15 5H9m6 0v6',
  'leve-direita': 'M16 21v-8a4 4 0 0 0-1.2-2.8L9 5M9 5h6M9 5v6',
  reto: 'M12 20V5m0 0-5 5m5-5 5 5',
  retorno: 'M8 20V11a4 4 0 0 1 8 0v3m0 0 3-3m-3 3-3-3',
  rotatoria: 'M12 21v-6m0 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm4-4h4m-4 0-3-4',
  saida: 'M8 21V9a4 4 0 0 1 4-4h4m0 0-3-3m3 3-3 3',
  chegada: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Zm0-13a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
}

/**
 * Quando avisar por voz.
 *
 * Três avisos por manobra, na distância em que cada um é útil: um para se
 * preparar, um para entrar na faixa, e um na hora de virar. Falar mais que
 * isso vira barulho e o motorista desliga a voz — aí não avisa nada.
 */
const AVISOS_METROS = [400, 150, 40]

export function PainelDeNavegacao({
  passo,
  estado,
  erro,
  precisaoDestino,
  aoRefazer,
  aoSair,
}: {
  passo: PassoAtual | null
  estado: EstadoNavegacao
  erro: string | null
  precisaoDestino: 'exata' | 'aproximada' | 'desconhecida'
  aoRefazer: () => void
  aoSair: () => void
}) {
  const voz = useVoz()

  // ── A voz ────────────────────────────────────────────────────
  useEffect(() => {
    if (!passo || estado !== 'guiando') return

    const faixa = AVISOS_METROS.find((limite) => passo.metrosAteManobra <= limite)
    if (faixa === undefined) return

    const quando = passo.metrosAteManobra <= 40 ? '' : `${metrosFalados(passo.metrosAteManobra)}, `
    voz.falar(`${quando}${passo.manobra.instrucao}`)
  }, [passo, estado, voz])

  useEffect(() => {
    if (estado === 'recalculando') voz.falar('Recalculando o caminho')
  }, [estado, voz])

  if (estado === 'desligada') return null

  if (estado === 'erro') {
    return (
      <section className="navegacao">
        <div className="aviso-falha">{erro ?? 'Não consegui traçar o caminho.'}</div>
        <div className="navegacao-acoes">
          <button type="button" className="botao botao-contorno" onClick={aoRefazer}>
            Tentar de novo
          </button>
          <button type="button" className="botao botao-contorno" onClick={aoSair}>
            Sair da navegação
          </button>
        </div>
      </section>
    )
  }

  if (!passo || estado === 'tracando') {
    return (
      <section className="navegacao">
        <div className="navegacao-carregando">Traçando o caminho…</div>
      </section>
    )
  }

  const chegando = passo.manobra.icone === 'chegada'

  return (
    <section className={`navegacao ${chegando ? 'navegacao-chegando' : ''}`}>
      <div className="navegacao-manobra">
        <svg className="navegacao-seta" viewBox="0 0 24 24" aria-hidden="true">
          <path d={SETA[passo.manobra.icone]} />
        </svg>

        <div className="navegacao-texto">
          <span className="navegacao-distancia numerico">
            {distanciaCurta(passo.metrosAteManobra / 1000)}
          </span>
          <span className="navegacao-instrucao">{passo.manobra.instrucao}</span>
          {passo.depois && (
            <span className="navegacao-depois">Depois: {passo.depois.instrucao}</span>
          )}
        </div>
      </div>

      {estado === 'recalculando' && (
        <div className="navegacao-recalculando">Você saiu do caminho — refazendo a rota…</div>
      )}

      {chegando && precisaoDestino !== 'exata' && (
        <p className="navegacao-alerta">
          O ponto do destino é aproximado — o mapa marca o bairro, não a casa. Confira o número
          antes de descer.
        </p>
      )}

      <div className="navegacao-rodape">
        <span className="numerico">
          {distanciaCurta(passo.metrosRestantes / 1000)} · {passo.minutosRestantes} min
        </span>

        <div className="navegacao-acoes">
          {voz.disponivel && (
            <button
              type="button"
              className={`botao botao-contorno navegacao-botao ${voz.ligada ? 'navegacao-voz-ligada' : ''}`}
              onClick={voz.alternar}
              aria-pressed={voz.ligada}
            >
              {voz.ligada ? 'Voz ligada' : 'Voz desligada'}
            </button>
          )}
          <button
            type="button"
            className="botao botao-contorno navegacao-botao"
            onClick={aoSair}
          >
            Sair
          </button>
        </div>
      </div>
    </section>
  )
}
