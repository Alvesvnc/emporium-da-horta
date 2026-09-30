import type { EstadoGps, PosicaoAoVivo } from '../../comum/ganchos/useLocalizacaoAoVivo'

/**
 * O controle do GPS, com recado para cada jeito de dar errado.
 *
 * O navegador falha calado quando a localização não vem: nada acontece e o
 * motorista fica achando que o site travou. Cada estado aqui tem uma frase que
 * diz o que houve e o que fazer — inclusive os dois casos que não têm conserto
 * dentro do site (permissão negada e endereço sem https).
 */

const RECADO: Record<EstadoGps, string | null> = {
  desligado: 'Ligue para o mapa mostrar onde você está e quanto falta para a próxima parada.',
  pedindo: 'Procurando o sinal do GPS…',
  seguindo: null,
  'sem-sinal':
    'Ainda sem posição, mas continuo tentando. Computador não tem GPS: ele pergunta a um serviço na internet onde a sua rede fica, e às vezes esse serviço não responde. É no celular, com o site aberto por https, que a posição vem de verdade — e com precisão de metros, não de quarteirões.',
  negado:
    'A localização está bloqueada para este site. Libere nas permissões do navegador (o cadeado na barra de endereço) e toque de novo.',
  indisponivel: 'Este aparelho não oferece localização.',
  'sem-https':
    'O navegador só libera o GPS em endereço seguro (https). Abra o site pelo endereço publicado, não pelo IP da rede local.',
  falhou: 'Não consegui a posição. Confira se a localização do aparelho está ligada.',
}

/** Estados em que já estamos ouvindo o aparelho — o botão vira "desligar". */
const TENTANDO: EstadoGps[] = ['pedindo', 'seguindo', 'sem-sinal']

export function BarraGps({
  estado,
  posicao,
  ligar,
  desligar,
}: {
  estado: EstadoGps
  posicao: PosicaoAoVivo | null
  ligar: () => void
  desligar: () => void
}) {
  const tentando = TENTANDO.includes(estado)
  const recado = RECADO[estado]

  // Nestes dois não adianta oferecer o botão: tocar de novo dá no mesmo até a
  // pessoa mexer fora do site.
  const semSaida = estado === 'indisponivel' || estado === 'sem-https'

  return (
    <div className="gps-barra">
      {!semSaida && (
        // Nunca desabilitado: mesmo enquanto procura, o motorista precisa
        // conseguir desistir em vez de ficar preso olhando "Procurando…".
        <button
          type="button"
          className={`botao gps-botao ${tentando ? 'botao-contorno' : 'botao-verde'}`}
          onClick={tentando ? desligar : ligar}
        >
          {tentando ? 'Desligar GPS' : 'Ligar GPS'}
        </button>
      )}

      {estado === 'seguindo' && posicao && (
        <span className="gps-estado gps-estado-vivo">
          Seguindo você · precisão de {Math.round(posicao.precisaoMetros)} m
        </span>
      )}

      {estado === 'pedindo' && <span className="gps-estado">Procurando…</span>}

      {recado && <p className="gps-recado">{recado}</p>}
    </div>
  )
}
