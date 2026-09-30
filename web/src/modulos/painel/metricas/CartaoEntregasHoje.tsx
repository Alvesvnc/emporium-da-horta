import type { Metricas } from '../../../comum/api/tipos'
import { Trilho } from '../../../comum/componentes/Trilho'

/** Como está o dia da entrega, em três barras. */
export function CartaoEntregasHoje({
  entregas,
  aoAbrir,
}: {
  entregas: Metricas['entregas']
  aoAbrir: () => void
}) {
  const proporcao = (quantos: number) => (entregas.total ? (quantos / entregas.total) * 100 : 0)

  return (
    <button type="button" className="indicador" onClick={aoAbrir}>
      <div className="entre">
        <h3 className="titulo" style={{ fontSize: 16, color: 'var(--color-accent-2-900)' }}>
          Entregas de hoje
        </h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-2-700)' }}>
          ver detalhes ↗
        </span>
      </div>

      <BarraStatus
        rotulo="Entregues"
        valor={`${entregas.entregues} de ${entregas.total}`}
        porcentagem={proporcao(entregas.entregues)}
        cor="var(--color-accent-2)"
      />
      <BarraStatus
        rotulo="Em rota agora"
        valor={`${entregas.emRota} ${entregas.emRota === 1 ? 'parada' : 'paradas'}`}
        porcentagem={proporcao(entregas.emRota)}
        cor="var(--color-accent)"
      />
      <BarraStatus
        rotulo="Aguardando saída"
        valor={String(entregas.aguardando)}
        porcentagem={proporcao(entregas.aguardando)}
        cor="var(--color-accent-700)"
      />

      {/* Só aparece quando existe. No dia em que tudo deu certo, esta linha
          seria um zero ocupando espaço; no dia em que não deu, precisa saltar
          aos olhos — é cliente esperando mercadoria que não chegou. */}
      {entregas.naoEntregues > 0 && (
        <BarraStatus
          rotulo="Não entregues"
          valor={`${entregas.naoEntregues} para resolver`}
          porcentagem={proporcao(entregas.naoEntregues)}
          cor="#a8391a"
        />
      )}

      <p
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--color-neutral-600)',
          paddingTop: 6,
          margin: 0,
        }}
      >
        Tempo médio por entrega{' '}
        <b style={{ color: 'var(--color-accent-2-900)' }}>
          {entregas.tempoMedioMinutos === null ? '—' : `${entregas.tempoMedioMinutos} min`}
        </b>
      </p>
    </button>
  )
}

function BarraStatus({
  rotulo,
  valor,
  porcentagem,
  cor,
}: {
  rotulo: string
  valor: string
  porcentagem: number
  cor: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
        <span>{rotulo}</span>
        <span style={{ color: 'var(--color-neutral-600)', fontWeight: 600 }}>{valor}</span>
      </div>
      <Trilho porcentagem={porcentagem} cor={cor} altura={9} />
    </div>
  )
}
