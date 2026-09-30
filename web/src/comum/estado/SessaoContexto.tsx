import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { chamar, guardarToken, lerToken } from '../api/http'
import type { Sessao } from '../api/tipos'

/**
 * Quem está usando o site.
 *
 * Só existe uma identidade: a da equipe — dono ou motorista, que entra com
 * e-mail e senha. Cliente NÃO tem conta: compra informando nome, telefone e
 * endereço, e acompanha o pedido pelo número mais o telefone. Não há nada para
 * cadastrar, lembrar ou recuperar.
 *
 * O contato guardado (nome e telefone da última compra) não é identidade: é
 * conveniência, para a pessoa não redigitar tudo na compra seguinte. Fica só
 * neste navegador e não dá acesso a nada.
 */

const CHAVE_CONTATO = 'emporium.contato'

export type Contato = { nome: string; telefone: string }

type Contexto = {
  equipe: Sessao | null
  carregandoEquipe: boolean
  entrarComoEquipe: (email: string, senha: string) => Promise<Sessao>
  sairDaEquipe: () => void

  contato: Contato | null
  salvarContato: (contato: Contato | null) => void
}

const ContextoSessao = createContext<Contexto | null>(null)

function lerContatoSalvo(): Contato | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CONTATO)
    return bruto ? (JSON.parse(bruto) as Contato) : null
  } catch {
    return null
  }
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [equipe, setEquipe] = useState<Sessao | null>(null)
  const [carregandoEquipe, setCarregandoEquipe] = useState(true)
  const [contato, setContato] = useState<Contato | null>(lerContatoSalvo)

  // Ao abrir o site, confere se o token guardado ainda vale.
  useEffect(() => {
    let ativo = true

    if (lerToken('equipe')) {
      chamar<{ usuario: Sessao }>('/api/auth/eu')
        .then((r) => ativo && setEquipe(r.usuario))
        .catch(() => guardarToken('equipe', null))
        .finally(() => ativo && setCarregandoEquipe(false))
    } else {
      setCarregandoEquipe(false)
    }

    return () => {
      ativo = false
    }
  }, [])

  const entrarComoEquipe = useCallback(async (email: string, senha: string) => {
    const r = await chamar<{ token: string; usuario: Sessao }>('/api/auth/login', {
      corpo: { email, senha },
      sessao: null,
    })
    guardarToken('equipe', r.token)
    setEquipe(r.usuario)
    return r.usuario
  }, [])

  const sairDaEquipe = useCallback(() => {
    guardarToken('equipe', null)
    setEquipe(null)
  }, [])

  const salvarContato = useCallback((novo: Contato | null) => {
    setContato(novo)
    try {
      if (novo) localStorage.setItem(CHAVE_CONTATO, JSON.stringify(novo))
      else localStorage.removeItem(CHAVE_CONTATO)
    } catch {
      /* sem armazenamento: vale só para esta visita */
    }
  }, [])

  const valor = useMemo<Contexto>(
    () => ({ equipe, carregandoEquipe, entrarComoEquipe, sairDaEquipe, contato, salvarContato }),
    [equipe, carregandoEquipe, entrarComoEquipe, sairDaEquipe, contato, salvarContato],
  )

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}

export function useSessao(): Contexto {
  const contexto = useContext(ContextoSessao)
  if (!contexto) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>')
  return contexto
}
