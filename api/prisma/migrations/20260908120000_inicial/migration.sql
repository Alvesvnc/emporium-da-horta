-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "papel_equipe" AS ENUM ('dono', 'motorista');

-- CreateEnum
CREATE TYPE "unidade_venda" AS ENUM ('kg', 'un', 'maco', 'bandeja', 'cartela');

-- CreateEnum
CREATE TYPE "forma_pagamento" AS ENUM ('pix', 'cartao', 'dinheiro');

-- CreateEnum
CREATE TYPE "status_pedido" AS ENUM ('recebido', 'em_separacao', 'em_rota', 'entregue', 'cancelado');

-- CreateEnum
CREATE TYPE "precisao_local" AS ENUM ('exata', 'aproximada', 'desconhecida');

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🥦',
    "foto_url" TEXT,
    "preco_centavos" INTEGER NOT NULL,
    "unidade" "unidade_venda" NOT NULL DEFAULT 'kg',
    "categoria_id" INTEGER NOT NULL,
    "oferta" BOOLEAN NOT NULL DEFAULT false,
    "oculto" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "telefone_normalizado" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_equipe" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "papel_equipe" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_acesso" (
    "id" SERIAL NOT NULL,
    "telefone" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "usado_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos_geocodificados" (
    "id" SERIAL NOT NULL,
    "chave" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precisao" "precisao_local" NOT NULL,
    "rotulo_encontrado" TEXT,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enderecos_geocodificados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "numero" SERIAL NOT NULL,
    "cliente_id" INTEGER,
    "nome_contato" TEXT NOT NULL,
    "telefone_contato" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "rua" TEXT NOT NULL,
    "numero_endereco" TEXT NOT NULL,
    "complemento" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precisao_local" "precisao_local" NOT NULL DEFAULT 'desconhecida',
    "forma_pagamento" "forma_pagamento" NOT NULL,
    "agendado_para" TIMESTAMPTZ,
    "subtotal_centavos" INTEGER NOT NULL,
    "frete_centavos" INTEGER NOT NULL,
    "total_centavos" INTEGER NOT NULL,
    "status" "status_pedido" NOT NULL DEFAULT 'recebido',
    "ordem_rota" INTEGER,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregue_em" TIMESTAMPTZ,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "produto_id" INTEGER,
    "nome_produto" TEXT NOT NULL,
    "emoji_produto" TEXT NOT NULL DEFAULT '🥦',
    "preco_unitario_centavos" INTEGER NOT NULL,
    "unidade" "unidade_venda" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "subtotal_centavos" INTEGER NOT NULL,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pedido_minimo_centavos" INTEGER NOT NULL DEFAULT 3000,
    "taxa_entrega_centavos" INTEGER NOT NULL DEFAULT 800,
    "entrega_gratis_acima_centavos" INTEGER NOT NULL DEFAULT 9900,
    "meta_semanal_centavos" INTEGER NOT NULL DEFAULT 2500000,
    "hora_limite_pedido" INTEGER NOT NULL DEFAULT 12,
    "janela_entrega" TEXT NOT NULL DEFAULT 'hoje entre 15h e 18h',
    "atualizado_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");

-- CreateIndex
CREATE INDEX "produtos_categoria_idx" ON "produtos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_telefone_normalizado_idx" ON "clientes"("telefone_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_equipe_email_key" ON "usuarios_equipe"("email");

-- CreateIndex
CREATE INDEX "codigos_acesso_telefone_idx" ON "codigos_acesso"("telefone", "criado_em");

-- CreateIndex
CREATE INDEX "codigos_acesso_expira_em_idx" ON "codigos_acesso"("expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "enderecos_geocodificados_chave_key" ON "enderecos_geocodificados"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");

-- CreateIndex
CREATE INDEX "pedidos_criado_em_idx" ON "pedidos"("criado_em");

-- CreateIndex
CREATE INDEX "pedidos_cliente_criado_em_idx" ON "pedidos"("cliente_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "itens_pedido_produto_idx" ON "itens_pedido"("produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "itens_pedido_pedido_produto_idx" ON "itens_pedido"("pedido_id", "produto_id");

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- A PARTIR DAQUI É SQL ESCRITO À MÃO
--
-- A linguagem de schema do Prisma não declara sequência com início próprio,
-- constraint CHECK, índice sobre expressão nem RLS. Então estas regras vivem
-- aqui, e o schema.prisma NÃO é a descrição completa do banco.
--
-- Consequência prática: se alguém rodar `prisma db push` (que ignora as
-- migrações e sincroniza direto pelo schema), tudo abaixo desaparece. Use
-- sempre `prisma migrate`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Número do pedido começa em 1000 ───────────────────────────────────────
-- Para o primeiro cliente não receber "pedido #1" e saber que é o primeiro.
ALTER SEQUENCE "pedidos_numero_seq" RESTART WITH 1000;

-- ── Integridade do dinheiro e das quantidades ────────────────────────────
-- A API já valida tudo isso, mas ela não é o único caminho até os dados: um
-- script, uma correção manual em SQL ou um endpoint futuro passam por fora.
ALTER TABLE "produtos"
  ADD CONSTRAINT "produtos_preco_positivo"
  CHECK ("preco_centavos" > 0);

ALTER TABLE "itens_pedido"
  ADD CONSTRAINT "itens_pedido_quantidade_positiva"
  CHECK ("quantidade" > 0);

ALTER TABLE "itens_pedido"
  ADD CONSTRAINT "itens_pedido_preco_nao_negativo"
  CHECK ("preco_unitario_centavos" >= 0);

ALTER TABLE "itens_pedido"
  ADD CONSTRAINT "itens_pedido_subtotal_confere"
  CHECK ("subtotal_centavos" = "preco_unitario_centavos" * "quantidade");

ALTER TABLE "pedidos"
  ADD CONSTRAINT "pedidos_valores_nao_negativos"
  CHECK ("subtotal_centavos" >= 0 AND "frete_centavos" >= 0 AND "total_centavos" >= 0);

ALTER TABLE "pedidos"
  ADD CONSTRAINT "pedidos_total_confere"
  CHECK ("total_centavos" = "subtotal_centavos" + "frete_centavos");

ALTER TABLE "codigos_acesso"
  ADD CONSTRAINT "codigos_acesso_tentativas_nao_negativas"
  CHECK ("tentativas" >= 0);

-- A loja tem UMA configuração. Sem isto, nada impede uma segunda linha que
-- ninguém lê e que faz o dono jurar que salvou e não pegou.
ALTER TABLE "configuracoes"
  ADD CONSTRAINT "configuracoes_linha_unica"
  CHECK ("id" = 1);

-- ── Índice sobre expressão ────────────────────────────────────────────────
-- No login, os pedidos feitos como visitante são encontrados pelo telefone só
-- com dígitos. A busca usa esta mesma expressão; um índice na coluna crua não
-- serviria para nada.
CREATE INDEX "pedidos_telefone_digitos_idx"
  ON "pedidos" (regexp_replace("telefone_contato", '[^0-9]', '', 'g'));

-- ── Proteção contra a API automática do Supabase ─────────────────────────
-- O Supabase publica um REST automático em cima de tudo que está no schema
-- `public`. Sem RLS, qualquer pessoa com a chave `anon` — que é pública por
-- definição e vive no código do site — leria a tabela de clientes com
-- telefones e mudaria preço de produto, passando por fora da nossa API.
--
-- RLS ligado e nenhuma política criada = ninguém com a chave anon passa.
-- Nossa API continua funcionando porque conecta como DONO das tabelas, e dono
-- não é barrado por RLS.
--
-- Atenção: se algum dia a aplicação passar a conectar com um usuário limitado
-- em vez do dono, será preciso criar políticas ou dar BYPASSRLS a ele.
ALTER TABLE "categorias"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "produtos"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clientes"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios_equipe"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "codigos_acesso"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enderecos_geocodificados"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedidos"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "itens_pedido"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "configuracoes"             ENABLE ROW LEVEL SECURITY;
