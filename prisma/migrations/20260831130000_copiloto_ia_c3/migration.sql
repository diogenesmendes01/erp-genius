-- C3 (doc 27): IA copiloto SÓ-LEITURA. Cada análise (lote) gera até uma sugestão por TIPO
-- (resumo executivo / temperatura / segmento / etapa manual); o vendedor decide uma a uma —
-- a decisão alimenta a métrica-gate (taxa de aceitação por tipo). A IA nunca envia mensagem.
-- Config: copiloto nasce DESLIGADO (regra de ouro do doc 27); gatilho de quietude ~10min.

CREATE TYPE "TipoSugestaoIA" AS ENUM ('RESUMO', 'TEMPERATURA', 'SEGMENTO', 'ETAPA');
CREATE TYPE "StatusSugestaoIA" AS ENUM ('PENDENTE', 'ACEITA', 'CORRIGIDA', 'DESCARTADA', 'EXPIRADA');
CREATE TYPE "GatilhoSugestaoIA" AS ENUM ('QUIETUDE', 'MUDANCA_ETAPA', 'SOB_DEMANDA');

CREATE TABLE "SugestaoIA" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "tipo" "TipoSugestaoIA" NOT NULL,
    "status" "StatusSugestaoIA" NOT NULL DEFAULT 'PENDENTE',
    "gatilho" "GatilhoSugestaoIA" NOT NULL,
    "payload" JSONB NOT NULL,
    "justificativa" TEXT,
    "modelo" TEXT NOT NULL,
    "ancoraInbound" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididaEm" TIMESTAMP(3),
    "decididaPorId" TEXT,

    CONSTRAINT "SugestaoIA_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SugestaoIA_leadId_status_idx" ON "SugestaoIA"("leadId", "status");
CREATE INDEX "SugestaoIA_status_criadoEm_idx" ON "SugestaoIA"("status", "criadoEm");

ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_decididaPorId_fkey"
  FOREIGN KEY ("decididaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConfigComercial"
  ADD COLUMN "copilotoAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "copilotoQuietudeMinutos" INTEGER NOT NULL DEFAULT 10;
