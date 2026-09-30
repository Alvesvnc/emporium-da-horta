-- CreateEnum
CREATE TYPE "motivo_nao_entrega" AS ENUM ('ausente', 'endereco_nao_encontrado', 'recusado', 'outro');

-- AlterEnum
ALTER TYPE "status_pedido" ADD VALUE 'nao_entregue';

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "motivo_nao_entrega" "motivo_nao_entrega",
ADD COLUMN     "observacao_entrega" TEXT,
ADD COLUMN     "tentado_em" TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- Escrito à mão. "Não entregue" sem motivo e sem hora é um beco:
-- ninguém depois consegue dizer o que houve nem quando.
--
-- A comparação é feita em texto (`::text`) de propósito. O Postgres
-- proíbe USAR um valor de enum recém-criado na mesma transação em
-- que ele foi adicionado — e 'nao_entregue' nasceu logo acima.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "pedidos"
  ADD CONSTRAINT "pedidos_nao_entregue_tem_motivo"
  CHECK (
    "status"::text <> 'nao_entregue'
    OR ("motivo_nao_entrega" IS NOT NULL AND "tentado_em" IS NOT NULL)
  );
