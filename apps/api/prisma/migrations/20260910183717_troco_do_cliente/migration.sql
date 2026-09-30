-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "paga_com_centavos" INTEGER;

-- ─────────────────────────────────────────────────────────────
-- Escrito à mão. "Paga com" só faz sentido em dinheiro, e nunca
-- pode ser menor que o total — seria um troco negativo, ou seja,
-- o cliente devendo na porta de casa.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "pedidos"
  ADD CONSTRAINT "pedidos_paga_com_coerente"
  CHECK (
    "paga_com_centavos" IS NULL
    OR (
      "forma_pagamento" = 'dinheiro'
      AND "paga_com_centavos" >= "total_centavos"
    )
  );
