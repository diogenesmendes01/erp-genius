CREATE TABLE "ConferenciaCumprimentoRecomposicao" (
  "id" TEXT PRIMARY KEY,
  "programacaoId" TEXT NOT NULL REFERENCES "DiaProgramadoRecomposicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "preparadorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "decisorId" TEXT REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" "StatusAprovacao" NOT NULL DEFAULT 'PENDENTE',
  "evidencia" TEXT NOT NULL CHECK (length(trim("evidencia")) >= 5),
  "motivo" TEXT NOT NULL CHECK (length(trim("motivo")) >= 5),
  "motivoDecisao" TEXT,
  "decididaEm" TIMESTAMP(3),
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("decisorId" IS NULL OR "decisorId" <> "preparadorId"),
  CHECK ((status = 'PENDENTE' AND "decisorId" IS NULL AND "decididaEm" IS NULL AND "motivoDecisao" IS NULL)
    OR (status <> 'PENDENTE' AND "decisorId" IS NOT NULL AND "decididaEm" IS NOT NULL AND length(trim("motivoDecisao")) >= 5 AND "motivoDecisao" IS NOT NULL))
);
CREATE UNIQUE INDEX "cumprimento_recomposicao_chave_key" ON "ConferenciaCumprimentoRecomposicao"("preparadorId", "chaveIdempotencia");
CREATE INDEX "ConferenciaCumprimentoRecomposicao_programacaoId_status_idx" ON "ConferenciaCumprimentoRecomposicao"("programacaoId", status);
CREATE UNIQUE INDEX "cumprimento_recomposicao_pendente_key" ON "ConferenciaCumprimentoRecomposicao"("programacaoId") WHERE status = 'PENDENTE';
