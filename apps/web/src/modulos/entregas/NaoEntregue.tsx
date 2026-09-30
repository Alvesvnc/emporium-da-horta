import { useState } from 'react'
import type { MotivoNaoEntrega } from '@emporium/shared'

/**
 * Registrar a entrega que não aconteceu.
 *
 * É o botão que faltava. Sem ele, o motorista na porta do cliente ausente tem
 * duas saídas e as duas são ruins: marcar "Entregue" (mentira que vira dado de
 * venda falso) ou não marcar nada — e aí o pedido some da rota no dia seguinte,
 * com o cliente esperando e ninguém sabendo.
 *
 * Fica fechado atrás de um toque de propósito. O caminho normal é a entrega dar
 * certo, e o botão vermelho não pode competir com o verde no meio do trânsito.
 */

const MOTIVOS: Array<{ valor: MotivoNaoEntrega; rotulo: string; ajuda: string }> = [
  { valor: 'ausente', rotulo: 'Ninguém atendeu', ajuda: 'Bati, liguei, e não veio ninguém.' },
  {
    valor: 'endereco_nao_encontrado',
    rotulo: 'Endereço não existe',
    ajuda: 'A rua ou o número não confere com o lugar.',
  },
  { valor: 'recusado', rotulo: 'Cliente recusou', ajuda: 'Não quis receber a mercadoria.' },
  { valor: 'outro', rotulo: 'Outro motivo', ajuda: 'Escreva o que houve no campo abaixo.' },
]

export function NaoEntregue({
  salvando,
  aoRegistrar,
}: {
  salvando: boolean
  aoRegistrar: (motivo: MotivoNaoEntrega, observacao: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState<MotivoNaoEntrega | null>(null)
  const [observacao, setObservacao] = useState('')

  if (!aberto) {
    return (
      <button type="button" className="falhou-abrir" onClick={() => setAberto(true)}>
        Não consegui entregar
      </button>
    )
  }

  return (
    <div className="falhou">
      <div className="falhou-titulo">O que aconteceu?</div>

      <div className="falhou-motivos">
        {MOTIVOS.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            className={`falhou-motivo ${motivo === opcao.valor ? 'falhou-motivo-escolhido' : ''}`}
            onClick={() => setMotivo(opcao.valor)}
            aria-pressed={motivo === opcao.valor}
          >
            <span className="falhou-motivo-rotulo">{opcao.rotulo}</span>
            <span className="falhou-motivo-ajuda">{opcao.ajuda}</span>
          </button>
        ))}
      </div>

      <textarea
        className="campo falhou-observacao"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Detalhe, se ajudar quem for resolver depois (opcional)"
        maxLength={300}
        rows={2}
      />

      <div className="falhou-acoes">
        <button
          type="button"
          className="botao falhou-confirmar"
          disabled={!motivo || salvando}
          onClick={() => motivo && aoRegistrar(motivo, observacao.trim())}
        >
          {salvando ? 'Salvando…' : 'Registrar'}
        </button>
        <button
          type="button"
          className="botao botao-contorno falhou-cancelar"
          onClick={() => {
            setAberto(false)
            setMotivo(null)
            setObservacao('')
          }}
        >
          Voltar
        </button>
      </div>

      <p className="falhou-recado">
        O pedido continua na sua rota amanhã até alguém resolver — não some.
      </p>
    </div>
  )
}
