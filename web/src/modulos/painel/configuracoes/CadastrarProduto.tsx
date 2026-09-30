import { useRef, useState } from 'react'
import { chamar, ErroApi } from '../../../comum/api/http'
import type { Categoria, Produto } from '../../../comum/api/tipos'
import { rotuloUnidade, UNIDADES, type Unidade } from '../../../comum/formato/unidades'

/**
 * Cadastro de produto novo. A foto é opcional e vai em uma segunda chamada,
 * depois que o produto existe e tem id.
 */
export function CadastrarProduto({
  categorias,
  aoCadastrar,
}: {
  categorias: Categoria[]
  aoCadastrar: () => void
}) {
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [unidade, setUnidade] = useState<Unidade>('kg')
  const [categoria, setCategoria] = useState(categorias[0]?.nome ?? 'Frutas')
  const [foto, setFoto] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const campoFoto = useRef<HTMLInputElement>(null)

  async function cadastrar() {
    setEnviando(true)
    setErro('')
    try {
      const criado = await chamar<{ produto: Produto }>('/api/admin/produtos', {
        corpo: { nome, preco, unidade, categoria },
      })

      if (foto) {
        const pacote = new FormData()
        pacote.append('foto', foto)
        await chamar(`/api/admin/produtos/${criado.produto.id}/foto`, { arquivo: pacote })
      }

      setNome('')
      setPreco('')
      setFoto(null)
      if (campoFoto.current) campoFoto.current.value = ''
      aoCadastrar()
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui cadastrar o produto.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="cartao" style={{ gap: 12 }}>
      <h2 className="titulo" style={{ fontSize: 16, color: 'var(--color-accent-2-900)' }}>
        Cadastrar produto
      </h2>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}
      >
        <input
          className="campo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do produto"
          style={{ gridColumn: '1 / -1', padding: '11px 18px' }}
        />
        <input
          className="campo"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          placeholder="Preço — ex.: 5,99"
          inputMode="decimal"
          style={{ padding: '11px 18px' }}
        />
        <select
          className="campo"
          value={unidade}
          onChange={(e) => setUnidade(e.target.value as Unidade)}
          aria-label="Unidade de venda"
        >
          {UNIDADES.map((u) => (
            <option key={u} value={u}>
              {rotuloUnidade(u)}
            </option>
          ))}
        </select>
        <select
          className="campo"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          aria-label="Categoria"
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>

        <label className="envio">
          {foto && (
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                backgroundImage: `url(${URL.createObjectURL(foto)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                flexShrink: 0,
              }}
            />
          )}
          {foto ? 'Foto escolhida — trocar' : 'Adicionar foto (opcional)'}
          <input
            ref={campoFoto}
            type="file"
            accept="image/*"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <button
        type="button"
        className="botao botao-verde"
        style={{ alignSelf: 'flex-start', padding: '11px 26px', fontSize: 13.5 }}
        onClick={() => void cadastrar()}
        disabled={enviando}
      >
        {enviando ? 'Cadastrando…' : 'Cadastrar produto'}
      </button>
    </section>
  )
}
