/**
 * Telefone brasileiro, formatado enquanto a pessoa digita.
 *
 *   celular (11 dígitos) → (92) 9 8413-9931
 *   fixo    (10 dígitos) → (92) 3234-5678
 *
 * A formatação é sempre recalculada a partir dos dígitos, então aplicar a
 * função num texto já formatado devolve a mesma coisa — dá para usar tanto no
 * onChange do campo quanto para exibir o que veio do banco.
 */
/**
 * Os dígitos que interessam: tira o código do país e corta o excesso.
 *
 * O `55` só sai quando sobram 12 ou 13 dígitos — nunca com 11, porque DDD 55
 * existe (Santa Maria, RS) e um número de lá seria mutilado.
 */
function digitosDoTelefone(valor: string): string {
  let digitos = apenasDigitos(valor)
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    digitos = digitos.slice(2)
  }
  return digitos.slice(0, 11)
}

export function formatarTelefone(valor: string): string {
  const digitos = digitosDoTelefone(valor)
  if (digitos.length === 0) return ''

  const ddd = digitos.slice(0, 2)
  if (digitos.length <= 2) return `(${ddd}`

  const resto = digitos.slice(2)

  // Ainda digitando: só o DDD fechado e o começo do número.
  if (resto.length <= 4) return `(${ddd}) ${resto}`

  // Fixo, ou celular incompleto: 4 + até 4.
  if (resto.length <= 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`

  // Celular completo: o 9 fica separado, como se escreve por aqui.
  return `(${ddd}) ${resto.slice(0, 1)} ${resto.slice(1, 5)}-${resto.slice(5)}`
}

/** Só os números — é o que vai em `href="tel:"` e o que a API usa para casar contas. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * DDD + 8 ou 9 dígitos. Não confere se a linha existe, só o formato.
 * Usa a mesma normalização da formatação, para o campo nunca mostrar um
 * número completo enquanto a validação diz que falta dígito.
 */
export function telefoneCompleto(valor: string): boolean {
  const n = digitosDoTelefone(valor).length
  return n === 10 || n === 11
}

/** Tamanho do texto formatado mais longo: "(92) 9 8413-9931". */
export const MAXIMO_TELEFONE = 16

/**
 * Link que abre a conversa no WhatsApp.
 *
 * Existe porque é assim que entregador e cliente se falam no Brasil: "estou
 * chegando", "desço em dois minutos". Ligar interrompe; mensagem não.
 *
 * O `wa.me` exige o código do país, então o 55 entra aqui — ao contrário do
 * resto do arquivo, que trabalha com o número como se escreve por aqui.
 * Devolve null quando o número está incompleto: link quebrado abre o WhatsApp
 * numa tela de erro, o que é pior que não ter botão.
 */
export function linkWhatsapp(telefone: string, mensagem?: string): string | null {
  if (!telefoneCompleto(telefone)) return null

  const numero = `55${digitosDoTelefone(telefone)}`
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''
  return `https://wa.me/${numero}${texto}`
}
