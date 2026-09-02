-- Correções da review do PR #60:
-- Cobranca.valorFaturado — snapshot do SALDO ABERTO levado à fatura B2B no fechamento
--   (mudanças posteriores na cobrança não alteram a composição do documento).
-- Comissao.aprovadaEm — timestamp da aprovação (ativação da matrícula): corte de
--   competência do fechamento mensal automático (o cron paga só o período já fechado).

ALTER TABLE "Cobranca" ADD COLUMN "valorFaturado" DECIMAL(12,2);
ALTER TABLE "Comissao" ADD COLUMN "aprovadaEm" TIMESTAMP(3);

-- BACKFILL (review PR #60, rodada 2): comissões já APROVADAS/PAGAS ganham o instante REAL
-- da aprovação — a ativação da matrícula (é quando a comissão é aprovada). `criadoEm` não
-- representa a competência: uma comissão criada em agosto e aprovada em setembro seria
-- paga um mês antes da hora pelo corte do fechamento automático.
UPDATE "Comissao" c
SET "aprovadaEm" = m."ativadaEm"
FROM "Matricula" m
WHERE c."matriculaId" = m."id"
  AND c."aprovadaEm" IS NULL
  AND c."status" IN ('APROVADA', 'PAGA')
  AND m."ativadaEm" IS NOT NULL;

-- Um certificado por aluno×nível (rodada 2): o pré-check da ação não segura duas
-- aprovações CONCORRENTES — o banco garante; a ação trata o conflito como idempotência.
CREATE UNIQUE INDEX "Certificado_alunoId_nivelId_key" ON "Certificado"("alunoId", "nivelId");

-- Defesa do cronograma (rodada 2): no máximo UMA cobrança VIVA por matrícula×tipo×
-- competência — dupla ativação concorrente não duplica mensalidades. Parcial de propósito:
-- reemissão após cancelamento (pausa/perdão) segue livre, e a taxa (competencia NULL) fica fora.
CREATE UNIQUE INDEX "Cobranca_matricula_tipo_competencia_viva"
  ON "Cobranca"("matriculaId", "tipo", "competencia")
  WHERE "status" <> 'CANCELADA' AND "competencia" IS NOT NULL;
