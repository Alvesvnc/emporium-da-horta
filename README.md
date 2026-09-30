# Empórium da Horta — loja virtual

Hortifruti de atacado e varejo em Manaus. Três áreas no mesmo sistema:

- **Loja** — catálogo, busca, carrinho e checkout, sem cadastro obrigatório;
  quem quiser entra com o telefone e acompanha os pedidos
- **Painel do dono** — números do negócio e gestão de preços, fotos e produtos
- **Rota do motorista** — entregas do dia na ordem calculada pelas ruas, com
  navegação e lista de conferência

## Como rodar

Precisa de [Node.js](https://nodejs.org) 20 ou mais novo e de um **Postgres**
(local ou Supabase). Uma vez só:

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env
# abra o .env e preencha DATABASE_URL
createdb -U postgres emporium_dev
npm run db:migrate        # cria as tabelas
npm run db:preparar       # categorias, acessos da equipe e config da loja
```

**A loja abre vazia, e isso é o esperado.** Não há catálogo de exemplo: entre
como dono e cadastre os produtos em *Painel → Configurações*. O painel também
começa zerado, porque todo número dele sai de pedido de verdade.

Depois, sempre que for trabalhar:

```bash
npm run dev
```

Abre dois servidores ao mesmo tempo:

| Endereço | O que é |
| --- | --- |
| http://localhost:5173 | o site |
| http://localhost:3333 | a API (o site conversa com ela sozinho) |

Para parar, `Ctrl+C` no terminal.

**Acessos da equipe** (criados pelo `db:preparar`):

| Papel | E-mail | Senha |
| --- | --- | --- |
| Dono | dono@emporiumdahorta.com.br | horta123 |
| Motorista | motorista@emporiumdahorta.com.br | rota123 |

São senhas de desenvolvimento. Antes de colocar no ar, troque no `.env` e rode
`npm run db:preparar` de novo — ele atualiza a senha de quem já existe.

## Como está montado

Os dois lados seguem a mesma ideia: pastas por **assunto do negócio**, não por
tipo de arquivo. Quem vai mexer no checkout abre uma pasta e encontra tudo do
checkout junto, em vez de caçar pedaços em `components/`, `pages/` e `lib/`.

```
.                                 raiz do projeto
├── package.json                  workspaces: api e web
├── .env                          configuração local (não vai para o git)
│
├── api/                          servidor Fastify — as regras do negócio
│   ├── prisma/
│   │   ├── schema.prisma         desenho do banco
│   │   └── migrations/           SQL das migrações (não edite as já aplicadas)
│   ├── prisma.config.ts          URLs de conexão usadas pelo CLI do Prisma
│   └── src/
│       ├── main.ts               sobe o servidor
│       ├── app.ts                monta o Fastify: plugins + módulos
│       ├── config/               .env conferido (ambiente) e caminhos de disco
│       ├── banco/
│       │   ├── conexao.ts        Prisma Client + driver adapter do Postgres
│       │   ├── gerado/           Prisma Client (gerado, fora do git)
│       │   └── scripts/preparar  primeiro uso do banco
│       ├── modulos/              um por assunto: loja, pedidos, clientes,
│       │   │                     equipe, catalogo, configuracoes, metricas,
│       │   │                     entregas
│       │   └── pedidos/          *.endpoints (HTTP), *.servico (regras),
│       │                         *.esquemas (formato aceito)
│       └── comum/                autenticação, dinheiro, arquivos, endereços
│           └── entrega/          geografia (distância) e roteador (OSRM)
│
└── web/                          site em React — o que as pessoas veem
    └── src/
        ├── main.tsx              entra aqui
        ├── app/                  App, Rotas e o portão das telas da equipe
        ├── modulos/              uma pasta por área, uma TELA por arquivo
        │   ├── entrada/          TelaEntrada + MenuInicial + LoginCliente
        │   │                     + LoginEquipe
        │   ├── loja/             TelaLoja + vitrine, busca, filtro, cartão
        │   │                     de produto, barra do carrinho
        │   ├── checkout/         TelaCheckout, TelaPedidoConfirmado,
        │   │                     ResumoDoPedido, FormularioDeEntrega
        │   ├── meus-pedidos/     TelaMeusPedidos + CartaoPedido
        │   ├── painel/           TelaPainel + metricas/ + configuracoes/
        │   └── entregas/         TelaRota + MapaDaRota + CartaoParada
        ├── comum/                componentes, cliente HTTP e tipos, estado
        │                        (sessão e carrinho), formatação
        └── estilos/              tokens.css é a identidade visual da marca
```

Três combinações de nome que valem conhecer:

- Arquivo que começa com **`Tela`** é uma tela inteira, com endereço próprio no
  navegador. O resto são pedaços que alguma tela usa.
- Na API, o arquivo de HTTP se chama **`.endpoints.ts`**, não `rotas.ts`: aqui
  "rota" já é o caminho do motorista, e dois significados para a mesma palavra
  no mesmo projeto rende confusão garantida.
- CSS global fica em `estilos/`; o que é de uma área só mora com ela
  (`modulos/loja/loja.css`) e é carregado pela própria tela.

Três decisões que valem conhecer:

**Dinheiro é sempre inteiro, em centavos.** R$ 5,99 é gravado como `599`. Número com
vírgula acumula erro de arredondamento e some centavo em conta grande. A conversão
para "R$ 5,99" acontece só na hora de mostrar na tela.

**Quem soma o pedido é o servidor.** O navegador manda apenas o id do produto e a
quantidade. Preço, frete, pedido mínimo e total são calculados na API com o preço que
está valendo naquele instante — mexer no preço pelo navegador não muda o que é cobrado.

**O pedido guarda uma foto do momento.** Nome, preço e unidade de cada item ficam
copiados dentro do pedido. Se o dono mudar o preço da banana amanhã, o pedido de hoje
continua valendo o preço de hoje.

## Nada de dado inventado

Não existe mock no sistema. Nenhum produto, cliente, pedido, bairro ou número de
painel vem escrito no código: ou foi cadastrado por alguém, ou veio de um pedido
real, ou foi perguntado a um serviço externo.

Isso tem um custo que vale conhecer: **as telas abrem vazias até a loja começar a
funcionar de verdade.** É de propósito — número no painel que não veio de venda é
número que engana quem toma decisão com ele.

Sobraram dois atalhos de desenvolvimento, que não são dado falso mas são caminho
mais curto, e os dois desaparecem quando o WhatsApp entrar:

- `CANAL_CODIGO=console` imprime o código de acesso do cliente no terminal do
  servidor em vez de enviar. Em produção o servidor avisa em voz alta.
- Rodando em desenvolvimento, a tela de login mostra o código e os acessos da
  equipe, para não precisar procurar no terminal.

## O que o banco garante sozinho

A API valida tudo antes de gravar, mas ela não é o único caminho até os dados —
um script, uma correção manual em SQL ou um endpoint futuro passam por fora. Por
isso as regras que não podem ser quebradas estão no próprio banco:

| Regra | Onde |
| --- | --- |
| Preço de produto sempre maior que zero | `produtos` |
| Quantidade de item sempre maior que zero | `itens_pedido` |
| Subtotal do item = preço × quantidade | `itens_pedido` |
| Mesmo produto não repete no mesmo pedido | `itens_pedido` |
| Total do pedido = subtotal + frete, e nada negativo | `pedidos` |
| A loja tem uma única linha de configuração | `configuracoes` |

Tentar violar qualquer uma dá erro na hora da gravação, não uma linha estranha
descoberta meses depois.

**Fuso.** `FUSO_HORARIO` no `.env` (padrão `America/Manaus`) decide onde começa
"hoje" — no painel, na rota e no agrupamento por dia e semana. Ele é aplicado em
três lugares: no processo Node, na sessão do Postgres e explicitamente nas
consultas do painel. Isso importa porque hospedagem roda em UTC por padrão e o
Postgres embutido nasce em GMT: sem fixar, um pedido feito às 21h de segunda
seria contado na terça.

**Índices.** Chave estrangeira no Postgres não ganha índice automático. Estão
criados os que as consultas realmente usam — itens por pedido, pedidos por data,
pedidos de um cliente, e o telefone só com dígitos (índice sobre a expressão, do
contrário a busca do login ignoraria o índice).

**Onde estão essas regras.** A linguagem de schema do Prisma não declara CHECK,
índice sobre expressão, sequência com início próprio nem RLS. Tudo isso é SQL
escrito à mão no fim de `prisma/migrations/*/migration.sql`, num bloco marcado.

Consequência: o `schema.prisma` **não** é a descrição completa do banco, e
`prisma db push` — que sincroniza direto pelo schema, ignorando as migrações —
apagaria esse bloco. Use sempre `npm run db:migrate`.

## Login do cliente

Comprar nunca exige login. Entrar serve para uma coisa só: ver os pedidos antigos de
qualquer aparelho.

Funciona por telefone e código de 6 dígitos — sem senha para criar, esquecer ou vazar.
Quem já comprou como visitante e depois entra com o mesmo telefone **recebe os pedidos
antigos na conta automaticamente**, sem precisar refazer nada.

Detalhes que valem conhecer:

- Só o hash do código fica guardado, pelo mesmo motivo que senha não se guarda em
  texto puro. Ele vale 10 minutos, aceita 5 tentativas e pedir um novo invalida o anterior.
- No máximo 3 códigos por telefone a cada 15 minutos, para ninguém encher o telefone
  dos outros de mensagem.
- O nome só é pedido **depois** de conferir o código, para a tela de login não revelar
  quais telefones já têm conta.
- Códigos vencidos há mais de um dia são apagados junto com o envio do próximo,
  para a tabela não crescer para sempre.

**Hoje o código aparece no terminal do servidor** (`CANAL_CODIGO=console`), e em
desenvolvimento também na própria tela. Isso serve para testar; nenhum cliente de
verdade conseguiria entrar assim. Ligar o envio por WhatsApp é o próximo passo — o
servidor avisa em voz alta se subir em produção sem isso.

## Endereços e rota

**Preenchimento pelo CEP.** No checkout, ao completar os 8 dígitos, bairro e rua
vêm da [BrasilAPI](https://brasilapi.com.br) e o cursor pula para o número — que é
a única coisa que o CEP não sabe. CEP inexistente ou serviço fora do ar não travam
nada: a pessoa preenche à mão. Não precisa de chave nem de cadastro.

> A BrasilAPI também devolve uma coordenada, e ela **não é usada**. Em Manaus,
> todo CEP responde o mesmo ponto (−3,10194 / −60,025 — o centro da cidade), o que
> jogaria todas as entregas no mesmo lugar. Foi testado; não reintroduza.

**Onde fica a entrega.** Não existe lista de bairros no código. A coordenada é
perguntada ao mapa ([Nominatim](https://nominatim.openstreetmap.org), do
OpenStreetMap), nesta ordem:

1. endereço completo, com número da casa → precisão **exata**
2. só o bairro → precisão **aproximada**
3. nada — a parada aparece na lista, fora do mapa

O pedido registra em qual degrau parou, e a tela do motorista mostra a diferença:
pino de borda tracejada é endereço aproximado, no qual não dá para confiar de olhos
fechados. Tudo que já foi perguntado fica em cache — inclusive o "não achei", que
também é resposta. Só falha de rede não vira cache, para um minuto de internet ruim
não envenenar um endereço para sempre.

**Por onde dirigir.** A ordem das paradas e o traçado vêm do
[OSRM](https://project-osrm.org), que resolve a ordem pelas ruas de verdade e devolve
distância e tempo reais. O mapa desenha o caminho, e cada parada tem um botão
**Navegar** que abre o Google Maps no aparelho — com a coordenada exata quando existe,
e com o endereço escrito quando ela é só aproximada (mandar o centro do bairro levaria
o motorista para a rua errada com cara de certeza). Há também um botão que joga a rota
inteira no Google Maps de uma vez.

Se o serviço de rotas não responder, a tela **não quebra**: cai sozinha para a ordem
em linha reta e avisa, em vez de deixar o motorista esperando.

> O `OSRM_URL` padrão é a demo pública do projeto — boa para desenvolver, sem garantia
> de disponibilidade. Antes de colocar no ar,
> [suba o seu OSRM](https://github.com/Project-OSRM/osrm-backend) ou troque por um
> serviço pago; muda uma linha do `.env`.

## Trocando para o Supabase

Hoje o banco é um Postgres embutido que roda na sua máquina (pasta `api/.data/`), sem
precisar instalar nada. Quando quiser o banco na nuvem:

1. Crie um projeto grátis em [supabase.com](https://supabase.com) — anote a senha do banco.
2. No painel: **Project Settings → Database → Connection string → URI**, e copie.
3. No `.env`:

```env
DATABASE_URL=postgresql://postgres:SUA-SENHA@db.xxxx.supabase.co:5432/postgres
```

4. `npm run db:migrate` e `npm run db:preparar`.

É o mesmo Postgres e as mesmas migrações — nada no código muda.

Para as fotos dos produtos irem para a nuvem também, crie um bucket público chamado
`produtos` em **Storage** e preencha no `.env`:

```env
STORAGE_DRIVER=supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...      # Project Settings → API
```

A chave `service_role` dá acesso total ao projeto: ela fica só no servidor, nunca no
site, e nunca no git.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | sobe site e API juntos |
| `npm run check` | confere os tipos dos dois lados |
| `npm run build` | gera a versão de produção |
| `npm run db:migrate` | cria/aplica migrações (desenvolvimento) |
| `npm run db:deploy` | aplica migrações pendentes (produção) |
| `npm run db:preparar` | deixa um banco novo utilizável (não cria dados de exemplo) |
| `npm run db:generate` | regera o Prisma Client depois de mexer no schema |
| `npm run db:reset` | apaga tudo, remigra e prepara de novo |
| `npm run db:studio` | abre o navegador de dados do Prisma |

Os comandos de banco podem rodar com o servidor no ar: o Postgres aguenta
vários clientes ao mesmo tempo.

## A API

Aberto, sem login:

| | |
| --- | --- |
| `GET /api/loja` | catálogo, categorias e regras da loja |
| `GET /api/produtos?busca=&categoria=` | busca e filtro |
| `POST /api/pedidos` | fecha um pedido (aceita token de cliente, não exige) |
| `GET /api/pedidos/:numero?telefone=` | acompanha um pedido |
| `GET /api/cep/:cep` | endereço do CEP, para o checkout preencher |
| `POST /api/cliente/codigo` | pede o código de acesso |
| `POST /api/cliente/sessao` | troca o código por uma sessão |

Cliente, com token:

| | |
| --- | --- |
| `GET /api/cliente/eu` | confere a sessão |
| `GET /api/cliente/pedidos` | histórico de pedidos |

Equipe, com token:

| | |
| --- | --- |
| `POST /api/auth/login` | login do dono e do motorista |
| `GET /api/admin/metricas` | números do painel |
| `GET/POST/PATCH /api/admin/produtos` | catálogo |
| `POST /api/admin/produtos/:id/foto` | envio da foto |
| `GET/PUT /api/admin/configuracoes` | pedido mínimo, frete, meta |
| `GET /api/rota/hoje` | entregas do dia na ordem, com traçado e links de navegação |
| `PATCH /api/rota/paradas/:pedidoId` | marca entregue |

## O que ainda falta

1. **WhatsApp.** Falta nos dois lugares: avisar o cliente quando o pedido é
   confirmado e sai para entrega, e entregar o código de acesso do login. Hoje o
   código só aparece no terminal do servidor, o que basta para desenvolver e não
   serve para ninguém de verdade. É o mesmo canal, então resolve os dois de uma vez
   (API oficial da Meta ou um intermediário).
2. **OSRM próprio.** A rota usa a demo pública do OSRM, que não tem garantia de
   disponibilidade. Antes de depender dela no dia a dia, suba a sua.
4. **Colocar no ar.** Falta escolher hospedagem, domínio e HTTPS.

Decidido que **não** entra: controle de estoque. A compra é feita em cima dos
pedidos já fechados, então não há saldo a reservar nem a travar.

Pendência pequena: a coluna `pedidos.ordem_rota` continua declarada e sem uso —
a ordem das paradas é calculada na hora pelo OSRM. Ou some, ou passa a guardar a
ordem do dia.
