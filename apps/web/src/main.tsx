import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { BarreiraDeErro } from './comum/componentes/BarreiraDeErro'
import { registrarServiceWorker } from './comum/offline/registrarServiceWorker'

// Estilos globais, nesta ordem: os tokens da marca primeiro, depois o que é
// construído com eles. Cada módulo carrega o próprio CSS na sua tela.
import './styles/tokens.css'
import './styles/base.css'
import './styles/controles.css'
import './styles/superficies.css'
import './styles/layout.css'

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Elemento #raiz não encontrado no index.html')

createRoot(raiz).render(
  <StrictMode>
    {/*
      Última rede de segurança. As telas tratam os próprios erros; esta pega o
      que ninguém previu e troca a página em branco por um recado com saída.
      Página em branco não diz à pessoa nem que vale a pena recarregar.
    */}
    <BarreiraDeErro
      aoFalhar={() => (
        <div className="aplicacao">
          <main className="conteudo" style={{ maxWidth: 460, paddingTop: 64, gap: 14 }}>
            <h1 className="titulo" style={{ fontSize: 22 }}>
              Alguma coisa quebrou nesta tela
            </h1>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-neutral-600)', margin: 0 }}>
              Não foi culpa sua. Recarregue a página — o que você já registrou está salvo.
            </p>
            <button
              type="button"
              className="botao botao-verde"
              style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </main>
        </div>
      )}
    >
      <App />
    </BarreiraDeErro>
  </StrictMode>,
)

// Depois de montar a tela: o site passa a abrir sem internet, o que importa
// para o motorista no meio da rota.
registrarServiceWorker()
