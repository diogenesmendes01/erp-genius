-- Correções da review do PR #60:
-- Cobranca.valorFaturado — snapshot do SALDO ABERTO levado à fatura B2B no fechamento
--   (mudanças posteriores na cobrança não alteram a composição do documento).
-- Comissao.aprovadaEm — timestamp da aprovação (ativação da matrícula): corte de
--   competência do fechamento mensal automático (o cron paga só o período já fechado).

ALTER TABLE "Cobranca" ADD COLUMN "valorFaturado" DECIMAL(12,2);
ALTER TABLE "Comissao" ADD COLUMN "aprovadaEm" TIMESTAMP(3);
