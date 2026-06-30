-- Câmbio (Fase B): cotações manuais para CONSOLIDAÇÃO gerencial multi-moeda (reporting-only,
-- doc 04 §Câmbio). ADITIVO e seguro: cria uma tabela nova, não altera nenhuma coluna existente
-- nem toca dados de cobrança/comissão. Pivô = USD; `unidadesPorUsd` = unidades da moeda por 1 USD.
CREATE TABLE "TaxaCambio" (
    "id" TEXT NOT NULL,
    "moeda" TEXT NOT NULL,
    "unidadesPorUsd" DOUBLE PRECISION NOT NULL,
    "vigenteEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxaCambio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxaCambio_moeda_vigenteEm_idx" ON "TaxaCambio"("moeda", "vigenteEm");
