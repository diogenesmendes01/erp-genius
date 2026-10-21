CREATE TYPE "StatusPropostaRetomadaMatriculas" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'APLICADA');
CREATE TABLE "PropostaRetomadaMatriculas" (
  "id" TEXT PRIMARY KEY, "alunoId" TEXT NOT NULL, "solicitanteId" TEXT NOT NULL, "decisorId" TEXT,
  "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, "estadoHash" TEXT NOT NULL,
  "motivo" TEXT NOT NULL, "entrada" JSONB NOT NULL, "snapshot" JSONB NOT NULL,
  "status" "StatusPropostaRetomadaMatriculas" NOT NULL DEFAULT 'PENDENTE',
  "motivoDecisao" TEXT, "decididoEm" TIMESTAMP(3), "aplicadaEm" TIMESTAMP(3), "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropostaRetomadaMatriculas_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropostaRetomadaMatriculas_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropostaRetomadaMatriculas_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropostaRetomadaMatriculas_decisao_independente" CHECK ("decisorId" IS NULL OR "decisorId" <> "solicitanteId")
);
CREATE UNIQUE INDEX "PropostaRetomadaMatriculas_solicitanteId_chaveIdempotencia_key" ON "PropostaRetomadaMatriculas"("solicitanteId", "chaveIdempotencia");
CREATE UNIQUE INDEX "PropostaRetomadaMatriculas_id_alunoId_key" ON "PropostaRetomadaMatriculas"("id", "alunoId");
CREATE INDEX "PropostaRetomadaMatriculas_alunoId_status_idx" ON "PropostaRetomadaMatriculas"("alunoId", "status");
CREATE TABLE "ItemPropostaRetomadaMatriculas" (
  "id" TEXT PRIMARY KEY, "propostaId" TEXT NOT NULL, "matriculaId" TEXT NOT NULL, "alunoId" TEXT NOT NULL,
  CONSTRAINT "ItemPropostaRetomadaMatriculas_propostaId_alunoId_fkey" FOREIGN KEY ("propostaId", "alunoId") REFERENCES "PropostaRetomadaMatriculas"("id", "alunoId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ItemPropostaRetomadaMatriculas_matriculaId_alunoId_fkey" FOREIGN KEY ("matriculaId", "alunoId") REFERENCES "Matricula"("id", "alunoId") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "ItemPropostaRetomadaMatriculas_propostaId_matriculaId_key" ON "ItemPropostaRetomadaMatriculas"("propostaId", "matriculaId");
CREATE INDEX "ItemPropostaRetomadaMatriculas_matriculaId_idx" ON "ItemPropostaRetomadaMatriculas"("matriculaId");

