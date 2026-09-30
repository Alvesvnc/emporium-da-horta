/**
 * Liga o service worker, que é o que faz o site abrir sem internet.
 *
 * Só em produção, de propósito. Em desenvolvimento ele atrapalha de um jeito
 * traiçoeiro: o Vite troca módulos em tempo real, o service worker serve o
 * arquivo guardado, e a pessoa passa meia hora depurando uma alteração que já
 * estava certa. Pior ainda, um service worker registrado durante o
 * desenvolvimento continua vivo depois — por isso, ali, ele é REMOVIDO.
 *
 * Falhar aqui nunca quebra o site: sem service worker ele volta a exigir
 * internet para abrir, que é como era antes.
 */
export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  if (!import.meta.env.PROD) {
    // Limpa o que tiver ficado de uma sessão anterior neste navegador.
    void navigator.serviceWorker.getRegistrations().then((registros) => {
      for (const registro of registros) void registro.unregister()
    })
    return
  }

  // Depois do `load` para não disputar banda com o que a tela precisa agora.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => avisarOQueJaCarregou())
      .catch(() => {
        // Navegador sem suporte, contexto sem https, permissão negada: segue
        // funcionando online.
      })
  })
}

/**
 * Conta ao service worker quais arquivos esta página usou.
 *
 * É o que resolve a primeira visita. Nela, o navegador baixa tudo ANTES de o
 * service worker assumir o controle, então nada passa pelo `fetch` dele e nada
 * é guardado — quem abrisse o site uma vez e ficasse sem sinal não conseguiria
 * abrir de novo. A lista sai de `performance`, que registra o que foi de fato
 * baixado, em vez de tentarmos adivinhar nomes com hash.
 */
function avisarOQueJaCarregou(): void {
  const destino = navigator.serviceWorker.controller
  if (!destino) return

  const enderecos = performance
    .getEntriesByType('resource')
    .filter((recurso): recurso is PerformanceResourceTiming => 'initiatorType' in recurso)
    .filter((recurso) => ['script', 'link', 'css', 'img'].includes(recurso.initiatorType))
    .map((recurso) => recurso.name)
    .filter((endereco) => endereco.startsWith(self.location.origin))

  if (enderecos.length > 0) destino.postMessage({ tipo: 'guardar-estes', enderecos })
}
