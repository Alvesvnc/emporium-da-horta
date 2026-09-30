import type { MotivoNaoEntrega, Parada, TentativaAnterior } from '@emporium/shared'
import type { PosicaoAoVivo } from '../../comum/ganchos/useLocalizacaoAoVivo'
import { brl } from '../../comum/formato/dinheiro'
import { distanciaCurta, distanciaKm } from '../../comum/mapa/geo'
import { rotuloUnidade } from '../../comum/formato/unidades'
import { apenasDigitos, formatarTelefone, linkWhatsapp } from '../../comum/formato/telefone'
import { useState } from 'react'
import { ConfirmarEntrega } from './ConfirmarEntrega'
import { NaoEntregue } from './NaoEntregue'
import { AVISO_A_CAMINHO } from './mensagens'

const PAGAMENTO: Record<string, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
}

/**
 * A que distância se pode dizer "chegou".
 *
 * 70 m cobre a imprecisão normal de GPS urbano sem acender em cima do vizinho.
 * Mas só vale se o próprio aparelho estiver confiante: com 300 m de incerteza,
 * "você chegou" seria chute — e chute com cara de certeza é o pior recado que
 * se pode dar a quem está dirigindo.
 */
const RAIO_CHEGADA_M = 70
const INCERTEZA_MAXIMA_M = 120

const MOTIVO_ESCRITO: Record<MotivoNaoEntrega, string> = {
  ausente: 'ninguém atendeu',
  endereco_nao_encontrado: 'endereço não encontrado',
  recusado: 'cliente recusou',
  outro: 'outro motivo',
}

