-- OCORRÊNCIA da cadência comercial (review PR #56).
--
-- A idempotência era por lead+política+passo, ou seja, ETERNA por lead: os `-24h`/`-2h` de
-- uma experimental já ocorrida marcavam os passos da experimental REAGENDADA como cumpridos,
-- e um segundo no-show do mesmo lead nascia com a cadência inteira "feita". A ocorrência é a
-- âncora em ISO (horário da aula, 1º inbound) — a identidade do CICLO.

ALTER TABLE "IntencaoMensagem" ADD COLUMN "ocorrenciaComercial" TEXT;

DROP INDEX IF EXISTS "IntencaoMensagem_politicaComercialId_leadId_passoComercial_key";

CREATE UNIQUE INDEX "IntencaoMensagem_polComercial_lead_ocorrencia_passo_key"
  ON "IntencaoMensagem" ("politicaComercialId", "leadId", "ocorrenciaComercial", "passoComercial");
