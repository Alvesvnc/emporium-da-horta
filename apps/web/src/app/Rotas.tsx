import { Navigate, Route, Routes } from 'react-router-dom'
import { TelaCheckout } from '../modulos/checkout/TelaCheckout'
import { TelaEntrada } from '../modulos/entrada/TelaEntrada'
import { TelaRota } from '../modulos/entregas/TelaRota'
import { TelaLoja } from '../modulos/loja/TelaLoja'
import { TelaAcompanharPedido } from '../modulos/pedido/TelaAcompanharPedido'
import { TelaPainel } from '../modulos/painel/TelaPainel'
import { RotaProtegida } from './RotaProtegida'

/** O mapa de endereços do site: um lugar só para saber que telas existem. */
export function Rotas() {
  return (
    <Routes>
      {/*
        A raiz é o cardápio. Quem chega é cliente, e cliente não tem conta
        nenhuma para informar — pedir login a quem só quer comprar tomate é
        perder a venda na primeira tela.

        A equipe entra por /equipe, que é endereço de quem já sabe onde vai.
      */}
      <Route path="/" element={<TelaLoja />} />
      {/* Endereço antigo, mantido para links já compartilhados não morrerem. */}
      <Route path="/loja" element={<Navigate to="/" replace />} />
      <Route path="/equipe" element={<TelaEntrada />} />
      <Route path="/checkout" element={<TelaCheckout />} />
      {/* Sem conta: número do pedido + telefone. */}
      <Route path="/pedido" element={<TelaAcompanharPedido />} />

      <Route
        path="/painel"
        element={
          <RotaProtegida papel="dono">
            <TelaPainel />
          </RotaProtegida>
        }
      />
      <Route
        path="/rota"
        element={
          <RotaProtegida papel="motorista">
            <TelaRota />
          </RotaProtegida>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
