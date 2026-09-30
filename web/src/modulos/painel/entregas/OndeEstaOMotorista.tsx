import type { MotoristaNoMapa } from '../../../comum/api/tipos'

/**
 * Onde cada motorista está — e, principalmente, de QUANDO é essa informação.
 *
 * A idade vem antes de qualquer outra coisa porque ela decide se o resto vale.
 * Um ponto no mapa de quarenta minutos atrás, mostrado sem data, faz o dono
 * ligar cobrando uma entrega que já foi feita, ou achar que o carro parou
 * quando na verdade foi o sinal que caiu.
 */

/** A partir de quanto tempo a posição deixa de descrever o agora. */
const FRESCA_MS = 5 * 60_000
const VELHA_MS = 20 * 60_000

function idade(vistoEm: string): { texto: string; classe: string } {
  const minutos = Math.round((Date.now() - new Date(vistoEm).getTime()) / 60_000)

  if (minutos < 1) return { texto: 'agora mesmo', classe: 'motorista-vivo' }
  if (minutos < FRESCA_MS / 60_000) return { texto: `há ${minutos} min`, classe: 'motorista-vivo' }
  if (minutos < VELHA_MS / 60_000) return { texto: `há ${minutos} min`, classe: 'motorista-morno' }
  if (minutos < 120) return { texto: `há ${minutos} min`, classe: 'motorista-frio' }

  return {
    texto: `desde ${new Date(vistoEm).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    classe: 'motorista-frio',
  }
}

export function OndeEstaOMotorista({ motoristas }: { motoristas: MotoristaNoMapa[] }) {
  if (motoristas.length === 0) {
    return <p className="legenda" style={{ margin: 0 }}>Nenhum motorista cadastrado.</p>
  }

  return (
    <ul className="motoristas">
      {motoristas.map((m) => {
        const temPosicao = m.latitude !== null && m.longitude !== null && m.vistoEm !== null
        const quando = temPosicao ? idade(m.vistoEm!) : null

        return (
          <li key={m.id} className="motorista">
            <span className={`motorista-farol ${quando?.classe ?? 'motorista-apagado'}`} />

            <span className="motorista-nome">{m.nome}</span>

            {quando ? (
              <span className={`motorista-quando ${quando.classe}`}>
                visto {quando.texto}
                {m.precisaoMetros !== null && m.precisaoMetros > 200 && (
                  <span className="motorista-impreciso">
                    {' '}
                    · sinal fraco, ±{Math.round(m.precisaoMetros)} m
                  </span>
                )}
              </span>
            ) : (
              // Não é falha: é o motorista que ainda não ligou o GPS. Dizer
              // "sem posição" é mais honesto do que deixar a linha vazia.
              <span className="motorista-quando motorista-apagado">
                sem posição — o GPS dele está desligado
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
