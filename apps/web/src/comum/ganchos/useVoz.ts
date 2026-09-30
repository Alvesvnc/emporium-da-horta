import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Fala em português, usando a voz do próprio aparelho.
 *
 * `speechSynthesis` é nativo do navegador: não tem chave, não tem custo e não
 * manda nada para servidor nenhum. Em compensação é irregular — aparelho sem
 * voz em português instalada acaba lendo com sotaque de outra língua, e alguns
 * navegadores só carregam a lista de vozes depois de um evento.
 *
 * Para quem dirige, ouvir é o que importa: ler a tela numa curva é justamente
 * o que a navegação por voz existe para evitar.
 */

const LEMBRETE = 'rota:voz-ligada'

export function useVoz() {
  const disponivel = typeof window !== 'undefined' && 'speechSynthesis' in window

  const [ligada, setLigada] = useState(() => {
    try {
      return localStorage.getItem(LEMBRETE) === '1'
    } catch {
      return false
    }
  })

  const voz = useRef<SpeechSynthesisVoice | null>(null)
  const ultimaFala = useRef('')

  // A lista de vozes costuma chegar vazia na primeira consulta e ser preenchida
  // depois, por evento. Escutamos os dois momentos.
  useEffect(() => {
    if (!disponivel) return

    const escolher = () => {
      const vozes = window.speechSynthesis.getVoices()
      voz.current =
        vozes.find((v) => v.lang === 'pt-BR') ??
        vozes.find((v) => v.lang.startsWith('pt')) ??
        null
    }

    escolher()
    window.speechSynthesis.addEventListener('voiceschanged', escolher)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', escolher)
  }, [disponivel])

  const falar = useCallback(
    (texto: string) => {
      if (!disponivel || !ligada || !texto) return
      // A navegação reavalia a cada leitura do GPS. Sem esta trava, a mesma
      // instrução seria repetida algumas vezes por segundo.
      if (texto === ultimaFala.current) return
      ultimaFala.current = texto

      const fala = new SpeechSynthesisUtterance(texto)
      fala.lang = 'pt-BR'
      if (voz.current) fala.voice = voz.current
      fala.rate = 1.05

      // Instrução nova cancela a anterior: no trânsito, a mais recente é a
      // única que ainda vale.
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(fala)
    },
    [disponivel, ligada],
  )

  const alternar = useCallback(() => {
    setLigada((antes) => {
      const agora = !antes
      try {
        localStorage.setItem(LEMBRETE, agora ? '1' : '0')
      } catch {
        // Sem memória do navegador a voz ainda funciona; só não lembra da
        // escolha na próxima vez.
      }
      if (!agora && disponivel) window.speechSynthesis.cancel()
      return agora
    })
  }, [disponivel])

  useEffect(() => {
    return () => {
      if (disponivel) window.speechSynthesis.cancel()
    }
  }, [disponivel])

  /** Permite repetir a mesma frase depois de uma troca de contexto. */
  const esquecerUltima = useCallback(() => {
    ultimaFala.current = ''
  }, [])

  return { disponivel, ligada, alternar, falar, esquecerUltima }
}
