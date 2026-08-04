-- Idempotência da cadência comercial passa a incluir a POLÍTICA (review PR #55).
--
-- "Um motor, N políticas" (doc 29 regra 1) só se sustenta se cadências distintas puderem
-- compartilhar nomes de passo para o MESMO lead: +30min, +3d e +7d aparecem tanto na régua
-- de lead novo quanto na de no-show. Com a chave antiga ([leadId, passoComercial]) o degrau
-- de uma cadência bloqueava o degrau homônimo da outra.
--
-- Migration em migration NOVA (a anterior já foi aplicada; reescrevê-la quebraria o checksum).

DROP INDEX IF EXISTS "IntencaoMensagem_leadId_passoComercial_key";

CREATE UNIQUE INDEX "IntencaoMensagem_politicaComercialId_leadId_passoComercial_key"
  ON "IntencaoMensagem" ("politicaComercialId", "leadId", "passoComercial");
