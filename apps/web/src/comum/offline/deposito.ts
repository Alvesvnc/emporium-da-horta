/**
 * Guarda coisas no próprio aparelho, para o motorista continuar trabalhando
 * sem sinal.
 *
 * É IndexedDB e não localStorage por um motivo só: localStorage guarda texto,
 * e a foto da entrega é um arquivo binário. Converter foto para texto incha uns
 * 33% e estoura o limite de 5 MB do localStorage em três ou quatro entregas.
 * O IndexedDB guarda o arquivo como ele é e tem espaço de sobra.
 *
 * Toda função aqui engole o próprio erro e devolve um valor neutro. Navegação
 * anônima, armazenamento bloqueado, disco cheio: nada disso pode derrubar a
 * tela do motorista. Sem depósito ele volta a depender da rede, que é como era
 * antes — ruim, mas não quebrado.
 */

const BANCO = 'emporium.offline'
const VERSAO = 1

/** Uma gaveta por assunto: a rota guardada e a fila de coisas por enviar. */
export const GAVETAS = {
  rota: 'rota',
  fila: 'fila',
} as const

export type Gaveta = (typeof GAVETAS)[keyof typeof GAVETAS]

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolver) => {
    if (typeof indexedDB === 'undefined') return resolver(null)

    let pedido: IDBOpenDBRequest
    try {
      pedido = indexedDB.open(BANCO, VERSAO)
    } catch {
      return resolver(null)
    }

    pedido.onupgradeneeded = () => {
      const banco = pedido.result
      // `autoIncrement` na fila: a ordem de chegada é a ordem de envio, e o
      // motorista marcou as entregas numa sequência que faz sentido manter.
      if (!banco.objectStoreNames.contains(GAVETAS.rota)) banco.createObjectStore(GAVETAS.rota)
      if (!banco.objectStoreNames.contains(GAVETAS.fila)) {
        banco.createObjectStore(GAVETAS.fila, { keyPath: 'id', autoIncrement: true })
      }
    }

    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => resolver(null)
    pedido.onblocked = () => resolver(null)
  })
}

function comoPromessa<T>(pedido: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolver) => {
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => resolver(null)
  })
}

export async function guardar(gaveta: Gaveta, chave: IDBValidKey, valor: unknown): Promise<void> {
  const banco = await abrir()
  if (!banco) return
  try {
    const transacao = banco.transaction(gaveta, 'readwrite')
    transacao.objectStore(gaveta).put(valor, chave)
  } catch {
    // Gaveta com keyPath próprio recusa a chave avulsa; quem usa `acrescentar`.
  }
}

export async function ler<T>(gaveta: Gaveta, chave: IDBValidKey): Promise<T | null> {
  const banco = await abrir()
  if (!banco) return null
  try {
    const transacao = banco.transaction(gaveta, 'readonly')
    return (await comoPromessa(transacao.objectStore(gaveta).get(chave))) as T | null
  } catch {
    return null
  }
}

/** Põe no fim da fila. A chave é gerada pelo próprio banco, em ordem. */
export async function acrescentar(gaveta: Gaveta, valor: unknown): Promise<number | null> {
  const banco = await abrir()
  if (!banco) return null
  try {
    const transacao = banco.transaction(gaveta, 'readwrite')
    const chave = await comoPromessa(transacao.objectStore(gaveta).add(valor))
    return typeof chave === 'number' ? chave : null
  } catch {
    return null
  }
}

/** Tudo que está na gaveta, na ordem em que entrou. */
export async function listar<T>(gaveta: Gaveta): Promise<T[]> {
  const banco = await abrir()
  if (!banco) return []
  try {
    const transacao = banco.transaction(gaveta, 'readonly')
    return ((await comoPromessa(transacao.objectStore(gaveta).getAll())) ?? []) as T[]
  } catch {
    return []
  }
}

export async function remover(gaveta: Gaveta, chave: IDBValidKey): Promise<void> {
  const banco = await abrir()
  if (!banco) return
  try {
    const transacao = banco.transaction(gaveta, 'readwrite')
    transacao.objectStore(gaveta).delete(chave)
  } catch {
    // Já não estava lá: o efeito desejado é o mesmo.
  }
}
