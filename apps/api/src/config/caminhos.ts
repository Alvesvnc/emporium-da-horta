import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Todos os caminhos de disco em um lugar só. Se uma pasta mudar de lugar,
 * muda aqui e mais nada precisa saber.
 */

const aqui = dirname(fileURLToPath(import.meta.url))

/** Pasta apps/api/ — vale tanto rodando de src/ quanto de dist/. */
export const raizApi = resolve(aqui, '..', '..')

/** Raiz do projeto, dois níveis acima de apps/api/ — onde mora o .env compartilhado. */
export const raizProjeto = resolve(raizApi, '..', '..')

/** Onde as fotos ficam quando STORAGE_DRIVER=local. */
export const pastaUploads = resolve(raizApi, 'uploads')