/** "já se tentou ontem, e ninguém atendeu" — em uma linha. */
function resumoDaTentativa(tentativa: TentativaAnterior): string {
  const quando = tentativa.em
    ? new Date(tentativa.em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : 'antes'
  const porque = tentativa.motivo ? MOTIVO_ESCRITO[tentativa.motivo] : 'não deu certo'
  return `Já foi tentada em ${quando}: ${porque}.`
}

/**
 * A parada de agora, em destaque.
 *
 * O motorista usa isto com uma mão, no trânsito, sem tempo de procurar nada:
 * para onde ir, o que descarregar, quanto receber e como. Os itens já vêm
 * abertos — conferir a carga é o que evita a entrega errada, e ninguém vai
 * lembrar de tocar num "ver itens" antes de descer do carro.
 */
export function ProximaParada({
  parada,
  indice,
  total,
  salvando,
  aoEntregar,
  ondeEstou,
  aoNavegar,
  navegando,
  aoNaoEntregar,
}: {
  parada: Parada
  /** Qual parada do dia é esta: "PARADA 3 DE 8". */
  indice: number
  total: number
  salvando: boolean
  aoEntregar: (recebidoPor: string, foto: File | null) => void
  /** Posição do motorista, quando ele ligou o GPS. */
  ondeEstou?: PosicaoAoVivo | null
  /** Começa a navegação curva a curva dentro do site. */
  aoNavegar: () => void
  navegando: boolean
  aoNaoEntregar: (motivo: MotivoNaoEntrega, observacao: string) => void
}) {
  const aproximado = parada.precisao !== 'exata'

  // Distância em linha reta até a parada. Não é o caminho pelas ruas — serve
  // para "está perto?", que é o que importa com o carro andando.
  const kmDaqui = ondeEstou ? distanciaKm(ondeEstou, parada) : null
  const confiavel = ondeEstou ? ondeEstou.precisaoMetros <= INCERTEZA_MAXIMA_M : false
  const chegou = kmDaqui !== null && confiavel && kmDaqui * 1000 <= RAIO_CHEGADA_M

  const [fechando, setFechando] = useState(false)

  // Mensagem já escrita: com o carro na rua, ninguém digita.
  const zap = linkWhatsapp(parada.telefone, AVISO_A_CAMINHO)

  return (
    <section className="parada-atual">
      <div className="parada-atual-topo">
        <span className="parada-atual-contador">
          PARADA {indice} DE {total}
        </span>
        {parada.minutos > 0 && (
          <span className="parada-atual-tempo">
            {parada.minutos} min · {parada.distanciaKm.toFixed(1).replace('.', ',')} km
          </span>
        )}
      </div>

      <h2 className="parada-atual-endereco">{parada.endereco}</h2>
      <p className="parada-atual-bairro">
        {parada.bairro}
        {parada.complemento && ` · ${parada.complemento}`}
      </p>

      {aproximado && (
        <p className="parada-atual-alerta">
          Endereço aproximado — o mapa marca o bairro, não a casa. Confirme com o cliente.
        </p>
      )}

      {parada.tentativaAnterior && (
        <div className="parada-atual-retentativa">
          <strong>{resumoDaTentativa(parada.tentativaAnterior)}</strong>
          {parada.tentativaAnterior.observacao && <> {parada.tentativaAnterior.observacao}</>}
          <br />
          Ligue ou mande mensagem antes de descer.
        </div>
      )}

      {kmDaqui !== null && (
        <div className={`parada-atual-aovivo ${chegou ? 'parada-atual-chegou' : ''}`}>
          {chegou
            ? 'Você chegou. Confira o número antes de descer.'
            : confiavel
              ? `A ${distanciaCurta(kmDaqui)} daqui, em linha reta.`
              : `A ${distanciaCurta(kmDaqui)} daqui — sinal fraco, a posição pode estar errada.`}
        </div>
      )}

      <div className="parada-atual-cliente">
        <span>
          #{parada.numero} · {parada.cliente}
        </span>
        <span className="parada-atual-contatos">
          <a href={`tel:${apenasDigitos(parada.telefone)}`}>{formatarTelefone(parada.telefone)}</a>
          {zap && (
            <a href={zap} target="_blank" rel="noreferrer" className="parada-atual-zap">
              WhatsApp
            </a>
          )}
        </span>
      </div>

      <ul className="parada-atual-itens">
        {parada.itens.map((item) => (
          <li key={item.id}>
            <span className="parada-atual-emoji">{item.emojiProduto}</span>
            <span className="parada-atual-nome">{item.nomeProduto}</span>
            <span className="parada-atual-qtd numerico">
              {item.quantidade} {rotuloUnidade(item.unidade)}
            </span>
          </li>
        ))}
      </ul>

      <div className="parada-atual-cobranca">
        Receber <b className="numerico">{brl(parada.totalCentavos)}</b> em{' '}
        {PAGAMENTO[parada.formaPagamento] ?? parada.formaPagamento}
      </div>

      {/* O cliente disse com quanto vai pagar lá no pedido. Sem isto, o
          motorista descobre na porta que precisa de troco. */}
      {parada.pagaComCentavos !== null && (
        <div className="parada-atual-troco">
          {parada.trocoCentavos === 0 ? (
            <>
              Cliente paga <b className="numerico">{brl(parada.pagaComCentavos)}</b> — valor exato,
              sem troco.
            </>
          ) : (
            <>
              Cliente paga com <b className="numerico">{brl(parada.pagaComCentavos)}</b> · levar{' '}
              <b className="numerico">{brl(parada.trocoCentavos ?? 0)}</b> de troco
            </>
          )}
        </div>
      )}

      {fechando ? (
        <ConfirmarEntrega
          nomeDoCliente={parada.cliente}
          salvando={salvando}
          aoConfirmar={(recebidoPor, foto) => aoEntregar(recebidoPor, foto)}
          aoCancelar={() => setFechando(false)}
        />
      ) : (
        <div className="parada-atual-acoes">
          <button
            type="button"
            className="botao acao-navegar"
            onClick={aoNavegar}
            disabled={navegando}
          >
            {navegando ? 'Navegando…' : 'Navegar'}
          </button>
          <button
            type="button"
            className="botao acao-entregue"
            disabled={salvando}
            onClick={() => setFechando(true)}
          >
            Entregue
          </button>
        </div>
      )}

      {/* A navegação daqui usa mapa aberto e não conhece trânsito. Para rua
          complicada, o aplicativo do celular continua sendo melhor — e negar
          isso ao motorista não ajudaria ninguém. */}
      <a
        href={parada.linkNavegacao}
        target="_blank"
        rel="noreferrer"
        className="parada-atual-alternativa"
      >
        ou abrir no Google Maps
      </a>

      <NaoEntregue salvando={salvando} aoRegistrar={aoNaoEntregar} />
    </section>
  )
}
