-- CreateTable
CREATE TABLE "posicoes_motorista" (
    "usuario_id" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precisao_metros" DOUBLE PRECISION NOT NULL,
    "atualizado_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "posicoes_motorista_pkey" PRIMARY KEY ("usuario_id")
);

-- AddForeignKey
ALTER TABLE "posicoes_motorista" ADD CONSTRAINT "posicoes_motorista_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios_equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Escrito à mão. Coordenada fora da faixa do planeta é aparelho
-- com defeito ou requisição adulterada, não posição.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "posicoes_motorista"
  ADD CONSTRAINT "posicoes_motorista_coordenada_valida"
  CHECK (
    "latitude" BETWEEN -90 AND 90
    AND "longitude" BETWEEN -180 AND 180
    AND "precisao_metros" >= 0
  );

-- Mesma trava das outras tabelas: a API do PostgREST do Supabase não deve
-- servir posição de funcionário para quem tiver a chave pública.
ALTER TABLE "posicoes_motorista" ENABLE ROW LEVEL SECURITY;
