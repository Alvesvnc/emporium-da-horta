/**
 * A redação das manobras, em português.
 *
 * Existe separada dos provedores porque OSRM e TomTom descrevem a mesma curva
 * com vocabulários diferentes — `turn`+`left` num, `TURN_LEFT` no outro. Cada
 * um traduz para a AÇÃO daqui, e a frase sai igual dos dois lados.
 *
 * Isso importa mais do que parece: quando o TomTom cair e a rota descer para o
 * OSRM, o motorista não pode perceber pela voz. Instrução que muda de estilo no
 * meio do caminho faz duvidar da instrução.
 *
 * O TomTom até devolve `message` já traduzido, mas não usamos: seria uma
 * segunda voz, escrita por outra pessoa, para dizer a mesma coisa.
 *
 * Duas regras em tudo que se escreve aqui:
 *   • a AÇÃO antes da rua — quem dirige decide pela ação;
 *   • nunca inventar nome — via sem nome no mapa fica sem nome na frase, e não
 *     vira "rua desconhecida".
 */

export type IconeManobra =
  | 'partida'
  | 'esquerda'
  | 'direita'
  | 'leve-esquerda'
  | 'leve-direita'
  | 'reto'
  | 'retorno'
  | 'rotatoria'
  | 'saida'
  | 'chegada'

export type Manobra = {
  /** Frase pronta, para ler na tela e falar em voz alta. */
  instrucao: string
  /** Nome da via, para o subtítulo. */
  via: string | null
  icone: IconeManobra
  /** Comprimento deste trecho, do início dele até a manobra seguinte. */
  metros: number
  segundos: number
  /** Onde a manobra acontece, em [latitude, longitude]. */
  latitude: number
  longitude: number
}

export type Lado =
  | 'esquerda'
  | 'direita'
  | 'leve-esquerda'
  | 'leve-direita'
  | 'fechada-esquerda'
  | 'fechada-direita'

/** O que fazer, sem depender de quem contou. */
export type Acao =
  | { tipo: 'partida' }
  | { tipo: 'chegada'; lado?: Lado }
  | { tipo: 'virar'; lado: Lado }
  | { tipo: 'fim-da-rua'; lado: Lado }
  | { tipo: 'seguir' }
  | { tipo: 'retorno' }
  | { tipo: 'entrar'; lado?: Lado }
  | { tipo: 'acesso' }
  | { tipo: 'saida'; lado?: Lado }
  | { tipo: 'bifurcacao'; lado: Lado }
  | { tipo: 'rotatoria'; saida?: number; lado?: Lado }
  | { tipo: 'sair-rotatoria' }

const TEXTO_LADO: Record<Lado, string> = {
  esquerda: 'à esquerda',
  direita: 'à direita',
  'leve-esquerda': 'levemente à esquerda',
  'leve-direita': 'levemente à direita',
  'fechada-esquerda': 'à esquerda, em curva fechada',
  'fechada-direita': 'à direita, em curva fechada',
}

const ICONE_LADO: Record<Lado, IconeManobra> = {
  esquerda: 'esquerda',
  direita: 'direita',
  'leve-esquerda': 'leve-esquerda',
  'leve-direita': 'leve-direita',
  'fechada-esquerda': 'esquerda',
  'fechada-direita': 'direita',
}

const ORDINAL = ['', '1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª']

/** Monta a frase e escolhe a seta. `ehUltima` separa "chegue" de "você chegou". */
export function redigir(
  acao: Acao,
  via: string | null,
  ehUltima: boolean,
): { instrucao: string; icone: IconeManobra } {
  const em = via ? ` na ${via}` : ''
  const para = via ? ` para ${via}` : ''

  switch (acao.tipo) {
    case 'partida':
      return { instrucao: via ? `Siga pela ${via}` : 'Comece a rota', icone: 'partida' }

    case 'chegada': {
      const lado = acao.lado ? `, ${TEXTO_LADO[acao.lado]}` : ''
      return {
        instrucao: ehUltima ? `Você chegou${lado}` : `Chegue ao ponto${lado}`,
        icone: 'chegada',
      }
    }

    case 'virar':
      return {
        instrucao: `Vire ${TEXTO_LADO[acao.lado]}${em}`,
        icone: ICONE_LADO[acao.lado],
      }

    case 'fim-da-rua':
      return {
        instrucao: `No fim da rua, vire ${TEXTO_LADO[acao.lado]}${em}`,
        icone: ICONE_LADO[acao.lado],
      }

    case 'seguir':
      return { instrucao: via ? `Continue na ${via}` : 'Continue em frente', icone: 'reto' }

    case 'retorno':
      return { instrucao: 'Faça o retorno', icone: 'retorno' }

    case 'entrar':
      return {
        instrucao: `Entre${em}`,
        icone: acao.lado ? ICONE_LADO[acao.lado] : 'reto',
      }

    case 'acesso':
      return { instrucao: `Pegue o acesso${para}`, icone: 'saida' }

    case 'saida':
      return { instrucao: `Pegue a saída${para}`, icone: 'saida' }

    case 'bifurcacao':
      return {
        instrucao: `Na bifurcação, mantenha-se ${TEXTO_LADO[acao.lado]}${em}`,
        icone: ICONE_LADO[acao.lado],
      }

    case 'rotatoria':
      if (acao.saida) {
        return {
          instrucao: `Na rotatória, pegue a ${ORDINAL[acao.saida] ?? `${acao.saida}ª`} saída${em}`,
          icone: 'rotatoria',
        }
      }
      return {
        instrucao: acao.lado
          ? `Na rotatória, vire ${TEXTO_LADO[acao.lado]}${em}`
          : `Entre na rotatória${em}`,
        icone: 'rotatoria',
      }

    case 'sair-rotatoria':
      return { instrucao: `Saia da rotatória${em}`, icone: 'rotatoria' }
  }
}

