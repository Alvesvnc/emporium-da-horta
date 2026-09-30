/*
  Warnings:

  - You are about to drop the column `cliente_id` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the `clientes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `codigos_acesso` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_cliente_id_fkey";

-- DropIndex
DROP INDEX "pedidos_cliente_criado_em_idx";

-- AlterTable
ALTER TABLE "pedidos" DROP COLUMN "cliente_id";

-- DropTable
DROP TABLE "clientes";

-- DropTable
DROP TABLE "codigos_acesso";
