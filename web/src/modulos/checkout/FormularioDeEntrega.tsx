import { useCallback, useRef } from 'react'
import { brl, paraCentavos } from '../../comum/formato/dinheiro'
import { formatarTelefone, MAXIMO_TELEFONE } from '../../comum/formato/telefone'
import type { DadosCheckout } from './checkout.tipos'
import { SecaoFormulario } from './SecaoFormulario'
import { formatarCep, useBuscaCep } from '../../comum/ganchos/useBuscaCep'

const PAGAMENTOS = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
] as const

/**
 * Lado direito do checkout: contato, endereço, pagamento e agendamento.
 *
 * Todos os blocos ficam antes do botão de confirmar, para ninguém descobrir
 * que falta um campo depois de achar que terminou.
 */
export function FormularioDeEntrega({
  dados,
  aoMudar,
  janelaEntrega,
  totalCentavos,
  enviando,
  podeEnviar,
  erro,
  aoConfirmar,
}: {
  dados: DadosCheckout
  aoMudar: <C extends keyof DadosCheckout>(campo: C, valor: DadosCheckout[C]) => void
  janelaEntrega: string
  totalCentavos: number
  enviando: boolean
  podeEnviar: boolean
  erro: string
  aoConfirmar: () => void
}) {
  const campoNumero = useRef<HTMLInputElement>(null)

  const preencherPeloCep = useCallback(
    (endereco: { bairro: string; rua: string }) => {
      // Bairro e rua vêm do CEP; o número é a única coisa que o CEP não sabe,
      // então o cursor já pula para lá.
      aoMudar('bairro', endereco.bairro)
      aoMudar('rua', endereco.rua)
      campoNumero.current?.focus()
    },
    [aoMudar],
  )

  const { estado: buscaCep, buscar } = useBuscaCep(preencherPeloCep)

  /**
   * O troco, enquanto a pessoa digita.
   *
   * Null quando o campo está vazio ou o valor não cobre o pedido — nos dois
   * casos não há troco a anunciar, e mostrar um número negativo assustaria
   * quem só ainda não terminou de digitar. Quem barra de verdade é o servidor.
   */
  const pagouEmCentavos =
    dados.pagamento === 'dinheiro' ? paraCentavos(dados.pagaCom) : null
  const troco =
    pagouEmCentavos !== null && pagouEmCentavos >= totalCentavos
      ? pagouEmCentavos - totalCentavos
      : null

  return (
    <section className="cartao" style={{ gap: 12 }}>
      <SecaoFormulario titulo="Informações de contato" obrigatorio />
      <input
        className="campo"
        value={dados.nome}
        onChange={(e) => aoMudar('nome', e.target.value)}
        placeholder="Nome completo"
        autoComplete="name"
      />
      <input
        className="campo"
        value={dados.telefone}
        onChange={(e) => aoMudar('telefone', formatarTelefone(e.target.value))}
        placeholder="Telefone / WhatsApp — (92) 9…"
        inputMode="tel"
        autoComplete="tel"
        maxLength={MAXIMO_TELEFONE}
      />

      <SecaoFormulario titulo="Localização" obrigatorio />
      <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 8 }}>
        <input
          className="campo"
          value={dados.cep}
          onChange={(e) => {
            const cep = formatarCep(e.target.value)
            aoMudar('cep', cep)
            void buscar(cep)
          }}
          placeholder="CEP"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={9}
          style={{ padding: '12px 18px' }}
        />
        <input
          className="campo"
          value={dados.bairro}
          onChange={(e) => aoMudar('bairro', e.target.value)}
          placeholder="Bairro"
          style={{ padding: '12px 18px' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 8 }}>
        <input
          className="campo"
          value={dados.rua}
          onChange={(e) => aoMudar('rua', e.target.value)}
          placeholder="Rua / avenida"
          autoComplete="street-address"
          style={{ padding: '12px 18px' }}
        />
        <input
          ref={campoNumero}
          className="campo"
          value={dados.numero}
          onChange={(e) => aoMudar('numero', e.target.value)}
          placeholder="Nº"
          inputMode="numeric"
          style={{ padding: '12px 18px' }}
        />
      </div>
      <input
        className="campo"
        value={dados.complemento}
        onChange={(e) => aoMudar('complemento', e.target.value)}
        placeholder="Complemento e ponto de referência (opcional)"
        style={{ padding: '12px 18px' }}
      />

      {buscaCep !== 'parado' && (
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            margin: 0,
            color:
              buscaCep === 'nao-encontrado'
                ? 'var(--color-accent-700)'
                : 'var(--color-neutral-500)',
          }}
        >
          {buscaCep === 'buscando' && 'Procurando o endereço…'}
          {buscaCep === 'encontrado' && 'Endereço preenchido pelo CEP — confira o número.'}
          {buscaCep === 'nao-encontrado' && 'Não encontrei esse CEP. Pode preencher à mão.'}
        </p>
      )}

      <SecaoFormulario titulo="Forma de pagamento" obrigatorio />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {PAGAMENTOS.map((forma) => (
          <button
            key={forma.valor}
            type="button"
            className="opcao"
            aria-pressed={dados.pagamento === forma.valor}
            onClick={() => aoMudar('pagamento', forma.valor)}
          >
            {forma.rotulo}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-500)', margin: 0 }}>
        O pagamento é feito na entrega, direto com o entregador.
      </p>

      {/*
        Só em dinheiro, e opcional. Perguntar com quanto a pessoa vai pagar é o
        que permite separar o troco no galpão, antes de o motorista sair — na
        porta do cliente já é tarde. Em branco quer dizer "levo o valor certo".
      */}
      {dados.pagamento === 'dinheiro' && (
        <div className="troco-campo">
          <label className="campo-rotulo">
            Vai pagar com quanto?
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-accent-2-900)' }}>
                R$
              </span>
              <input
                className="campo numerico"
                value={dados.pagaCom}
                onChange={(e) => aoMudar('pagaCom', e.target.value)}
                inputMode="decimal"
                placeholder="50,00"
                maxLength={12}
                style={{ width: 130, padding: '11px 16px', fontWeight: 700 }}
              />
            </div>
          </label>
          <p className="troco-ajuda">
            {troco === null
              ? `Deixe em branco se for pagar ${brl(totalCentavos)} certinho. Assim o entregador já sai com o troco separado.`
              : troco === 0
                ? 'Valor exato — sem troco.'
                : `O entregador leva ${brl(troco)} de troco.`}
          </p>
        </div>
      )}

      <SecaoFormulario titulo="Dia e hora para receber" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="campo"
          type="date"
          value={dados.data}
          onChange={(e) => aoMudar('data', e.target.value)}
          aria-label="Dia para receber"
          style={{ flex: 1, minWidth: 140, width: 'auto', padding: '11px 18px', fontSize: 13.5 }}
        />
        <input
          className="campo"
          type="time"
          value={dados.hora}
          onChange={(e) => aoMudar('hora', e.target.value)}
          aria-label="Hora para receber"
          style={{ width: 130, padding: '11px 18px', fontSize: 13.5 }}
        />
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-500)', margin: 0 }}>
        Sem agendamento, entregamos {janelaEntrega}.
      </p>


      <button
        type="button"
        className="botao botao-verde"
        style={{ marginTop: 4, padding: 15 }}
        onClick={aoConfirmar}
        disabled={enviando || !podeEnviar}
      >
        {enviando ? 'Enviando…' : `Confirmar pedido · ${brl(totalCentavos)}`}
      </button>

      {erro && <div className="erro">{erro}</div>}
    </section>
  )
}
