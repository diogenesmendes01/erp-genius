-- AlterTable
ALTER TABLE "NumeroWhatsApp" ADD COLUMN     "triagemResponsavelId" TEXT;

-- CreateTable
CREATE TABLE "NumeroSetorWhatsApp" (
    "id" TEXT NOT NULL,
    "numeroId" TEXT NOT NULL,
    "finalidade" "FinalidadeAtendimentoWhatsApp" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumeroSetorWhatsApp_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "NumeroSetorWhatsApp_numeroId_finalidade_key" ON "NumeroSetorWhatsApp"("numeroId", "finalidade");

-- AddForeignKey
ALTER TABLE "NumeroWhatsApp" ADD CONSTRAINT "NumeroWhatsApp_triagemResponsavelId_fkey" FOREIGN KEY ("triagemResponsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NumeroSetorWhatsApp" ADD CONSTRAINT "NumeroSetorWhatsApp_numeroId_fkey" FOREIGN KEY ("numeroId") REFERENCES "NumeroWhatsApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: números existentes passam a declarar o setor derivado da finalidade legada.
INSERT INTO "NumeroSetorWhatsApp"(id, "numeroId", finalidade)
SELECT gen_random_uuid()::text, id,
  CASE finalidade WHEN 'COBRANCA' THEN 'FINANCEIRO' ELSE 'COMERCIAL' END::"FinalidadeAtendimentoWhatsApp"
FROM "NumeroWhatsApp" WHERE finalidade IN ('COBRANCA','VENDAS');
