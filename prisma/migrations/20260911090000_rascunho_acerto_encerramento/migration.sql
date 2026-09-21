CREATE TABLE "RascunhoAcertoEncerramento" (
  "id" TEXT PRIMARY KEY,
  "solicitacaoId" TEXT NOT NULL REFERENCES "SolicitacaoEncerramentoMatriculas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "preparadorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "versao" INTEGER NOT NULL CHECK ("versao" > 0),
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "entrada" JSONB NOT NULL,
  "snapshot" JSONB NOT NULL,
  "motivo" TEXT NOT NULL CHECK (length(trim("motivo")) >= 5),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "rascunho_encerramento_versao_key" ON "RascunhoAcertoEncerramento"("solicitacaoId", "versao");
CREATE UNIQUE INDEX "rascunho_encerramento_idempotencia_key" ON "RascunhoAcertoEncerramento"("preparadorId", "chaveIdempotencia");
