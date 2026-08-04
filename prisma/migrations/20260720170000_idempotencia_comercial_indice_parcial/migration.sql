-- Idempotência da cadência comercial: UNIQUE PARCIAL (review PR #55 P2).
--
-- A 20260720160000 já incluíra a POLÍTICA na chave, mas como um UNIQUE CHEIO em
-- (politicaComercialId, leadId, passoComercial). As intenções de COBRANÇA deixam essas
-- três colunas nulas; um UNIQUE cheio só não as bloqueia por conta da semântica de NULL
-- do Postgres (NULL nunca é igual a NULL). Trocamos por um UNIQUE PARCIAL — o padrão do
-- repo para unicidade condicional (cf. integridade_alocacao_preco: "UNIQUE ... WHERE") —
-- que restringe a constraint às intenções COMERCIAIS (as três colunas presentes) e deixa
-- COBRANÇA explicitamente fora do índice, sem depender da distinção de NULLs.
--
-- Migration em migration NOVA (a 160000 já foi aplicada; reescrevê-la quebraria o checksum).

DROP INDEX IF EXISTS "IntencaoMensagem_politicaComercialId_leadId_passoComercial_key";

CREATE UNIQUE INDEX "IntencaoMensagem_comercial_degrau_key"
  ON "IntencaoMensagem" ("politicaComercialId", "leadId", "passoComercial")
  WHERE "politicaComercialId" IS NOT NULL
    AND "leadId" IS NOT NULL
    AND "passoComercial" IS NOT NULL;
