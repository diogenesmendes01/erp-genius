-- DropIndex
DROP INDEX "IntencaoMensagem_cobrancaId_passo_key";

-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN     "cicloRegua" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "IntencaoMensagem" ADD COLUMN     "cicloCobranca" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "IntencaoMensagem_cobrancaId_passo_cicloCobranca_key" ON "IntencaoMensagem"("cobrancaId", "passo", "cicloCobranca");

ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_cicloRegua_check" CHECK ("cicloRegua" >= 0);
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_cicloCobranca_check" CHECK ("cicloCobranca" >= 0);
