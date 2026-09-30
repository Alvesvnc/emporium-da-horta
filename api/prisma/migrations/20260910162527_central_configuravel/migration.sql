-- AlterTable
ALTER TABLE "configuracoes" ADD COLUMN     "central_bairro" TEXT,
ADD COLUMN     "central_cep" TEXT,
ADD COLUMN     "central_latitude" DOUBLE PRECISION,
ADD COLUMN     "central_longitude" DOUBLE PRECISION,
ADD COLUMN     "central_nome" TEXT NOT NULL DEFAULT 'Central de Distribuição',
ADD COLUMN     "central_numero" TEXT,
ADD COLUMN     "central_rua" TEXT;

-- ─────────────────────────────────────────────────────────────
-- Escrito à mão. O Prisma não gera CHECK; estas regras existem
-- para o banco recusar sozinho um estado que não faz sentido.
-- ─────────────────────────────────────────────────────────────

-- Central com latitude e sem longitude (ou o contrário) não é ponto
-- nenhum: ou as duas existem, ou nenhuma existe.
ALTER TABLE "configuracoes"
  ADD CONSTRAINT "configuracoes_central_par_completo"
  CHECK (("central_latitude" IS NULL) = ("central_longitude" IS NULL));

-- Coordenada fora da faixa do planeta é digitação errada, não endereço.
ALTER TABLE "configuracoes"
  ADD CONSTRAINT "configuracoes_central_coordenada_valida"
  CHECK (
    ("central_latitude" IS NULL OR "central_latitude" BETWEEN -90 AND 90)
    AND ("central_longitude" IS NULL OR "central_longitude" BETWEEN -180 AND 180)
  );
