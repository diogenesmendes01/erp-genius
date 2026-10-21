-- D11 (decisão do dono, 20/10/2026): previsão de pagamento da comissão = dia X do mês seguinte à competência,
-- no fuso da escola. X configurável pelo financeiro; padrão 10, de 1 a 28 (todo mês tem o dia).
ALTER TABLE "ConfigFinanceiro" ADD COLUMN "diaPrevisaoPagamentoComissao" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "ConfigFinanceiro" ADD CONSTRAINT "ConfigFinanceiro_diaPrevisaoPagamentoComissao_check"
  CHECK ("diaPrevisaoPagamentoComissao" BETWEEN 1 AND 28);
