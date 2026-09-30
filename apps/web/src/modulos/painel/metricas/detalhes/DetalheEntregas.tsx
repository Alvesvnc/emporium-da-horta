import { useState } from 'react'
import { chamar, ErroApi } from '../../../../comum/api/http'
import type { Metricas, MotivoNaoEntrega } from '@emporium/shared'
import { brl } from '../../../../comum/formato/dinheiro'

/** Lista das entregas de hoje, uma por linha, com o estado de cada uma. */

const MOTIVO_ESCRITO: Record<MotivoNaoEntrega, string> = {
  ausente: 'ninguém atendeu',
  endereco_nao_encontrado: 'endereço não encontrado',
  recusado: 'cliente recusou',
  outro: 'outro motivo',
}

const SELO: Record<string, { texto: string; fundo: string; cor: string }> = {
  entregue: {
    texto: 'Entregue',
    fundo: 'var(--color-accent-2-100)',
    cor: 'var(--color-accent-2-800)',
  },
  em_rota: { texto: 'Em rota', fundo: 'var(--color-accent-100)', cor: 'var(--color-accent-700)' },
  nao_entregue: { texto: 'Não entregue', fundo: '#f6dcd2', cor: '#8a2f10' },
}

const AGUARDANDO = {
  texto: 'Aguardando',
  fundo: 'var(--color-accent-100)',
  cor: 'var(--color-accent-700)',
}

export function DetalheEntregas({
  entregas,
  aoMudar,
}: {
  entregas: Metricas['entregas']
  /** Recarrega os números depois de cancelar — a lista e os totais mudaram. */
  aoMudar: () => void
}) {
  const [cancelando, setCancelando] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function cancelar(id: number) {
    setCancelando(id)
    setErro(null)
    try {
      await chamar(`/api/admin/pedidos/${id}/cancelar`, { metodo: 'PATCH' })
      setConfirmando(null)
      aoMudar()
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui cancelar o pedido.')
    } finally {
      setCancelando(null)
    }
  }

  return (
    <>
      {erro && <div className="aviso-falha">{erro}</div>}
      {entregas.lista.length === 0 && <p className="apagado">Nenhum pedido hoje ainda.</p>}

      {entregas.lista.map((entrega) => {
        const selo = SELO[entrega.status] ?? AGUARDANDO
        const horario = new Date(entrega.criadoEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
        // Pedido de outro dia que ainda não se resolveu. O dono precisa
        // enxergar isso: é mercadoria parada e cliente esperando.
        const deOutroDia =
          new Date(entrega.criadoEm).toDateString() !== new Date().toDateString()
        const dia = new Date(entrega.criadoEm).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        })

        return (
          <div key={entrega.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--color-neutral-200)' }}>
            <div className="linha">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  #{entrega.numero} · {entrega.cliente}
                </div>
                <div className="legenda">
                  {entrega.bairro} · {deOutroDia ? `pedido em ${dia}` : `pedido às ${horario}`} ·{' '}
                  {brl(entrega.totalCentavos)}
                </div>
              </div>

              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  padding: '5px 16px',
                  borderRadius: 999,
                  background: selo.fundo,
                  color: selo.cor,
                }}
              >
                {selo.texto}
              </span>
            </div>

            {entrega.status === 'nao_entregue' && (
              <div
                style={{
                  marginTop: 7,
                  background: '#fdf3ef',
                  borderRadius: 12,
                  padding: '9px 13px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#8a2f10',
                }}
              >
                <b>
                  O motorista tentou
                  {entrega.tentadoEm &&
                    ` em ${new Date(entrega.tentadoEm).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}`}
                  : {entrega.motivoNaoEntrega ? MOTIVO_ESCRITO[entrega.motivoNaoEntrega] : 'não deu certo'}.
                </b>
                {entrega.observacaoEntrega && <> {entrega.observacaoEntrega}</>}
                <br />
                Volta para a rota todos os dias até ser entregue ou cancelada.
              </div>
            )}

            {/* Entregue não se cancela: a mercadoria saiu e o cliente recebeu. */}
            {entrega.status !== 'entregue' && (
              <div style={{ marginTop: 7 }}>
                {confirmando === entrega.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                      Cancelar o pedido #{entrega.numero}?
                    </span>
                    <button
                      type="button"
                      className="botao"
                      style={{
                        background: 'var(--color-accent)',
                        color: 'var(--color-neutral-100)',
                        border: 'none',
                        padding: '7px 16px',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                      disabled={cancelando === entrega.id}
                      onClick={() => void cancelar(entrega.id)}
                    >
                      {cancelando === entrega.id ? 'Cancelando…' : 'Sim, cancelar'}
                    </button>
                    <button
                      type="button"
                      className="botao botao-contorno"
                      style={{ padding: '7px 16px', fontSize: 12 }}
                      onClick={() => setConfirmando(null)}
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(entrega.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-neutral-600)',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Cancelar pedido
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="resumo-faixa">
        <span>{entregas.entregues} entregues</span>
        <span>{entregas.emRota} em rota</span>
        <span>{entregas.aguardando} aguardando</span>
        {entregas.naoEntregues > 0 && <span>{entregas.naoEntregues} não entregues</span>}
        <span>
          Tempo médio: {entregas.tempoMedioMinutos === null ? '—' : `${entregas.tempoMedioMinutos} min`}
        </span>
      </div>
    </>
  )
}
