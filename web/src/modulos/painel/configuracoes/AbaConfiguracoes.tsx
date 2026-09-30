import { useCallback, useEffect, useState } from 'react'
import { chamar, ErroApi } from '../../../comum/api/http'
import type { Categoria, Configuracoes, Produto } from '../../../comum/api/tipos'
import { CadastrarProduto } from './CadastrarProduto'
import { CentralDeDistribuicao } from './CentralDeDistribuicao'
import { EditarProduto } from './EditarProduto'
import { GradeDeProdutos } from './GradeDeProdutos'
import { PedidoMinimo } from './PedidoMinimo'

/** O que o dono controla: regras da loja e o catálogo. */
export function AbaConfiguracoes() {
  const [config, setConfig] = useState<Configuracoes | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [respostaConfig, respostaProdutos] = await Promise.all([
        chamar<{ configuracoes: Configuracoes }>('/api/admin/configuracoes'),
        chamar<{ produtos: Produto[]; categorias: Categoria[] }>('/api/admin/produtos'),
      ])
      setConfig(respostaConfig.configuracoes)
      setProdutos(respostaProdutos.produtos)
      setCategorias(respostaProdutos.categorias)
      setErro(null)
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui carregar as configurações.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  if (erro) return <div className="aviso-falha">{erro}</div>
  if (carregando || !config) return <div className="carregando">Abrindo as configurações…</div>

  const produtoEmEdicao = produtos.find((p) => p.id === editando) ?? null

  return (
    <>
      <PedidoMinimo config={config} aoSalvar={setConfig} />
      <CentralDeDistribuicao config={config} aoSalvar={setConfig} />
      <CadastrarProduto categorias={categorias} aoCadastrar={() => void carregar()} />
      <GradeDeProdutos produtos={produtos} aoEscolher={setEditando} />

      {produtoEmEdicao && (
        <EditarProduto
          produto={produtoEmEdicao}
          aoFechar={() => setEditando(null)}
          aoMudar={(atualizado) =>
            setProdutos((atual) => atual.map((p) => (p.id === atualizado.id ? atualizado : p)))
          }
        />
      )}
    </>
  )
}
