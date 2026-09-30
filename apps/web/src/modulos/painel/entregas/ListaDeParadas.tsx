import type { RespostaRota } from '@emporium/shared'
import { brl } from '../../../comum/formato/dinheiro'
import { formatarTelefone } from '../../../comum/formato/telefone'

/**
 * O que já foi e o que falta, na ordem em que o motorista vai rodar.
 *
 * Três blocos separados porque exigem providências diferentes do dono: a que
 * está em rota ele acompanha, as que faltam ele pode reorganizar, e as que não
 * deram certo alguém precisa resolver.
 */
export function ListaDeParadas({ rota }: { rota: RespostaRota }) {
  const emRota = rota.paradas.filter((p) => p.status === 'em_rota')
  const aguardando = rota.paradas.filter((p) => p.status !== 'em_rota')

  return (
    <>
      {emRota.length > 0 && (
        <Bloco titulo="Saiu para entrega" cor="var(--color-accent-700)">
          {emRota.map((p) => (
            <Linha key={p.pedidoId} parada={p} destaque />
          ))}
        </Bloco>
      )}

      {aguardando.length > 0 && (
        <Bloco titulo={`Aguardando (${aguardando.length})`} cor="var(--color-accent-2-800)">
          {aguardando.map((p) => (
            <Linha key={p.pedidoId} parada={p} />
          ))}
        </Bloco>
      )}

      {rota.semLocalizacao.length > 0 && (
        <Bloco titulo={`Sem localização (${rota.semLocalizacao.length})`} cor="#8a2f10">
          <p className="legenda" style={{ margin: '0 0 6px' }}>
            O mapa não achou estes endereços. Ficam fora da rota calculada e o motorista entrega
            pelo endereço escrito.
          </p>
          {rota.semLocalizacao.map((p) => (
            <Linha key={p.pedidoId} parada={{ ...p, ordem: 0 }} />
          ))}
        </Bloco>
      )}

      {rota.entregues.length > 0 && (
        <Bloco titulo={`Entregues (${rota.entregues.length})`} cor="var(--color-accent-2-800)">
          {rota.entregues.map((e) => (
            <div key={e.pedidoId} className="parada-dono">
              <span className="parada-dono-ordem parada-dono-feita">✓</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="parada-dono-cliente">
                  #{e.numero} · {e.cliente}
                </span>
                <span className="legenda"> {e.bairro}</span>
              </span>
            </div>
          ))}
        </Bloco>
      )}
    </>
  )
}

function Bloco({
  titulo,
  cor,
  children,
}: {
  titulo: string
  cor: string
  children: React.ReactNode
}) {
  return (
    <section className="cartao" style={{ gap: 8 }}>
      <h2 className="titulo" style={{ fontSize: 15, color: cor }}>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

type LinhaParada = {
  pedidoId: number
  numero: number
  ordem: number
  cliente: string
  telefone: string
  endereco: string
  bairro: string
  totalCentavos: number
  trocoCentavos?: number | null
  tentativaAnterior?: { motivo: string | null } | null
}

function Linha({ parada, destaque = false }: { parada: LinhaParada; destaque?: boolean }) {
  return (
    <div className={`parada-dono ${destaque ? 'parada-dono-ativa' : ''}`}>
      <span className="parada-dono-ordem">{parada.ordem > 0 ? parada.ordem : '?'}</span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="parada-dono-cliente">
          #{parada.numero} · {parada.cliente}
        </span>
        <span className="legenda">
          {' '}
          {parada.endereco} — {parada.bairro} · {formatarTelefone(parada.telefone)}
        </span>
        {parada.tentativaAnterior && (
          <span className="parada-dono-alerta"> já tentada antes e não deu certo</span>
        )}
      </span>

      <span className="parada-dono-valor numerico">
        {brl(parada.totalCentavos)}
        {parada.trocoCentavos ? (
          <span className="parada-dono-troco">troco {brl(parada.trocoCentavos)}</span>
        ) : null}
      </span>
    </div>
  )
}
