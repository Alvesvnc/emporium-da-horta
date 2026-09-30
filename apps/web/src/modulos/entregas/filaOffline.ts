import { chamar, ErroApi } from '../../comum/api/http'
import type { MotivoNaoEntrega, RespostaRota } from '@emporium/shared'
import { acrescentar, GAVETAS, guardar, ler, listar, remover } from '../../comum/offline/deposito'
import { encolherImagem } from '../../comum/imagem/encolher'

/**
 * O que o motorista fez sem sinal, esperando para ser enviado.
 *
 * A regra que sustenta tudo: o trabalho dele nunca depende da rede. Ele marca a
 * entrega, a ação entra na fila, a tela responde na hora, e o envio acontece
 * quando o sinal voltar. Em Manaus isso não é luxo — é o dia normal.
 *
 * A ordem de envio é a ordem em que ele marcou. Se uma falhar, para ali e tenta
 * de novo depois: mandar a de trás na frente bagunçaria o histórico, e um erro
 * repetido a cada envio viraria uma enxurrada de tentativas inúteis.
 */

export type AcaoPendente =
  | { id?: number; tipo: 'em_rota'; pedidoId: number; em: number }
  | {
      id?: number
      tipo: 'entregue'
      pedidoId: number
      recebidoPor: string
      /** A foto vai crua para o IndexedDB — é o motivo de não ser localStorage. */
      foto: Blob | null
      em: number
    }
  | {
      id?: number
      tipo: 'nao_entregue'
      pedidoId: number
      motivo: MotivoNaoEntrega
      observacao: string
      em: number
    }

const CHAVE_ROTA = 'hoje'

// ── A rota guardada ──────────────────────────────────────────

export type RotaGuardada = { rota: RespostaRota; em: number }

export async function guardarRotaLocal(rota: RespostaRota): Promise<void> {
  await guardar(GAVETAS.rota, CHAVE_ROTA, { rota, em: Date.now() } satisfies RotaGuardada)
}

export async function lerRotaLocal(): Promise<RotaGuardada | null> {
  return ler<RotaGuardada>(GAVETAS.rota, CHAVE_ROTA)
}

// ── A fila ───────────────────────────────────────────────────

export async function enfileirar(acao: AcaoPendente): Promise<void> {
  await acrescentar(GAVETAS.fila, acao)
}

export async function pendentes(): Promise<AcaoPendente[]> {
  return listar<AcaoPendente>(GAVETAS.fila)
}

/**
 * Uma falha vale nova tentativa, ou é definitiva?
 *
 * Fica na fila quando o problema é de fora da ação:
 *   0        — o pedido nem saiu do aparelho, não há sinal;
 *   5xx      — o servidor está fora do ar;
 *   401/403  — a sessão venceu. Isso acontece no meio de um dia de trabalho, e
 *              a ação passa a valer de novo assim que ele refizer o login.
 *              Descartar aqui apagaria uma entrega de verdade, em silêncio.
 *
 * Sai da fila só quando o servidor diz que aquilo nunca vai valer — pedido
 * cancelado enquanto ele dirigia, por exemplo. Insistir nesses encheria a fila
 * para sempre com algo que não tem conserto.
 */
const AINDA_PODE_DAR_CERTO = new Set([401, 403])

export function vaiAdiantarTentarDeNovo(falha: unknown): boolean {
  if (!(falha instanceof ErroApi)) return true
  if (falha.status === 0 || falha.status >= 500) return true
  return AINDA_PODE_DAR_CERTO.has(falha.status)
}

