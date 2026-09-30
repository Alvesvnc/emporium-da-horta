import { BrowserRouter } from 'react-router-dom'
import { ProvedorCarrinho } from '../comum/estado/CarrinhoContexto'
import { ProvedorSessao } from '../comum/estado/SessaoContexto'
import { Rotas } from './Rotas'

/** Raiz da aplicação: navegação e os estados que valem para o site inteiro. */
export function App() {
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <ProvedorCarrinho>
          <Rotas />
        </ProvedorCarrinho>
      </ProvedorSessao>
    </BrowserRouter>
  )
}
