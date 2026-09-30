/**
 * Encolhe a foto antes de enviar.
 *
 * A câmera de celular tira imagens de 3 a 5 MB. Subir isso no 4G de rua leva
 * meio minuto e às vezes não sobe — e o motorista está parado na porta do
 * cliente esperando. Reduzida, a mesma foto fica em torno de 200 KB e sobe
 * quase na hora.
 *
 * 1280 px no maior lado é de sobra para o que a foto precisa provar: a sacola
 * na porta, o portão, a pessoa que recebeu. Ninguém vai dar zoom nisso.
 *
 * Se qualquer coisa falhar — formato exótico, memória curta, navegador antigo
 * —, devolve o arquivo original. Enviar grande é ruim; não enviar é pior.
 */

const LADO_MAXIMO = 1280
const QUALIDADE = 0.72

export async function encolherImagem(arquivo: File): Promise<Blob> {
  try {
    const bitmap = await criarBitmap(arquivo)

    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
    // Já é pequena: mexer só faria perder qualidade à toa.
    if (escala === 1 && arquivo.size < 600_000) return arquivo

    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)

    const tela = document.createElement('canvas')
    tela.width = largura
    tela.height = altura

    const pincel = tela.getContext('2d')
    if (!pincel) return arquivo
    pincel.drawImage(bitmap, 0, 0, largura, altura)

    const menor = await new Promise<Blob | null>((resolver) =>
      tela.toBlob(resolver, 'image/jpeg', QUALIDADE),
    )

    // Só vale a troca se realmente ficou menor.
    return menor && menor.size < arquivo.size ? menor : arquivo
  } catch {
    return arquivo
  }
}

/** `createImageBitmap` já respeita a orientação EXIF; o `<img>` nem sempre. */
async function criarBitmap(arquivo: File): Promise<ImageBitmap> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(arquivo)
  }
  throw new Error('sem createImageBitmap')
}
