-- Dinheiro: Float (double precision) → DECIMAL — fecha a pendência P19 (doc 15).
-- Float binário não representa centavos com exatidão; DECIMAL torna o banco a fonte
-- de verdade EXATA (somas SQL, reconciliação, auditoria). Escalas:
--   · valores monetários  → DECIMAL(12,2)  (até 9,99 bi — folga p/ PYG/COP)
--   · percentuais         → DECIMAL(5,2)
--   · câmbio unidadesPorUsd → DECIMAL(14,6) (CRC ~512.345678)
-- ROUND explícito no USING: valores Float com resíduo binário (99.99000000000001)
-- normalizam para o valor pretendido. `horasAula` permanece Float (duração, não dinheiro).

ALTER TABLE "Usuario"
  ALTER COLUMN "limiteDescontoPct" TYPE DECIMAL(5,2) USING ROUND("limiteDescontoPct"::numeric, 2);

ALTER TABLE "PrecoReferencia"
  ALTER COLUMN "valor" TYPE DECIMAL(12,2) USING ROUND("valor"::numeric, 2);

ALTER TABLE "Lead"
  ALTER COLUMN "valorPrevisto"    TYPE DECIMAL(12,2) USING ROUND("valorPrevisto"::numeric, 2),
  ALTER COLUMN "comissaoPrevista" TYPE DECIMAL(12,2) USING ROUND("comissaoPrevista"::numeric, 2);

ALTER TABLE "Cobranca"
  ALTER COLUMN "valorOriginal"  TYPE DECIMAL(12,2) USING ROUND("valorOriginal"::numeric, 2),
  ALTER COLUMN "valorNegociado" TYPE DECIMAL(12,2) USING ROUND("valorNegociado"::numeric, 2),
  ALTER COLUMN "valorRecebido"  TYPE DECIMAL(12,2) USING ROUND("valorRecebido"::numeric, 2),
  ALTER COLUMN "saldo"          TYPE DECIMAL(12,2) USING ROUND("saldo"::numeric, 2);

ALTER TABLE "Comissao"
  ALTER COLUMN "percentual" TYPE DECIMAL(5,2)  USING ROUND("percentual"::numeric, 2),
  ALTER COLUMN "valor"      TYPE DECIMAL(12,2) USING ROUND("valor"::numeric, 2);

ALTER TABLE "Aprovacao"
  ALTER COLUMN "impactoMensal" TYPE DECIMAL(12,2) USING ROUND("impactoMensal"::numeric, 2);

ALTER TABLE "AjusteFinanceiro"
  ALTER COLUMN "valorDe"       TYPE DECIMAL(12,2) USING ROUND("valorDe"::numeric, 2),
  ALTER COLUMN "valorPara"     TYPE DECIMAL(12,2) USING ROUND("valorPara"::numeric, 2),
  ALTER COLUMN "descontoValor" TYPE DECIMAL(12,2) USING ROUND("descontoValor"::numeric, 2),
  ALTER COLUMN "descontoPct"   TYPE DECIMAL(5,2)  USING ROUND("descontoPct"::numeric, 2);

ALTER TABLE "TaxaCambio"
  ALTER COLUMN "unidadesPorUsd" TYPE DECIMAL(14,6) USING ROUND("unidadesPorUsd"::numeric, 6);
