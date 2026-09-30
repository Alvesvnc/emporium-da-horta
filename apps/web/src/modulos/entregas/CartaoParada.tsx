import { useState } from 'react'
import type { MotivoNaoEntrega, Parada, Precisao } from '@emporium/shared'
import { brl } from '../../comum/formato/dinheiro'
import { apenasDigitos, formatarTelefone, linkWhatsapp } from '../../comum/formato/telefone'
import { rotuloUnidade } from '../../comum/formato/unidades'
import { ConfirmarEntrega } from './ConfirmarEntrega'
import { AVISO_A_CAMINHO } from './mensagens'
import { NaoEntregue } from './NaoEntregue'

/** O que o motorista precisa saber antes de confiar no pino. */
const AVISO_PRECISAO: Record<Precisao, string | null> = {
  exata: null,
  aproximada: 'Endereço não encontrado no mapa — o pino é o centro do bairro.',
  desconhecida: 'Sem localização: use o endereço escrito.',
}

/** Uma parada aceita sem coordenada: entra na lista, fica fora do mapa. */
export type ParadaExibida = Omit<Parada, 'latitude' | 'longitude' | 'agendadoPara'> &
  Partial<Pick<Parada, 'latitude' | 'longitude' | 'agendadoPara'>>

/**
 * Uma entrega na lista do motorista: para onde ir, o que conferir e o que fazer
 * quando chegar lá.
 *
 * Tem as MESMAS ações da parada da vez — entregar com comprovante, ou registrar
 * que não deu certo. Isso não é simetria por capricho: as paradas sem
 * localização nunca chegam a ser "a parada da vez", porque ficam fora da rota
 * calculada. Sem as ações aqui, justamente as entregas que mais falham — as que
 * o mapa não achou — seriam as únicas em que o motorista não conseguiria
 * registrar a falha.
 */
export function CartaoParada({
  parada,
  salvando,
  aoEntregar,
  aoNaoEntregar,
}: {
  parada: ParadaExibida
  salvando: boolean
  aoEntregar: (recebidoPor: string, foto: File | null) => void
  aoNaoEntregar: (motivo: MotivoNaoEntrega, observacao: string) => void
}) {
  const [aberta, setAberta] = useState(false)
  const [fechando, setFechando] = useState(false)
  const avisoPrecisao = AVISO_PRECISAO[parada.precisao]
  const zap = linkWhatsapp(parada.telefone, AVISO_A_CAMINHO)

  return (
    <article className="parada" style={{ background: 'var(--color-bg)' }}>
      <div className="parada-linha">
        <span
          className="parada-numero"
          style={{ background: parada.ordem > 0 ? 'var(--color-accent-2)' : 'var(--color-neutral-400)' }}
        >
          {parada.ordem > 0 ? parada.ordem : '?'}
        </span>

        <button
          type="button"
          onClick={() => setAberta((atual) => !atual)}
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            font: 'inherit',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>
            #{parada.numero} · {parada.cliente}
          </div>
          <div className="legenda">
            {parada.endereco} — {parada.bairro}
            {parada.ordem > 0 &&
              ` · ${parada.distanciaKm.toFixed(1).replace('.', ',')} km · ${parada.minutos} min`}
          </div>
        </button>

        <a
          href={parada.linkNavegacao}
          target="_blank"
          rel="noreferrer"
          className="botao botao-navegar"
          title="Abrir no Google Maps"
        >
          Navegar
        </a>

        <button
          type="button"
          className="botao botao-itens"
          aria-expanded={aberta}
          onClick={() => setAberta((atual) => !atual)}
        >
          {parada.itens.length} itens {aberta ? '▴' : '▾'}
        </button>

        <button
          type="button"
          className="botao botao-entregue"
          disabled={salvando}
          onClick={() => setFechando(true)}
        >
          Entregue
        </button>
      </div>

      {avisoPrecisao && (
        <p
          style={{
            margin: '0 14px 10px 54px',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--color-accent-700)',
          }}
        >
          {avisoPrecisao}
        </p>
      )}

      {aberta && (
        <div style={{ padding: '2px 14px 14px 54px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              color: 'var(--color-neutral-500)',
              letterSpacing: 0.6,
            }}
          >
            CONFERIR NA ENTREGA · {parada.itens.length} itens · {brl(parada.totalCentavos)} em{' '}
            {parada.formaPagamento}
          </div>

          {parada.pagaComCentavos !== null && (
            <div
              style={{
                background: 'var(--color-accent-100)',
                color: 'var(--color-accent-800)',
                borderRadius: 10,
                padding: '7px 11px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {parada.trocoCentavos === 0
                ? `Paga ${brl(parada.pagaComCentavos)} — valor exato.`
                : `Paga com ${brl(parada.pagaComCentavos)} · levar ${brl(parada.trocoCentavos ?? 0)} de troco`}
            </div>
          )}

          {parada.itens.map((item) => (
            <div
              key={item.id}
              style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600 }}
            >
              <span style={{ fontSize: 16 }}>{item.emojiProduto}</span>
              <span style={{ flex: 1 }}>{item.nomeProduto}</span>
              <span
                className="numerico"
                style={{
                  background: 'var(--color-accent-2-100)',
                  borderRadius: 999,
                  padding: '2px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-accent-2-900)',
                }}
              >
                {item.quantidade} {rotuloUnidade(item.unidade)}
              </span>
            </div>
          ))}

          {parada.complemento && (
            <p className="legenda" style={{ margin: '4px 0 0' }}>
              {parada.complemento}
            </p>
          )}

          <div style={{ marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a
              href={`tel:${apenasDigitos(parada.telefone)}`}
              className="legenda"
              style={{ color: 'var(--color-accent-2-700)', fontWeight: 700 }}
            >
              Ligar para {formatarTelefone(parada.telefone)}
            </a>
            {zap && (
              <a
                href={zap}
                target="_blank"
                rel="noreferrer"
                className="legenda"
                style={{ color: '#128c7e', fontWeight: 700 }}
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {/* As mesmas ações da parada da vez. Ficam fora do bloco que expande:
          registrar que a entrega não deu certo não pode depender de o motorista
          descobrir que existe um "ver itens" para tocar antes. */}
      <div className="parada-acoes-extra">
        {fechando ? (
          <ConfirmarEntrega
            nomeDoCliente={parada.cliente}
            salvando={salvando}
            aoConfirmar={aoEntregar}
            aoCancelar={() => setFechando(false)}
          />
        ) : (
          <NaoEntregue salvando={salvando} aoRegistrar={aoNaoEntregar} />
        )}
      </div>
    </article>
  )
}
