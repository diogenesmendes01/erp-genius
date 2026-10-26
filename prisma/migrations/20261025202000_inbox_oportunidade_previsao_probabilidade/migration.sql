-- D13: campos opcionais; registros existentes permanecem NULL, sem backfill.
ALTER TABLE "Lead"
  ADD COLUMN "probabilidadePct" INTEGER,
  ADD COLUMN "previsaoFechamento" TEXT;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_probabilidadePct_check"
  CHECK ("probabilidadePct" IS NULL OR ("probabilidadePct" >= 0 AND "probabilidadePct" <= 100));