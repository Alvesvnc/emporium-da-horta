import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * O carrinho guarda só id do produto e quantidade — nunca o preço. Quem soma é
 * o servidor, com o preço que está valendo no momento do pedido.
 * Fica no localStorage para o cliente não perder o carrinho ao fechar a aba.
 */

const CHAVE = 'emporium.carrinho'

type Itens = Record<number, number>

type Contexto = {
  itens: Itens
  quantidadeDe: (produtoId: number) => number
  totalDeItens: number
  adicionar: (produtoId: number) => void
  remover: (produtoId: number) => void
  tirar: (produtoId: number) => void
  esvaziar: () => void
}

const ContextoCarrinho = createContext<Contexto | null>(null)

function ler(): Itens {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return {}
    const dados = JSON.parse(bruto) as Itens
    // Descarta lixo antigo: só números positivos entram.
    return Object.fromEntries(
      Object.entries(dados)
        .map(([id, qtd]) => [Number(id), Number(qtd)] as const)
        .filter(([id, qtd]) => Number.isInteger(id) && Number.isInteger(qtd) && qtd > 0),
    )
  } catch {
    return {}
  }
}

export function ProvedorCarrinho({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Itens>(ler)

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(itens))
    } catch {
      /* sem armazenamento: o carrinho vale só nesta aba */
    }
  }, [itens])

  const adicionar = useCallback((produtoId: number) => {
    setItens((atual) => ({ ...atual, [produtoId]: (atual[produtoId] ?? 0) + 1 }))
  }, [])

  const remover = useCallback((produtoId: number) => {
    setItens((atual) => {
      const quantidade = atual[produtoId] ?? 0
      if (quantidade <= 1) {
        const { [produtoId]: _, ...resto } = atual
        return resto
      }
      return { ...atual, [produtoId]: quantidade - 1 }
    })
  }, [])

  const tirar = useCallback((produtoId: number) => {
    setItens((atual) => {
      const { [produtoId]: _, ...resto } = atual
      return resto
    })
  }, [])

  const esvaziar = useCallback(() => setItens({}), [])

  const valor = useMemo<Contexto>(
    () => ({
      itens,
      quantidadeDe: (id) => itens[id] ?? 0,
      totalDeItens: Object.values(itens).reduce((soma, n) => soma + n, 0),
      adicionar,
      remover,
      tirar,
      esvaziar,
    }),
    [itens, adicionar, remover, tirar, esvaziar],
  )

  return <ContextoCarrinho.Provider value={valor}>{children}</ContextoCarrinho.Provider>
}

export function useCarrinho(): Contexto {
  const contexto = useContext(ContextoCarrinho)
  if (!contexto) throw new Error('useCarrinho precisa estar dentro de <ProvedorCarrinho>')
  return contexto
}
