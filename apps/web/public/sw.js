/**
 * Service worker: o que faz o site abrir sem internet.
 *
 * Sem isto, o trabalho offline do motorista só sobrevive com a página aberta —
 * recarregar ou reabrir o navegador sem sinal não traz nada, porque o próprio
 * site vem do servidor. Aqui ele passa a morar no aparelho.
 *
 * ── O risco deste arquivo ────────────────────────────────────
 *
 * Service worker mal feito serve versão velha para sempre, e o dono publica
 * uma correção que ninguém recebe. A defesa é tratar cada tipo de arquivo pelo
 * que ele é:
 *
 *   HTML          → rede primeiro. É o arquivo que aponta para todos os outros;
 *                   servi-lo velho congela o site inteiro numa versão antiga.
 *                   Só cai para o cache quando não há rede.
 *   /assets/*     → cache primeiro, sem medo. O Vite põe o hash do conteúdo no
 *                   nome, então um endereço desses nunca muda de conteúdo:
 *                   index-CuD11g5O.js é sempre aquele arquivo.
 *   /api/*        → NUNCA. Dado de pedido vindo do cache seria mentira com cara
 *                   de verdade. O offline da rota é resolvido no aplicativo,
 *                   com fila e IndexedDB, que sabe o que está pendente.
 *   tiles do mapa → cache com teto. Bairro já visto continua desenhando.
 *
 * O nome do cache não tem versão de propósito. Como cada arquivo de assets tem
 * hash próprio, publicar uma versão nova só acrescenta entradas — não há cache
 * velho para invalidar, e nenhum momento em que um arquivo que a página está
 * usando some debaixo dela.
 */

const CACHE = 'emporium'
const CACHE_TILES = 'emporium-mapa'

/** Teto do cache de mapa. Cada tile tem uns 50 KB; 400 dá uns 20 MB. */
const MAXIMO_TILES = 400

const ESSENCIAIS = ['/', '/index.html', '/logo.png']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ESSENCIAIS))
      // Falhar aqui não pode impedir a instalação: sem um dos essenciais o
      // service worker ainda serve todo o resto.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes.filter((n) => n !== CACHE && n !== CACHE_TILES).map((n) => caches.delete(n)),
        ),
      )
      // Assume o controle das abas já abertas, para valer já na primeira visita.
      .then(() => self.clients.claim()),
  )
})

/**
 * A página avisa o que já carregou, e guardamos.
 *
 * Existe por causa da PRIMEIRA visita: nela, o navegador baixa os arquivos do
 * site antes de este service worker assumir o controle, então nada disso passa
 * pelo `fetch` daqui e nada seria guardado. Quem abrisse o site uma vez e
 * ficasse sem sinal não conseguiria abrir de novo.
 *
 * A lista vem da própria página, que sabe exatamente o que usou — mais
 * confiável do que adivinhar nomes com hash.
 */
self.addEventListener('message', (evento) => {
  if (evento.data?.tipo !== 'guardar-estes') return

  const enderecos = Array.isArray(evento.data.enderecos) ? evento.data.enderecos : []
  evento.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const endereco of enderecos) {
        // Um a um, ignorando falhas: `addAll` desiste de tudo se um só falhar.
        if (await cache.match(endereco)) continue
        await cache.add(endereco).catch(() => undefined)
      }
    }),
  )
})

/** Guarda no cache e apara o excesso, para o mapa não crescer sem limite. */
async function guardarTile(requisicao, resposta) {
  const cache = await caches.open(CACHE_TILES)
  await cache.put(requisicao, resposta)

  const chaves = await cache.keys()
  if (chaves.length > MAXIMO_TILES) {
    // As mais antigas primeiro: quem entrou antes está no começo da lista.
    await Promise.all(chaves.slice(0, chaves.length - MAXIMO_TILES).map((c) => cache.delete(c)))
  }
}

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request
  if (requisicao.method !== 'GET') return

  const url = new URL(requisicao.url)

  // ── A API nunca passa por aqui ─────────────────────────────
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return

  // ── Mapa: cache primeiro, com teto ─────────────────────────
  if (url.hostname.endsWith('openfreemap.org')) {
    evento.respondWith(
      caches.match(requisicao).then(
        (guardada) =>
          guardada ??
          fetch(requisicao)
            .then((resposta) => {
              if (resposta.ok) void guardarTile(requisicao, resposta.clone())
              return resposta
            })
            // Bairro nunca visitado, sem rede: o mapa fica com o buraco, e a
            // lista de paradas continua funcionando.
            .catch(() => Response.error()),
      ),
    )
    return
  }

  // Fora isso, só mexemos no que é nosso.
  if (url.origin !== self.location.origin) return

  // ── HTML: rede primeiro ────────────────────────────────────
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          // Só guarda resposta boa. Sem esta conferência, um 404 do servidor
          // — rota do site que o host não sabe devolver, por exemplo — viraria
          // o "index.html" do cache, e o site abriria quebrado para sempre,
          // inclusive com internet.
          if (resposta.ok) {
            const copia = resposta.clone()
            void caches.open(CACHE).then((cache) => cache.put('/index.html', copia))
          }
          return resposta
        })
        .catch(() => caches.match('/index.html').then((guardada) => guardada ?? caches.match('/'))),
    )
    return
  }

  // ── Arquivos com hash no nome: cache primeiro ──────────────
  evento.respondWith(
    caches.match(requisicao).then(
      (guardada) =>
        guardada ??
        fetch(requisicao).then((resposta) => {
          if (resposta.ok && resposta.type === 'basic') {
            const copia = resposta.clone()
            void caches.open(CACHE).then((cache) => cache.put(requisicao, copia))
          }
          return resposta
        }),
    ),
  )
})
