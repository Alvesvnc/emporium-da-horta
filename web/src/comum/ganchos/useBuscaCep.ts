import { useCallback, useRef, useState } from 'react'
import { chamar } from '../api/http'
import type { EnderecoDeCep } from '../api/tipos'

/**
 * Procura o endereço do CEP e devolve para quem preenche o formulário.
 *
 * Regras que importam para não atrapalhar quem digita:
 *
 *  • só busca com os 8 dígitos completos;
 *  • não repete a busca do mesmo CEP;
 *  • CEP não encontrado não trava nada — a pessoa digita o endereço à mão.
 */

export type EstadoDaBusca = 'parado' | 'buscando' | 'encontrado' | 'nao-encontrado'

export function useBuscaCep(aoEncontrar: (endereco: EnderecoDeCep) => void) {
  const [estado, setEstado] = useState<EstadoDaBusca>('parado')
  const ultimoBuscado = useRef<string | null>(null)

  const buscar = useCallback(
    async (cepBruto: string) => {
      const cep = cepBruto.replace(/\D/g, '')

      // Apagou ou ainda está digitando: volta ao repouso e não busca.
      if (cep.length !== 8) {
        ultimoBuscado.current = null
        setEstado('parado')
        return
      }

      if (ultimoBuscado.current === cep) return
      ultimoBuscado.current = cep

      setEstado('buscando')
      try {
        const { endereco } = await chamar<{ endereco: EnderecoDeCep }>(`/api/cep/${cep}`)
        aoEncontrar(endereco)
        setEstado('encontrado')
      } catch {
        // 404 (CEP inexistente) ou serviço fora do ar dão no mesmo para quem
        // está comprando: seguir preenchendo à mão.
        setEstado('nao-encontrado')
      }
    },
    [aoEncontrar],
  )

  return { estado, buscar }
}

/** "69050010" → "69050-010", enquanto a pessoa digita. */
export function formatarCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
}
