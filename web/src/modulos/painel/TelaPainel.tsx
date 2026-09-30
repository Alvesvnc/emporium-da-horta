import { useState } from 'react'
import './painel.css'
import { Cabecalho } from '../../comum/componentes/Cabecalho'
import { AbaConfiguracoes } from './configuracoes/AbaConfiguracoes'
import { AbaEntregasAoVivo } from './entregas/AbaEntregasAoVivo'
import { AbaMetricas } from './metricas/AbaMetricas'

const ABAS = [
  { id: 'metricas', rotulo: 'Métricas' },
  { id: 'entregas', rotulo: 'Entregas ao vivo' },
  { id: 'config', rotulo: 'Configurações' },
] as const

type Aba = (typeof ABAS)[number]['id']

/** Painel do dono: os números de um lado, os controles da loja do outro. */
export function TelaPainel() {
  const [aba, setAba] = useState<Aba>('metricas')

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="aplicacao">
      <Cabecalho subtitulo="Painel do dono" area="equipe" />

      <main className="conteudo" style={{ maxWidth: 1120, padding: '24px 20px 48px', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1 className="titulo" style={{ fontSize: 23, color: 'var(--color-accent-2-900)' }}>
              Painel do dono
            </h1>
            <p className="legenda" style={{ margin: '2px 0 0', textTransform: 'capitalize' }}>
              {hoje} · Manaus
            </p>
          </div>

          <div className="abas" role="tablist">
            {ABAS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-pressed={aba === item.id}
                aria-selected={aba === item.id}
                onClick={() => setAba(item.id)}
              >
                {item.rotulo}
              </button>
            ))}
          </div>
        </div>

        {aba === 'metricas' && <AbaMetricas />}
        {aba === 'entregas' && <AbaEntregasAoVivo />}
        {aba === 'config' && <AbaConfiguracoes />}
      </main>
    </div>
  )
}
