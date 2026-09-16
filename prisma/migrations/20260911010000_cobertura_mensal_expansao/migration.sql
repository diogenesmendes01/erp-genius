CREATE TYPE "ReferenciaCoberturaMensal" AS ENUM ('MES_CIVIL', 'CICLO_MATRICULA');
ALTER TABLE "Matricula" ADD COLUMN "referenciaCobertura" "ReferenciaCoberturaMensal", ADD COLUMN "dataReferenciaCobertura" DATE;
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_referencia_cobertura_check" CHECK (
  ("referenciaCobertura" IS NULL AND "dataReferenciaCobertura" IS NULL)
  OR ("referenciaCobertura" IS NOT NULL AND "referenciaCobertura" = 'MES_CIVIL' AND "dataReferenciaCobertura" IS NULL)
  OR ("referenciaCobertura" IS NOT NULL AND "referenciaCobertura" = 'CICLO_MATRICULA' AND "dataReferenciaCobertura" IS NOT NULL)
);
ALTER TABLE "Cobranca" ADD COLUMN "coberturaInicio" DATE, ADD COLUMN "coberturaFim" DATE;
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_cobertura_check" CHECK (
  ("coberturaInicio" IS NULL AND "coberturaFim" IS NULL)
  OR ("coberturaInicio" IS NOT NULL AND "coberturaFim" IS NOT NULL AND "coberturaFim" >= "coberturaInicio" AND "tipo" = 'MENSALIDADE')
);
-- Não inferir cobertura histórica a partir de competência ou vencimento.
