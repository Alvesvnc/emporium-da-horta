import { useState } from 'react'
import { ErroApi } from '../../comum/api/http'
import { useSessao } from '../../comum/estado/SessaoContexto'

/** Login do dono e do motorista: e-mail e senha. */
export function LoginEquipe({
  aoVoltar,
  aoConcluir,
}: {
  aoVoltar: () => void
  aoConcluir: (papel: 'dono' | 'motorista') => void
}) {
  const { entrarComoEquipe } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar() {
    setEnviando(true)
    setErro('')
    try {
      const usuario = await entrarComoEquipe(email.trim().toLowerCase(), senha)
      aoConcluir(usuario.papel)
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <h1 className="titulo" style={{ fontSize: 22, color: 'var(--color-accent-2-900)' }}>
        Acesso da equipe
      </h1>
      <input
        className="campo"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void entrar()}
        placeholder="E-mail"
        autoComplete="username"
      />
      <input
        className="campo"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void entrar()}
        placeholder="Senha"
        autoComplete="current-password"
      />
      {erro && <div className="erro">{erro}</div>}
      <button type="button" className="botao botao-verde" onClick={() => void entrar()} disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>

      {import.meta.env.DEV && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-neutral-500)',
            lineHeight: 1.6,
            background: 'var(--color-neutral-200)',
            borderRadius: 14,
            padding: '10px 14px',
          }}
        >
          Acessos criados pelo <code>npm run db:seed</code>:
          <br />
          dono@emporiumdahorta.com.br / horta123
          <br />
          motorista@emporiumdahorta.com.br / rota123
        </div>
      )}

      <button
        type="button"
        className="botao-texto"
        style={{ fontSize: 12.5, color: 'var(--color-neutral-500)' }}
        onClick={aoVoltar}
      >
        ← Ir para a loja
      </button>
    </>
  )
}
