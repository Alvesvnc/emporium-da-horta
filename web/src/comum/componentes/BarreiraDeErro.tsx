import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Impede que um pedaço quebrado leve a tela inteira junto.
 *
 * Sem isto, qualquer erro durante o desenho apaga TUDO: o React desmonta a
 * árvore e sobra uma página em branco, sem uma palavra explicando. Para o
 * motorista no meio da rota, tela branca e celular travado são a mesma coisa —
 * ele não tem como saber que bastava recarregar.
 *
 * O caso que motivou: o mapa entra por carregamento sob demanda, e são quase
 * 1 MB. Se esse pedaço não baixar — conexão caindo no meio, ou primeira visita
 * sem rede antes de o service worker ter guardado —, o erro sobe e derruba a
 * lista de paradas junto. As paradas não têm culpa nenhuma e continuariam
 * perfeitamente utilizáveis.
 *
 * Precisa ser classe: é a única forma de capturar erro de desenho no React.
 */

type Props = {
  children: ReactNode
  /** O que mostrar no lugar. Recebe uma função para tentar montar de novo. */
  aoFalhar: (tentarDeNovo: () => void) => ReactNode
}

type Estado = { quebrou: boolean }

export class BarreiraDeErro extends Component<Props, Estado> {
  state: Estado = { quebrou: false }

  static getDerivedStateFromError(): Estado {
    return { quebrou: true }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Vai para o console porque é o único lugar onde alguém vai procurar
    // depois. A tela mostra o recado em português; aqui fica o rastro técnico.
    console.error('[barreira]', erro, info.componentStack)
  }

  render() {
    if (this.state.quebrou) {
      return this.props.aoFalhar(() => this.setState({ quebrou: false }))
    }
    return this.props.children
  }
}