export async function enviarUma(acao: AcaoPendente): Promise<void> {
  if (acao.tipo === 'em_rota') {
    await chamar(`/api/rota/paradas/${acao.pedidoId}`, {
      metodo: 'PATCH',
      corpo: { status: 'em_rota' },
    })
    return
  }

  if (acao.tipo === 'nao_entregue') {
    await chamar(`/api/rota/paradas/${acao.pedidoId}`, {
      metodo: 'PATCH',
      corpo: {
        status: 'nao_entregue',
        motivo: acao.motivo,
        observacao: acao.observacao || undefined,
      },
    })
    return
  }

  // A foto vai antes de marcar entregue, pelo mesmo motivo de quando há rede:
  // comprovante que não subiu não pode virar entrega dada por concluída.
  if (acao.foto) {
    const envio = new FormData()
    envio.append('foto', acao.foto, 'entrega.jpg')
    await chamar(`/api/rota/paradas/${acao.pedidoId}/foto`, { metodo: 'POST', arquivo: envio })
  }

  await chamar(`/api/rota/paradas/${acao.pedidoId}`, {
    metodo: 'PATCH',
    corpo: { status: 'entregue', recebidoPor: acao.recebidoPor || undefined },
  })
}

export type ResultadoDescarga = { enviadas: number; restantes: number; descartadas: number }

/**
 * Tenta enviar tudo que está na fila, na ordem.
 *
 * Para na primeira falha passageira: se a rede caiu de novo, insistir nas
 * seguintes só gasta bateria. As definitivas são descartadas para a fila não
 * travar para sempre numa ação que o servidor nunca vai aceitar.
 */
export async function descarregar(): Promise<ResultadoDescarga> {
  const fila = await pendentes()
  let enviadas = 0
  let descartadas = 0

  for (const acao of fila) {
    try {
      await enviarUma(acao)
      if (acao.id !== undefined) await remover(GAVETAS.fila, acao.id)
      enviadas++
    } catch (falha) {
      if (vaiAdiantarTentarDeNovo(falha)) {
        return { enviadas, restantes: fila.length - enviadas - descartadas, descartadas }
      }
      if (acao.id !== undefined) await remover(GAVETAS.fila, acao.id)
      descartadas++
    }
  }

  return { enviadas, restantes: 0, descartadas }
}

/**
 * Aplica a ação na rota que está na tela, sem falar com o servidor.
 *
 * Offline a ordem das paradas NÃO é recalculada — quem otimiza é o serviço de
 * rotas, e ele está do outro lado da conexão que caiu. As paradas restantes
 * seguem na ordem que já estava, que é a última boa que tivemos.
 */
export function aplicarLocalmente(rota: RespostaRota, acao: AcaoPendente): RespostaRota {
  if (acao.tipo === 'em_rota') {
    return {
      ...rota,
      paradas: rota.paradas.map((p) =>
        p.pedidoId === acao.pedidoId ? { ...p, status: 'em_rota' as const } : p,
      ),
    }
  }

  const saindo = rota.paradas.find((p) => p.pedidoId === acao.pedidoId)
  const paradas = rota.paradas.filter((p) => p.pedidoId !== acao.pedidoId)
  const semLocalizacao = rota.semLocalizacao.filter((p) => p.pedidoId !== acao.pedidoId)

  return {
    ...rota,
    paradas,
    semLocalizacao,
    entregues:
      acao.tipo === 'entregue' && saindo
        ? [
            ...rota.entregues,
            {
              pedidoId: saindo.pedidoId,
              numero: saindo.numero,
              cliente: saindo.cliente,
              bairro: saindo.bairro,
              // Sem rede, a hora da entrega é o momento em que ele marcou —
              // que é a verdade. O servidor gravará a sua quando a fila subir,
              // alguns minutos depois; a diferença não muda nada para ninguém.
              entregueEm: new Date(acao.em).toISOString(),
              totalCentavos: saindo.totalCentavos,
            },
          ]
        : rota.entregues,
    resumo: {
      ...rota.resumo,
      restantes: Math.max(0, rota.resumo.restantes - 1),
    },
  }
}

/** Prepara a foto para a fila: encolhida, para caber e para subir rápido depois. */
export async function fotoParaFila(foto: File | null): Promise<Blob | null> {
  if (!foto) return null
  return encolherImagem(foto)
}
