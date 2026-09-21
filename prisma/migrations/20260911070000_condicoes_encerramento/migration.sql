CREATE TYPE "StatusCondicoesEncerramento" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');
CREATE TABLE "CondicoesEncerramentoMatricula" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "documentoId" TEXT NOT NULL REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "versao" INTEGER NOT NULL CHECK ("versao" > 0),
  "regras" JSONB NOT NULL,
  "motivo" TEXT NOT NULL,
  "status" "StatusCondicoesEncerramento" NOT NULL DEFAULT 'PENDENTE',
  "preparadorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "decisorId" TEXT REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "motivoDecisao" TEXT,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decididaEm" TIMESTAMP(3),
  CHECK ("decisorId" IS NULL OR "decisorId" <> "preparadorId"),
  CHECK (("status" = 'PENDENTE' AND "decisorId" IS NULL AND "decididaEm" IS NULL AND "motivoDecisao" IS NULL)
    OR ("status" <> 'PENDENTE' AND "decisorId" IS NOT NULL AND "decididaEm" IS NOT NULL AND "motivoDecisao" IS NOT NULL AND length(trim("motivoDecisao")) > 0))
);
CREATE UNIQUE INDEX "CondicoesEncerramentoMatricula_matriculaId_versao_key" ON "CondicoesEncerramentoMatricula"("matriculaId", "versao");
CREATE INDEX "CondicoesEncerramentoMatricula_matriculaId_status_idx" ON "CondicoesEncerramentoMatricula"("matriculaId", "status");