// ── Tradutor do OSRM ─────────────────────────────────────────

const LADO_OSRM: Record<string, Lado> = {
  left: 'esquerda',
  right: 'direita',
  'slight left': 'leve-esquerda',
  'slight right': 'leve-direita',
  'sharp left': 'fechada-esquerda',
  'sharp right': 'fechada-direita',
}

export function acaoDoOsrm(tipo: string, modificador: string | undefined, saida?: number): Acao {
  const lado = LADO_OSRM[modificador ?? '']

  switch (tipo) {
    case 'depart':
      return { tipo: 'partida' }
    case 'arrive':
      return { tipo: 'chegada', lado: lado === 'esquerda' || lado === 'direita' ? lado : undefined }
    case 'turn':
      if (modificador === 'uturn') return { tipo: 'retorno' }
      if (modificador === 'straight' || !lado) return { tipo: 'seguir' }
      return { tipo: 'virar', lado }
    case 'end of road':
      return { tipo: 'fim-da-rua', lado: lado ?? 'direita' }
    case 'new name':
    case 'continue':
      return { tipo: 'seguir' }
    case 'merge':
      return { tipo: 'entrar', lado }
    case 'on ramp':
      return { tipo: 'acesso' }
    case 'off ramp':
      return { tipo: 'saida', lado }
    case 'fork':
      return { tipo: 'bifurcacao', lado: lado ?? 'direita' }
    case 'roundabout':
    case 'rotary':
      return { tipo: 'rotatoria', saida }
    case 'roundabout turn':
      return { tipo: 'rotatoria', lado }
    case 'exit roundabout':
    case 'exit rotary':
      return { tipo: 'sair-rotatoria' }
    default:
      // Tipo que não conhecemos ainda. Melhor uma frase honesta e genérica do
      // que silêncio no meio do trânsito.
      return { tipo: 'seguir' }
  }
}

// ── Tradutor do TomTom ───────────────────────────────────────

const ACAO_TOMTOM: Record<string, Acao> = {
  DEPART: { tipo: 'partida' },
  FOLLOW: { tipo: 'seguir' },
  STRAIGHT: { tipo: 'seguir' },
  ARRIVE: { tipo: 'chegada' },
  ARRIVE_LEFT: { tipo: 'chegada', lado: 'esquerda' },
  ARRIVE_RIGHT: { tipo: 'chegada', lado: 'direita' },
  WAYPOINT_REACHED: { tipo: 'chegada' },
  WAYPOINT_LEFT: { tipo: 'chegada', lado: 'esquerda' },
  WAYPOINT_RIGHT: { tipo: 'chegada', lado: 'direita' },
  TURN_LEFT: { tipo: 'virar', lado: 'esquerda' },
  TURN_RIGHT: { tipo: 'virar', lado: 'direita' },
  SHARP_LEFT: { tipo: 'virar', lado: 'fechada-esquerda' },
  SHARP_RIGHT: { tipo: 'virar', lado: 'fechada-direita' },
  BEAR_LEFT: { tipo: 'virar', lado: 'leve-esquerda' },
  BEAR_RIGHT: { tipo: 'virar', lado: 'leve-direita' },
  KEEP_LEFT: { tipo: 'bifurcacao', lado: 'leve-esquerda' },
  KEEP_RIGHT: { tipo: 'bifurcacao', lado: 'leve-direita' },
  MAKE_UTURN: { tipo: 'retorno' },
  TRY_MAKE_UTURN: { tipo: 'retorno' },
  ENTER_MOTORWAY: { tipo: 'entrar' },
  ENTER_FREEWAY: { tipo: 'entrar' },
  ENTER_HIGHWAY: { tipo: 'entrar' },
  ENTRANCE_RAMP: { tipo: 'acesso' },
  TAKE_EXIT: { tipo: 'saida' },
  MOTORWAY_EXIT_LEFT: { tipo: 'saida', lado: 'esquerda' },
  MOTORWAY_EXIT_RIGHT: { tipo: 'saida', lado: 'direita' },
  SWITCH_PARALLEL_ROAD: { tipo: 'seguir' },
  SWITCH_MAIN_ROAD: { tipo: 'seguir' },
}

export function acaoDoTomTom(manobra: string, saidaDaRotatoria?: number): Acao {
  if (manobra.startsWith('ROUNDABOUT')) {
    if (manobra === 'ROUNDABOUT_BACK') return { tipo: 'rotatoria', saida: saidaDaRotatoria }
    return { tipo: 'rotatoria', saida: saidaDaRotatoria }
  }
  return ACAO_TOMTOM[manobra] ?? { tipo: 'seguir' }
}
