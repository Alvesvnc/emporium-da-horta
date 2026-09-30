import { useCallback, useEffect, useState } from 'react'
import { chamar, ErroApi } from '../api/http'
import type { RespostaLoja } from '../api/tipos'

/**
 * Carrega catálogo e regras da loja numa chamada só. A loja e o checkout
 * dependem dos mesmos dados, então o carregamento mora aqui.
 */
export function useLoja() {
  const [dados, setDados] = useState<RespostaLoja | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await chamar<RespostaLoja>('/api/loja'))
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui carregar a loja.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { dados, carregando, erro, recarregar }
}
