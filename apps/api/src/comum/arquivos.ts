import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/ambiente.js'
import { pastaUploads } from '../config/caminhos.js'

/**
 * Guarda as fotos dos produtos. Dois modos, mesma interface:
 *
 *   STORAGE_DRIVER=local     → grava em apps/api/uploads/ e o Fastify serve a pasta.
 *   STORAGE_DRIVER=supabase  → envia para o bucket do Supabase Storage.
 *
 * A troca é feita no .env; nenhuma rota precisa saber qual está ativo.
 */

const TIPOS_ACEITOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024

export class ArquivoInvalido extends Error {}

let supabase: SupabaseClient | null = null
function clienteSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
  }
  return supabase
}

function extensaoDe(nomeArquivo: string, tipo: string): string {
  const daExtensao = extname(nomeArquivo).toLowerCase()
  if (daExtensao) return daExtensao
  return tipo === 'image/png' ? '.png' : tipo === 'image/webp' ? '.webp' : '.jpg'
}

export type FotoSalva = { url: string; caminho: string }

export async function salvarFoto(
  conteudo: Buffer,
  nomeOriginal: string,
  tipoMime: string,
): Promise<FotoSalva> {
  if (!TIPOS_ACEITOS.has(tipoMime)) {
    throw new ArquivoInvalido('A foto precisa ser JPG, PNG, WebP ou AVIF.')
  }
  if (conteudo.byteLength > TAMANHO_MAXIMO_BYTES) {
    throw new ArquivoInvalido('A foto passa de 5 MB. Envie uma imagem menor.')
  }

  const nome = `${randomUUID()}${extensaoDe(nomeOriginal, tipoMime)}`

  if (env.STORAGE_DRIVER === 'supabase') {
    const bucket = clienteSupabase().storage.from(env.SUPABASE_STORAGE_BUCKET)
    const { error } = await bucket.upload(nome, conteudo, {
      contentType: tipoMime,
      upsert: false,
    })
    if (error) throw new Error(`Não consegui enviar a foto para o Supabase: ${error.message}`)
    const { data } = bucket.getPublicUrl(nome)
    return { url: data.publicUrl, caminho: nome }
  }

  mkdirSync(pastaUploads, { recursive: true })
  await writeFile(join(pastaUploads, nome), conteudo)
  return { url: `/uploads/${nome}`, caminho: nome }
}
