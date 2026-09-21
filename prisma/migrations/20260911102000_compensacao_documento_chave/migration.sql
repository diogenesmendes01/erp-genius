ALTER TABLE "CompensacaoCoberturaMatricula"
 ADD COLUMN "documentoOrigemId" TEXT,
 ADD COLUMN "chaveIdempotencia" TEXT,
 ADD COLUMN "entradaHash" TEXT,
 ADD CONSTRAINT "CompensacaoCoberturaMatricula_documentoOrigemId_fkey" FOREIGN KEY ("documentoOrigemId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "compensacao_preparador_chave_key" ON "CompensacaoCoberturaMatricula"("preparadorId", "chaveIdempotencia");
