import { Link, useNavigate } from 'react-router-dom'
import { useSessao } from '../estado/SessaoContexto'

/**
 * Faixa verde do topo, igual nas duas áreas.
 *
 * Na loja não há login nenhum — o cliente compra sem conta —, então o canto
 * direito oferece acompanhar um pedido. Sair só existe para a equipe.
 */
export function Cabecalho({
  subtitulo,
  area = 'loja',
}: {
  subtitulo: string
  area?: 'loja' | 'equipe'
}) {
  const navegar = useNavigate()
  const { equipe, sairDaEquipe } = useSessao()

  function sair() {
    sairDaEquipe()
    // De volta ao login da equipe, não à loja: quem saiu do painel quase sempre
    // quer entrar de novo, às vezes com o outro usuário.
    navegar('/equipe')
  }

  return (
    <header className="topo">
      <Link to={area === 'equipe' ? '#' : '/'} style={{ display: 'flex' }} aria-label="Início">
        <img src="/logo.png" alt="" />
      </Link>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div
          className="titulo"
          style={{ fontSize: 16, color: 'var(--color-neutral-100)', whiteSpace: 'nowrap' }}
        >
          Empórium da Horta
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-accent-2-300)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subtitulo}
        </div>
      </div>

      {/*
        Dono ou motorista navegando pela loja precisa de caminho de volta: a
        raiz do site é o cardápio agora, e sem isto ele ficaria preso olhando
        tomate sem porta para a própria área.
      */}
      {area === 'loja' && equipe && (
        <Link to={equipe.papel === 'dono' ? '/painel' : '/rota'} className="botao topo-link">
          {equipe.papel === 'dono' ? 'Painel' : 'Minha rota'}
        </Link>
      )}

      {area === 'loja' ? (
        <Link to="/pedido" className="botao topo-sair">
          Acompanhar pedido
        </Link>
      ) : (
        <button type="button" className="botao topo-sair" onClick={sair}>
          Sair
        </button>
      )}
    </header>
  )
}
