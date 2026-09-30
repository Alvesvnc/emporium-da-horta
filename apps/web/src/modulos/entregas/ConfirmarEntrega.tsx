import { useEffect, useRef, useState } from 'react'

/**
 * Fecha a entrega com comprovante: quem recebeu e, se der, uma foto.
 *
 * Existe para o dia em que um cliente disser "não recebi". Sem isso sobra a
 * palavra de um contra a do outro, e quem perde é sempre a loja.
 *
 * O equilíbrio aqui é delicado: o motorista está na porta, com o cliente na
 * frente e o carro em fila dupla. Se registrar comprovante custar caro, ele
 * pula — e um campo que todo mundo pula não protege ninguém. Por isso:
 *
 *  • "Foi o próprio cliente" preenche o nome num toque, que é o caso comum;
 *  • a foto é opcional e abre a câmera direto, sem passar por galeria;
 *  • dá para confirmar com tudo vazio. Melhor entrega registrada sem
 *    comprovante do que motorista que aprende a mentir no botão verde.
 */
export function ConfirmarEntrega({
  nomeDoCliente,
  salvando,
  aoConfirmar,
  aoCancelar,
}: {
  nomeDoCliente: string
  salvando: boolean
  aoConfirmar: (recebidoPor: string, foto: File | null) => void
  aoCancelar: () => void
}) {
  const [recebidoPor, setRecebidoPor] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const campoFoto = useRef<HTMLInputElement>(null)

  // A prévia vira um endereço temporário na memória do navegador; sem soltar,
  // cada foto trocada deixa lixo para trás.
  useEffect(() => {
    if (!foto) {
      setPrevia(null)
      return
    }
    const endereco = URL.createObjectURL(foto)
    setPrevia(endereco)
    return () => URL.revokeObjectURL(endereco)
  }, [foto])

  return (
    <div className="comprovante">
      <div className="comprovante-titulo">Quem recebeu?</div>

      <input
        className="campo"
        value={recebidoPor}
        onChange={(e) => setRecebidoPor(e.target.value)}
        placeholder="Nome de quem recebeu (opcional)"
        maxLength={120}
        autoComplete="off"
      />

      <div className="comprovante-atalhos">
        <button
          type="button"
          className="comprovante-atalho"
          onClick={() => setRecebidoPor(nomeDoCliente)}
        >
          Foi o próprio cliente
        </button>
        <button
          type="button"
          className="comprovante-atalho"
          onClick={() => setRecebidoPor('Porteiro')}
        >
          Porteiro
        </button>
      </div>

      {/* `capture` abre a câmera direto no celular, sem passar pela galeria. */}
      <input
        ref={campoFoto}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
      />

      {previa ? (
        <div className="comprovante-previa">
          <img src={previa} alt="Foto da entrega" />
          <button type="button" className="comprovante-trocar" onClick={() => setFoto(null)}>
            Remover foto
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="botao botao-contorno comprovante-foto"
          onClick={() => campoFoto.current?.click()}
        >
          Tirar foto (opcional)
        </button>
      )}

      <div className="comprovante-acoes">
        <button
          type="button"
          className="botao acao-entregue"
          disabled={salvando}
          onClick={() => aoConfirmar(recebidoPor.trim(), foto)}
        >
          {salvando ? 'Salvando…' : 'Confirmar entrega'}
        </button>
        <button
          type="button"
          className="botao botao-contorno comprovante-voltar"
          onClick={aoCancelar}
          disabled={salvando}
        >
          Voltar
        </button>
      </div>
    </div>
  )
}
