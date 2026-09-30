import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSessao } from '../comum/estado/SessaoContexto'

/**
 * Portão das telas da equipe. Sem token, vai para o login DA EQUIPE — não para
 * a loja: quem tentou abrir o painel ou a rota quer entrar, e cair no cardápio
 * de tomate deixaria a pessoa sem saber para onde ir. Com o papel errado, vai
 * para a área que ela realmente pode ver.
 */
export function RotaProtegida({ papel, children }: { papel: 'dono' | 'motorista'; children: ReactNode }) {
  const { equipe, carregandoEquipe } = useSessao()

  if (carregandoEquipe) return <div className="carregando">Conferindo seu acesso…</div>
  if (!equipe) return <Navigate to="/equipe" replace />
  if (equipe.papel !== papel) {
    return <Navigate to={equipe.papel === 'dono' ? '/painel' : '/rota'} replace />
  }

  return <>{children}</>
}
