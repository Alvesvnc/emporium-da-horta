import { useEffect, useRef } from 'react'

/**
 * Impede o celular de apagar a tela.
 *
 * Sem isto, a navegação que acabamos de construir é inútil e perigosa: o
 * aparelho apaga em meio minuto, e o motorista teria que ficar tocando na tela
 * dirigindo para ver a próxima curva.
 *
 * Usa a Wake Lock API, nativa do navegador — sem chave, sem custo, sem
 * biblioteca. Duas coisas a saber:
 *
 *  • exige HTTPS, como o GPS. No celular por IP da rede local não funciona;
 *  • o sistema SOLTA a trava sozinho quando a pessoa troca de aplicativo ou
 *    bloqueia o aparelho. Ao voltar, é preciso pedir de novo — é o que o
 *    ouvinte de `visibilitychange` faz aqui embaixo.
 *
 * Falhar aqui nunca quebra a tela: no pior caso o celular apaga como sempre
 * apagou, e o motorista toca nele.
 */
export function useTelaAcesa(ativa: boolean) {
  const trava = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!ativa || !('wakeLock' in navigator)) return

    let cancelado = false

    const pedir = async () => {
      // `visible` porque pedir a trava com a aba escondida é recusado pelo
      // navegador, e o erro só polui o console.
      if (cancelado || document.visibilityState !== 'visible') return
      try {
        trava.current = await navigator.wakeLock.request('screen')
      } catch {
        // Bateria fraca, aparelho sem suporte, permissão negada: a tela volta a
        // apagar sozinha e nada mais acontece.
      }
    }

    const aoVoltar = () => {
      if (document.visibilityState === 'visible' && !trava.current) void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', aoVoltar)
      void trava.current?.release().catch(() => {})
      trava.current = null
    }
  }, [ativa])
}
