-- OCORRÊNCIA da cadência comercial (review PR #56), reconciliada com o índice PARCIAL do #55.
--
-- A idempotência era por lead+política+passo, ou seja, ETERNA por lead: os `-24h`/`-2h` de
-- uma experimental já ocorrida marcavam os passos da experimental REAGENDADA como cumpridos,
-- e um segundo no-show do mesmo lead nascia com a cadência inteira "feita". A ocorrência é a
-- âncora em ISO (horário da aula, 1º inbound) — a identidade do CICLO.
--
-- Esta migration parte do estado deixado pela 20260720170000: o índice PARCIAL de três
-- colunas `IntencaoMensagem_comercial_degrau_key` (WHERE as três colunas IS NOT NULL).
-- Adiciona a OCORRÊNCIA à chave preservando o índice PARCIAL — se apenas criássemos um
-- segundo índice de quatro colunas, o parcial antigo continuaria bloqueando o degrau homônimo
-- de um segundo ciclo (ignorando a ocorrência) e anularia esta correção. Por isso o índice é
-- recriado com o MESMO nome. O predicado segue mantendo COBRANÇA (colunas nulas) fora da
-- constraint; `ocorrenciaComercial` entra no predicado porque toda intenção comercial a
-- preenche (o enfileirador exige `ocorrenciaComercial: string`).

ALTER TABLE "IntencaoMensagem" ADD COLUMN "ocorrenciaComercial" TEXT;

DROP INDEX IF EXISTS "IntencaoMensagem_comercial_degrau_key";

CREATE UNIQUE INDEX "IntencaoMensagem_comercial_degrau_key"
  ON "IntencaoMensagem" ("politicaComercialId", "leadId", "ocorrenciaComercial", "passoComercial")
  WHERE "politicaComercialId" IS NOT NULL
    AND "leadId" IS NOT NULL
    AND "ocorrenciaComercial" IS NOT NULL
    AND "passoComercial" IS NOT NULL;
