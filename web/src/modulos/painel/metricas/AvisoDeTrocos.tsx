import type { Metricas } from '../../../comum/api/tipos'
import { brl } from '../../../comum/formato/dinheiro'

/**
 * Os trocos que precisam sair separados do galpão.
 *
 * É a informação mais perecível do painel: depois que o carro saiu, saber que
 * faltam R$ 12 de troco não serve para nada. Por isso fica no topo, em
 * destaque, e some sozinho quando não há nenhum — aviso que aparece todo dia
 * vira paisagem e ninguém lê.
 *
 * Some também conforme as entregas são feitas: o que já foi entregue não
 * precisa mais de troco separado.
 */
export function AvisoDeTrocos({ trocos }: { trocos: Metricas['entregas']['trocos'] }) {
  // Valor exato não é troco: o cliente já vai com o dinheiro contado.
  const precisamDeTroco = trocos.filter((t) => t.trocoCentavos > 0)
  if (precisamDeTroco.length === 0) return null

  const total = precisamDeTroco.reduce((soma, t) => soma + t.trocoCentavos, 0)

  return (
    <section className="aviso-trocos">
      <div className="aviso-trocos-topo">
        <h2 className="titulo aviso-trocos-titulo">
          Separe {brl(total)} em troco antes de o motorista sair
        </h2>
        <span className="aviso-trocos-contador">
          {precisamDeTroco.length} {precisamDeTroco.length === 1 ? 'entrega' : 'entregas'}
        </span>
      </div>

      <ul className="aviso-trocos-lista">
        {precisamDeTroco.map((t) => (
          <li key={t.numero}>
            <span className="aviso-trocos-pedido">
              #{t.numero} · {t.cliente}
            </span>
            <span className="aviso-trocos-detalhe">
              {t.bairro} · paga com <b className="numerico">{brl(t.pagaComCentavos)}</b> em{' '}
              {brl(t.totalCentavos)}
            </span>
            <span className="aviso-trocos-valor numerico">{brl(t.trocoCentavos)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
