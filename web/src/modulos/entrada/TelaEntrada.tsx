import { useEffect } from 'react'
import './entrada.css'
import { useNavigate } from 'react-router-dom'
import { Bolhas } from '../../comum/componentes/Bolhas'
import { useSessao } from '../../comum/estado/SessaoContexto'
import { LoginEquipe } from './LoginEquipe'

/**
 * Entrada da equipe: dono e motorista.
 *
 * Não é mais a porta do site. Quem chega ao Empórium é cliente, e cliente cai
 * direto no cardápio — pedir login a quem só quer comprar tomate é perder a
 * venda na primeira tela. Aqui só chega quem digitou /equipe ou clicou no
 * link discreto no pé da loja, ou seja, quem já sabe o que veio fazer.
 *
 * Não há mais menu intermediário: quem abre esta tela quer o campo de e-mail,
 * não uma lista de opções.
 */
export function TelaEntrada() {
  const navegar = useNavigate()
  const { equipe } = useSessao()

  // Já logado vai direto para a sua área, sem passar pelo formulário.
  useEffect(() => {
    if (equipe) navegar(equipe.papel === 'dono' ? '/painel' : '/rota', { replace: true })
  }, [equipe, navegar])

  return (
    <div className="entrada">
      <div className="entrada-cartao">
        <div className="entrada-marca">
          <Bolhas variante="marca" />
          <img src="/logo.png" alt="Empórium da Horta" />
          <div className="titulo" style={{ fontSize: 27, lineHeight: 1.2, position: 'relative' }}>
            <span style={{ color: 'var(--color-neutral-100)' }}>Colhido de manhã.</span>
            <br />
            <span style={{ color: 'var(--color-accent-300)' }}>Na sua porta à tarde.</span>
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--color-accent-2-200)',
              lineHeight: 1.6,
              position: 'relative',
            }}
          >
            Atacado e varejo direto da central de distribuição, em Manaus.
          </div>
        </div>

        <div className="entrada-painel">
          <LoginEquipe
            aoVoltar={() => navegar('/')}
            aoConcluir={(papel) => navegar(papel === 'dono' ? '/painel' : '/rota')}
          />
        </div>
      </div>
    </div>
  )
}
