ALTER TYPE "StatusMatricula" ADD VALUE 'PAUSADA';
ALTER TABLE "PropostaPausaMatriculas" ADD COLUMN "aplicadaEm" TIMESTAMP(3);
ALTER TABLE "Cobranca" ADD COLUMN "suspensaPorItemPausaId" TEXT;
CREATE UNIQUE INDEX "ItemPropostaPausa_id_matriculaId_key" ON "ItemPropostaPausa"("id", "matriculaId");
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_suspensaPorItemPausaId_matriculaId_fkey"
  FOREIGN KEY ("suspensaPorItemPausaId", "matriculaId") REFERENCES "ItemPropostaPausa"("id", "matriculaId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_origem_pausa_unica_check"
  CHECK ("suspensaPorItemPausaId" IS NULL OR ("canceladaPorPausaId" IS NULL AND "tipo" = 'MENSALIDADE'));
