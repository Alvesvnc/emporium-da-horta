import { lazy, Suspense, useCallback, useState } from 'react'
import { chamar, ErroApi } from '../../../comum/api/http'
import type { Configuracoes, EnderecoDeCep, Localizacao } from '@emporium/shared'
import { formatarCep, useBuscaCep } from '../../../comum/ganchos/useBuscaCep'

/** O mapa custa quase 1 MB. Só carrega quando há um ponto para mostrar. */
const SeletorDePonto = lazy(() =>
  import('../../../comum/componentes/SeletorDePonto').then((m) => ({ default: m.SeletorDePonto })),
)

/**
 * A sede: de onde o motorista sai e para onde volta.
 *
 * É a configuração mais consequente do painel. Toda a rota do dia — a ordem
 * das paradas, os quilômetros, os minutos — é medida a partir daqui. Sede
 * errada não dá erro em lugar nenhum: só entrega números errados com cara de
 * certeza. Por isso a tela insiste em mostrar o pino no mapa antes de salvar.
 */
export function CentralDeDistribuicao({
  config,
  aoSalvar,
}: {
  config: Configuracoes
  aoSalvar: (config: Configuracoes) => void
}) {
  const [nome, setNome] = useState(config.centralNome)
  const [cep, setCep] = useState(formatarCep(config.centralCep ?? ''))
  const [rua, setRua] = useState(config.centralRua ?? '')
  const [numero, setNumero] = useState(config.centralNumero ?? '')
  const [bairro, setBairro] = useState(config.centralBairro ?? '')
  const [ponto, setPonto] = useState<{ latitude: number; longitude: number } | null>(
    config.centralLatitude != null && config.centralLongitude != null
      ? { latitude: config.centralLatitude, longitude: config.centralLongitude }
      : null,
  )

  const [localizando, setLocalizando] = useState(false)
  const [precisao, setPrecisao] = useState<Localizacao['precisao'] | null>(null)
  const [estado, setEstado] = useState<'parado' | 'salvando' | 'salvo'>('parado')
  const [erro, setErro] = useState('')

  const preencherPeloCep = useCallback((endereco: EnderecoDeCep) => {
    // A BrasilAPI devolve coordenada, mas em Manaus ela é inútil: todo CEP
    // responde o mesmo ponto no centro da cidade. Usamos só o texto.
    if (endereco.rua) setRua(endereco.rua)
    if (endereco.bairro) setBairro(endereco.bairro)
  }, [])

  const { estado: buscaCep, buscar } = useBuscaCep(preencherPeloCep)

  async function localizarNoMapa() {
    setLocalizando(true)
    setErro('')
    try {
      const { localizacao } = await chamar<{ localizacao: Localizacao }>(
        '/api/admin/central/localizar',
        { metodo: 'POST', corpo: { rua, numero, bairro, cep } },
      )
      if (localizacao.latitude === null || localizacao.longitude === null) {
        setPrecisao('desconhecida')
        setErro('Não achei esse endereço no mapa. Marque o ponto à mão, se souber onde fica.')
        return
      }
      setPonto({ latitude: localizacao.latitude, longitude: localizacao.longitude })
      setPrecisao(localizacao.precisao)
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui procurar o endereço.')
    } finally {
      setLocalizando(false)
    }
  }

  async function salvar() {
    if (!ponto) {
      setErro('Marque a sede no mapa antes de salvar.')
      return
    }

    setEstado('salvando')
    setErro('')
    try {
      const resposta = await chamar<{ configuracoes: Configuracoes }>('/api/admin/configuracoes', {
        metodo: 'PUT',
        corpo: {
          centralNome: nome.trim(),
          centralCep: cep.replace(/\D/g, ''),
          centralRua: rua.trim(),
          centralNumero: numero.trim(),
          centralBairro: bairro.trim(),
          centralLatitude: ponto.latitude,
          centralLongitude: ponto.longitude,
        },
      })
      aoSalvar(resposta.configuracoes)
      setEstado('salvo')
      setTimeout(() => setEstado('parado'), 2500)
    } catch (falha) {
      setEstado('parado')
      setErro(falha instanceof ErroApi ? falha.message : 'Não consegui salvar.')
    }
  }

  const jaConfigurada = config.centralLatitude != null

  return (
    <section className="cartao central-cartao">
      <div>
        <h2 className="titulo central-titulo">Central de distribuição</h2>
        <p className="central-explicacao">
          De onde o motorista sai e para onde volta. Muda a sede, muda a rota — todo o cálculo de
          quilômetros e tempo das entregas parte daqui.
        </p>
      </div>

      {!jaConfigurada && (
        <div className="aviso-falha">
          A sede ainda não foi definida. Até você marcar o ponto aqui, a rota do motorista está
          sendo calculada a partir de um endereço provisório — e os quilômetros e horários que
          aparecem para ele estão errados.
        </div>
      )}

      <label className="campo-rotulo">
        Nome
        <input
          className="campo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Empórium da Horta — galpão"
          maxLength={80}
        />
      </label>

      <div className="central-linha">
        <label className="campo-rotulo central-cep">
          CEP
          <input
            className="campo numerico"
            value={cep}
            onChange={(e) => {
              const formatado = formatarCep(e.target.value)
              setCep(formatado)
              void buscar(formatado)
            }}
            inputMode="numeric"
            placeholder="69000-000"
          />
          {buscaCep === 'buscando' && <span className="legenda">procurando…</span>}
          {buscaCep === 'nao-encontrado' && (
            <span className="legenda">CEP não encontrado — preencha à mão.</span>
          )}
        </label>

        <label className="campo-rotulo central-numero">
          Número
          <input
            className="campo"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            maxLength={20}
          />
        </label>
      </div>

      <label className="campo-rotulo">
        Rua
        <input
          className="campo"
          value={rua}
          onChange={(e) => setRua(e.target.value)}
          maxLength={160}
        />
      </label>

      <label className="campo-rotulo">
        Bairro
        <input
          className="campo"
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
          maxLength={80}
        />
      </label>

      <button
        type="button"
        className="botao botao-contorno central-localizar"
        onClick={() => void localizarNoMapa()}
        disabled={localizando || (!rua.trim() && !bairro.trim())}
      >
        {localizando ? 'Procurando no mapa…' : 'Localizar pelo endereço'}
      </button>

      {precisao === 'aproximada' && (
        <p className="central-alerta">
          Só encontrei o bairro, não a rua. O pino está no meio do bairro — arraste até o portão.
        </p>
      )}

      {ponto && (
        <Suspense fallback={<div className="seletor-ponto-tela mapa-carregando">Carregando o mapa…</div>}>
          <SeletorDePonto
            latitude={ponto.latitude}
            longitude={ponto.longitude}
            aoMover={(latitude, longitude) => {
              setPonto({ latitude, longitude })
              setPrecisao('exata')
            }}
          />
        </Suspense>
      )}

      <div className="central-acoes">
        <button
          type="button"
          className="botao botao-verde"
          onClick={() => void salvar()}
          disabled={estado === 'salvando' || !ponto}
        >
          {estado === 'salvando' ? 'Salvando…' : 'Salvar sede'}
        </button>
        {estado === 'salvo' && <span className="central-selo">a rota já sai daqui</span>}
        {ponto && (
          <span className="legenda numerico">
            {ponto.latitude.toFixed(5)}, {ponto.longitude.toFixed(5)}
          </span>
        )}
      </div>

      {erro && <div className="erro">{erro}</div>}
    </section>
  )
}
