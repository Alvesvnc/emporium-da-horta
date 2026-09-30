import { useCallback, useEffect, useState } from 'react'

/**
 * Se o aparelho está conectado — com uma ressalva importante.
 *
 * `navigator.onLine` responde "sim" sempre que existe uma rede, mesmo que essa
 * rede não chegue à internet. Celular pendurado num Wi-Fi sem sinal, ou preso
 * numa antena que não passa dado, aparece como conectado.
 *
 * Por isso a verdade também vem do outro lado: quem tenta falar com a API e
 * leva um erro de rede chama `marcarQueda()`, e quem consegue chama
 * `marcarVolta()`. O evento do navegador é só um empurrão para tentar de novo
 * na hora certa, não a palavra final.
 */
export function useConexao() {
  const [conectado, setConectado] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  const marcarQueda = useCallback(() => setConectado(false), [])
  const marcarVolta = useCallback(() => setConectado(true), [])

  useEffect(() => {
    const voltou = () => setConectado(true)
    const caiu = () => setConectado(false)

    window.addEventListener('online', voltou)
    window.addEventListener('offline', caiu)
    return () => {
      window.removeEventListener('online', voltou)
      window.removeEventListener('offline', caiu)
    }
  }, [])

  return { conectado, marcarQueda, marcarVolta }
}
