import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chamar, ErroApi } from '../../comum/api/http'
import { Cabecalho } from '../../comum/componentes/Cabecalho'
import { useCarrinho } from '../../comum/estado/CarrinhoContexto'
import { useSessao } from '../../comum/estado/SessaoContexto'
import { useLoja } from '../../comum/ganchos/useLoja'
import { DADOS_VAZIOS, type Confirmacao, type DadosCheckout, type ItemDoCarrinho } from './checkout.tipos'
import { FormularioDeEntrega } from './FormularioDeEntrega'
import { ResumoDoPedido } from './ResumoDoPedido'
import { TelaPedidoConfirmado } from './TelaPedidoConfirmado'

/**
 * Fecha o pedido. Esta tela junta o carrinho com os dados de entrega e manda
 * para a API — que é quem soma tudo de novo com os preços atuais.
 */
export function TelaCheckout() {
  const navegar = useNavigate()
  const { dados: loja, carregando } = useLoja()
  const { contato, salvarContato } = useSessao()
  const carrinho = useCarrinho()

  /**
   * O contato da última compra preenche o formulário.
   *
   * Não é login: fica só neste navegador e não dá acesso a nada. É só para
   * quem compra toda semana não redigitar nome e telefone toda vez.
   */
  const [dados, setDados] = useState<DadosCheckout>({
    ...DADOS_VAZIOS,
    nome: contato?.nome ?? '',
    telefone: contato?.telefone ?? '',
  })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  function aoMudar<C extends keyof DadosCheckout>(campo: C, valor: DadosCheckout[C]) {
    setDados((atual) => ({ ...atual, [campo]: valor }))
  }

  const itens = useMemo<ItemDoCarrinho[]>(() => {
    const porId = new Map((loja?.produtos ?? []).map((p) => [p.id, p]))
    return Object.entries(carrinho.itens)
      .map(([id, quantidade]) => {
        const produto = porId.get(Number(id))
        return produto ? { produto, quantidade } : null
      })
      .filter((i): i is ItemDoCarrinho => i !== null)
  }, [loja, carrinho.itens])

  const config = loja?.configuracoes
  const subtotal = itens.reduce((soma, i) => soma + i.produto.precoCentavos * i.quantidade, 0)
  const frete = !config || subtotal >= config.entregaGratisAcimaCentavos ? 0 : config.taxaEntregaCentavos
  const total = subtotal + (itens.length ? frete : 0)

  async function confirmar() {
    setEnviando(true)
    setErro('')
    try {
      const resposta = await chamar<{
        pedido: { numero: number; totalCentavos: number }
        previsao: string
      }>('/api/pedidos', {
        corpo: {
          itens: itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
          contato: { nome: dados.nome, telefone: dados.telefone },
          endereco: {
            cep: dados.cep,
            bairro: dados.bairro,
            rua: dados.rua,
            numero: dados.numero,
            complemento: dados.complemento,
          },
          formaPagamento: dados.pagamento,
          // Só faz sentido em dinheiro; nas outras formas nem é enviado.
          pagaCom: dados.pagamento === 'dinheiro' ? dados.pagaCom : undefined,
          agendamento: dados.data ? { data: dados.data, hora: dados.hora || null } : null,
        },
      })

      // Guarda o contato para a próxima compra já vir preenchida. Não é login:
      // acompanhar o pedido continua sendo número + telefone.
      salvarContato({ nome: dados.nome.trim(), telefone: dados.telefone.trim() })
      carrinho.esvaziar()

      setConfirmacao({
        numero: resposta.pedido.numero,
        totalCentavos: resposta.pedido.totalCentavos,
        previsao: resposta.previsao,
      })
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui enviar seu pedido.')
    } finally {
      setEnviando(false)
    }
  }

  if (confirmacao) {
    return <TelaPedidoConfirmado confirmacao={confirmacao} />
  }

  return (
    <div className="aplicacao">
      <Cabecalho subtitulo="Finalizar pedido" />

      <main className="conteudo" style={{ maxWidth: 920, padding: '24px 20px 48px', gap: 16 }}>
        <button
          type="button"
          className="botao-texto"
          style={{
            alignSelf: 'flex-start',
            color: 'var(--color-accent-2-700)',
            fontWeight: 700,
            fontSize: 13.5,
            padding: '4px 0',
          }}
          onClick={() => navegar('/')}
        >
          ← Continuar comprando
        </button>

        {carregando && <div className="carregando">Carregando seu pedido…</div>}

        {!carregando && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <ResumoDoPedido
              itens={itens}
              subtotalCentavos={subtotal}
              freteCentavos={frete}
              totalCentavos={total}
              pedidoMinimoCentavos={config?.pedidoMinimoCentavos ?? null}
              aoRemover={carrinho.tirar}
            />

            <FormularioDeEntrega
              dados={dados}
              aoMudar={aoMudar}
              janelaEntrega={config?.janelaEntrega ?? 'hoje entre 15h e 18h'}
              totalCentavos={total}
              enviando={enviando}
              podeEnviar={itens.length > 0}
              erro={erro}
              aoConfirmar={() => void confirmar()}
            />
          </div>
        )}
      </main>
    </div>
  )
}
