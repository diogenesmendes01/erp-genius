CREATE TYPE "StatusPropostaPausaMatriculas" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'APLICADA');
CREATE TABLE "PropostaPausaMatriculas" (
  "id" TEXT PRIMARY KEY, "alunoId" TEXT NOT NULL, "solicitanteId" TEXT NOT NULL, "decisorId" TEXT,
  "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, "estadoHash" TEXT NOT NULL,
  "motivo" TEXT NOT NULL, "dataEfetiva" DATE NOT NULL, "snapshot" JSONB NOT NULL,
  "status" "StatusPropostaPausaMatriculas" NOT NULL DEFAULT 'PENDENTE',
  "motivoDecisao" TEXT, "decididoEm" TIMESTAMP(3), "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropostaPausaMatriculas_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropostaPausaMatriculas_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropostaPausaMatriculas_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropostaPausaMatriculas_decisao_independente" CHECK ("decisorId" IS NULL OR "decisorId" <> "solicitanteId")
);
CREATE UNIQUE INDEX "PropostaPausaMatriculas_solicitanteId_chaveIdempotencia_key" ON "PropostaPausaMatriculas"("solicitanteId", "chaveIdempotencia");
CREATE UNIQUE INDEX "PropostaPausaMatriculas_id_alunoId_key" ON "PropostaPausaMatriculas"("id", "alunoId");
CREATE INDEX "PropostaPausaMatriculas_alunoId_status_idx" ON "PropostaPausaMatriculas"("alunoId", "status");
CREATE TABLE "ItemPropostaPausa" (
  "id" TEXT PRIMARY KEY, "propostaId" TEXT NOT NULL, "matriculaId" TEXT NOT NULL, "alunoId" TEXT NOT NULL,
  CONSTRAINT "ItemPropostaPausa_propostaId_alunoId_fkey" FOREIGN KEY ("propostaId", "alunoId") REFERENCES "PropostaPausaMatriculas"("id", "alunoId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ItemPropostaPausa_matriculaId_alunoId_fkey" FOREIGN KEY ("matriculaId", "alunoId") REFERENCES "Matricula"("id", "alunoId") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "ItemPropostaPausa_propostaId_matriculaId_key" ON "ItemPropostaPausa"("propostaId", "matriculaId");
CREATE INDEX "ItemPropostaPausa_matriculaId_idx" ON "ItemPropostaPausa"("matriculaId");
