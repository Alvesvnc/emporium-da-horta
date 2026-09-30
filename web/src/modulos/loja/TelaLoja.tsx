import { useMemo, useState } from 'react'
import './loja.css'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Cabecalho } from '../../comum/componentes/Cabecalho'
import { useCarrinho } from '../../comum/estado/CarrinhoContexto'
import { useSessao } from '../../comum/estado/SessaoContexto'
import { useLoja } from '../../comum/ganchos/useLoja'
import { BarraCarrinho } from './BarraCarrinho'
import { CampoBusca } from './CampoBusca'
import { CartaoProduto } from './CartaoProduto'
import { FiltroCategorias } from './FiltroCategorias'
import { VitrineHero } from './VitrineHero'

/** A banca: vitrine, busca, filtro por categoria e a grade de produtos. */
export function TelaLoja() {
  const navegar = useNavigate()
  const local = useLocation()
  const { dados, carregando, erro, recarregar } = useLoja()
  const { contato } = useSessao()
  const carrinho = useCarrinho()

  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('Todos')

  // Recado trazido de outra tela — hoje, o "pedir de novo" de Meus pedidos.
  const avisoDaNavegacao =
    local.state && typeof local.state === 'object' && 'aviso' in local.state
      ? ((local.state as { aviso: string | null }).aviso ?? null)
      : null

  const categorias = useMemo(
    () => ['Todos', ...(dados?.categorias.map((c) => c.nome) ?? []), 'Ofertas'],
    [dados],
  )

  const visiveis = useMemo(() => {
    const produtos = dados?.produtos ?? []
    const termo = busca.trim().toLowerCase()
    return produtos.filter((p) => {
      const daCategoria =
        categoria === 'Todos' ? true : categoria === 'Ofertas' ? p.oferta : p.categoria === categoria
      const daBusca = !termo || p.nome.toLowerCase().includes(termo)
      return daCategoria && daBusca
    })
  }, [dados, busca, categoria])

  const totalDoCarrinho = useMemo(() => {
    const porId = new Map((dados?.produtos ?? []).map((p) => [p.id, p]))
    return Object.entries(carrinho.itens).reduce((soma, [id, qtd]) => {
      const produto = porId.get(Number(id))
      return produto ? soma + produto.precoCentavos * qtd : soma
    }, 0)
  }, [dados, carrinho.itens])

  const primeiroNome = contato?.nome?.split(' ')[0]

  return (
    <div className="aplicacao">
      <Cabecalho subtitulo={primeiroNome ? `Olá, ${primeiroNome}` : 'Atacado & Varejo · Manaus'} />

      <main className="conteudo" style={{ maxWidth: 1120, padding: '24px 20px 120px', gap: 18 }}>
        <VitrineHero primeiroNome={primeiroNome} configuracoes={dados?.configuracoes ?? null} />

        <CampoBusca valor={busca} aoMudar={setBusca} />

        <FiltroCategorias opcoes={categorias} ativa={categoria} aoEscolher={setCategoria} />

        <div className="entre">
          <h2 className="titulo" style={{ fontSize: 18, color: 'var(--color-accent-2-900)' }}>
            {categoria === 'Todos' ? 'Todos os produtos' : categoria}
          </h2>
          <span className="legenda">
            {visiveis.length} {visiveis.length === 1 ? 'produto' : 'produtos'}
          </span>
        </div>

        {avisoDaNavegacao && <div className="aviso-falha">{avisoDaNavegacao}</div>}

        {erro && (
          <div className="aviso-falha">
            <span style={{ flex: 1 }}>{erro}</span>
            <button type="button" className="botao botao-discreto" onClick={() => void recarregar()}>
              Tentar de novo
            </button>
          </div>
        )}

        {carregando && <div className="carregando">Carregando a banca…</div>}

        {!carregando && !erro && (
          <div className="grade-produtos">
            {visiveis.map((produto, indice) => (
              <CartaoProduto key={produto.id} produto={produto} indice={indice} />
            ))}
          </div>
        )}

        {!carregando && !erro && visiveis.length === 0 && (
          <div className="vazio">Nenhum produto encontrado.</div>
        )}

        {/*
          O caminho da equipe fica no pé da página, discreto: o cliente não
          precisa dele, e o motorista não deveria ter que decorar um endereço
          para começar o dia. Espaço embaixo para a barra do carrinho não tapar.
        */}
        <footer className="loja-rodape">
          <Link to="/pedido">Acompanhar um pedido</Link>
          <span aria-hidden="true">·</span>
          <Link to="/equipe">Acesso da equipe</Link>
        </footer>
      </main>

      <BarraCarrinho
        quantidade={carrinho.totalDeItens}
        totalCentavos={totalDoCarrinho}
        aoFinalizar={() => navegar('/checkout')}
      />
    </div>
  )
}
