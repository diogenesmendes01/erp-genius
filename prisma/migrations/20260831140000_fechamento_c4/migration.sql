-- C4 (doc 27 §fechamento): réguas de contrato/link de pagamento + matrícula automática.
--
-- Matricula.contratoEnviadoEm — âncora da régua "contrato sem assinatura em 48h".
-- Cobranca.linkPagamento/linkEnviadoEm — link enviado ao cliente; âncora da régua
--   "link de pagamento sem pagamento" (a Fase 2 gera o link pelo gateway; aqui pode
--   ser registrado manualmente).
-- ConfigComercial.matriculaAutomaticaAtiva — contrato OK + taxa PAGA ativam a matrícula
--   AGUARDANDO sem clique (nasce DESLIGADA — regra de ouro do doc 27). A turma segue
--   híbrida: o sistema SUGERE (evento TurmaSugerida), o consultor confirma.

ALTER TABLE "Matricula" ADD COLUMN "contratoEnviadoEm" TIMESTAMP(3);

ALTER TABLE "Cobranca"
  ADD COLUMN "linkPagamento" TEXT,
  ADD COLUMN "linkEnviadoEm" TIMESTAMP(3);

ALTER TABLE "ConfigComercial" ADD COLUMN "matriculaAutomaticaAtiva" BOOLEAN NOT NULL DEFAULT false;
