import { useCallback, useEffect, useMemo, useState } from 'react'
import { chamar, ErroApi } from '../../../comum/api/http'
import type { Metricas } from '../../../comum/api/tipos'
import { Janela } from '../../../comum/componentes/Janela'
import { AvisoDeTrocos } from './AvisoDeTrocos'
import { CartaoEntregasHoje } from './CartaoEntregasHoje'
import { CartaoMaisVendidos } from './CartaoMaisVendidos'
import { CartaoPedidosPorDia } from './CartaoPedidosPorDia'
import { CartaoVendasSemana } from './CartaoVendasSemana'
import { DetalheEntregas } from './detalhes/DetalheEntregas'
import { DetalhePedidosPorDia } from './detalhes/DetalhePedidosPorDia'
import { DetalheRanking } from './detalhes/DetalheRanking'
import { DetalheVendas } from './detalhes/DetalheVendas'
import { FaixaResumo } from './FaixaResumo'
import type { Escalas } from './metricas.formato'

type Detalhe = 'vendas' | 'ranking' | 'dias' | 'entregas'

const TITULOS: Record<Detalhe, string> = {
  vendas: 'Vendas por semana — detalhes',
  ranking: 'Ranking completo de produtos',
  dias: 'Pedidos por dia — detalhes',
  entregas: 'Entregas de hoje — detalhes',
}

/**
 * Os números do negócio. Cada cartão resume um assunto e abre o detalhe
 * numa janela — o painel abre calmo e aprofunda só quando alguém pede.
 */
export function AbaMetricas() {
  const [dados, setDados] = useState<Metricas | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)

  // Separado do efeito porque cancelar um pedido muda a lista e os totais:
  // a janela aberta precisa reler os números sem fechar.
  const carregar = useCallback(async () => {
    try {
      setDados(await chamar<Metricas>('/api/admin/metricas'))
      setErro(null)
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui carregar os números.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // O maior valor de cada série define a altura cheia dos gráficos. Fica aqui
  // para o cartão e o detalhe usarem exatamente a mesma régua.
  const escalas = useMemo<Escalas>(() => {
    if (!dados) return { venda: 1, dia: 1, produto: 1 }
    return {
      venda: Math.max(
        ...dados.semanas.map((s) => s.totalCentavos),
        dados.resumo.metaSemanalCentavos,
        1,
      ),
      dia: Math.max(...dados.porDia.map((d) => d.pedidos), 1),
      produto: Math.max(...dados.maisVendidos.map((p) => p.unidadesVendidas), 1),
    }
  }, [dados])

  if (erro) return <div className="aviso-falha">{erro}</div>
  if (!dados) return <div className="carregando">Somando os pedidos…</div>

  const meta = dados.resumo.metaSemanalCentavos

  return (
    <>
      {/* Antes de tudo: é o único item do painel com hora marcada — vale até
          o motorista sair do galpão. */}
      <AvisoDeTrocos trocos={dados.entregas.trocos} />

      <FaixaResumo dados={dados} />

      <div className="duas-colunas">
        <CartaoVendasSemana
          semanas={dados.semanas}
          metaCentavos={meta}
          escalaVenda={escalas.venda}
          aoAbrir={() => setDetalhe('vendas')}
        />
        <CartaoMaisVendidos
          produtos={dados.maisVendidos}
          escalaProduto={escalas.produto}
          aoAbrir={() => setDetalhe('ranking')}
        />
      </div>

      <div className="duas-colunas">
        <CartaoPedidosPorDia
          dias={dados.porDia}
          escalaDia={escalas.dia}
          aoAbrir={() => setDetalhe('dias')}
        />
        <CartaoEntregasHoje entregas={dados.entregas} aoAbrir={() => setDetalhe('entregas')} />
      </div>

      {detalhe && (
        <Janela titulo={TITULOS[detalhe]} aoFechar={() => setDetalhe(null)}>
          {detalhe === 'vendas' && (
            <DetalheVendas semanas={dados.semanas} metaCentavos={meta} escalaVenda={escalas.venda} />
          )}
          {detalhe === 'ranking' && (
            <DetalheRanking produtos={dados.maisVendidos} escalaProduto={escalas.produto} />
          )}
          {detalhe === 'dias' && <DetalhePedidosPorDia dias={dados.porDia} escalaDia={escalas.dia} />}
          {detalhe === 'entregas' && (
            <DetalheEntregas entregas={dados.entregas} aoMudar={() => void carregar()} />
          )}
        </Janela>
      )}
    </>
  )
}
