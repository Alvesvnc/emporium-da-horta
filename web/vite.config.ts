import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API = 'http://127.0.0.1:3333'

/**
 * Endereços de túnel aceitos pelo Vite.
 *
 * Por segurança, o Vite 6 recusa qualquer requisição cujo `Host` ele não
 * conheça — defesa para um site malicioso não alcançar o servidor de
 * desenvolvimento rodando na sua máquina. Um túnel (ngrok, Cloudflare) chega
 * justamente com um host desconhecido, e a tela mostra só "Blocked request".
 *
 * O ponto na frente libera os subdomínios daquele domínio, e só deles. Os
 * quatro são os que o ngrok usa hoje — ele já trocou de domínio algumas vezes.
 *
 * Vale só em desenvolvimento e no preview: o site publicado é servido por
 * outra coisa, que não passa por aqui.
 */
const TUNEIS = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io', '.ngrok.app']

export default defineConfig({
  plugins: [react()],

  optimizeDeps: {
    /**
     * O MapLibre precisa ficar de fora do reempacotamento do Vite.
     *
     * Ele vem em três arquivos — o principal, um compartilhado e um worker —
     * e descobre o worker calculando o caminho a partir de onde ele próprio
     * está (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`). Quando o
     * Vite copia só o arquivo principal para .vite/deps, essa conta aponta
     * para um endereço que não existe: o worker dá 404, ninguém decodifica os
     * tiles e o mapa pinta só o fundo do estilo — parece que "não aparece".
     *
     * Fora da otimização, os três arquivos são servidos da pasta original,
     * lado a lado, e a conta fecha. É seguro porque nenhum deles importa
     * pacote de terceiros: só se referenciam entre si por caminho relativo.
     *
     * Isto resolve o `npm run dev`. Em produção o problema é o mesmo e a
     * solução é outra — ver `setWorkerUrl` em src/comum/mapa/maplibre.ts.
     */
    exclude: ['maplibre-gl'],
  },

  worker: {
    // O MapLibre cria o worker com `{ type: 'module' }`. Se o Vite gerasse o
    // padrão (iife), o navegador recusaria o arquivo.
    format: 'es',
  },

  // O site chama /api e /uploads como se fossem dele; o Vite repassa para o
  // Fastify. Em desenvolvimento isso evita qualquer problema de CORS.
  server: {
    port: 5173,
    allowedHosts: TUNEIS,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
    },
  },

  /**
   * O mesmo repasse para o `npm run preview`.
   *
   * Não é repetição à toa: `preview` é um servidor diferente e ignora o
   * `server.proxy`. E é justamente nele que se testa o service worker, que só
   * liga no build de produção — sem isto, toda chamada de API daria 404 e
   * pareceria que o sistema inteiro quebrou, quando é só o repasse faltando.
   */
  preview: {
    port: 4173,
    allowedHosts: TUNEIS,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
