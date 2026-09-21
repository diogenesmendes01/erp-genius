CREATE TYPE "StatusSolicitacaoEncerramento" AS ENUM ('ABERTA', 'EM_ACERTO', 'CONCLUIDA', 'CANCELADA');
CREATE TABLE "SolicitacaoEncerramentoMatriculas" (
  "id" TEXT PRIMARY KEY,
  "alunoId" TEXT NOT NULL REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "registradorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "evidenciaPedido" TEXT NOT NULL,
  "dataPedido" DATE NOT NULL,
  "dataSolicitada" DATE NOT NULL,
  "fusoRegistro" TEXT NOT NULL,
  "motivoRetroatividade" TEXT,
  "evidenciaRetroatividade" TEXT,
  "status" "StatusSolicitacaoEncerramento" NOT NULL DEFAULT 'ABERTA',
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "encerramento_retroatividade_documentada" CHECK (
    "dataSolicitada" >= "dataPedido" OR
    ("motivoRetroatividade" IS NOT NULL AND length(trim("motivoRetroatividade")) >= 5
     AND "evidenciaRetroatividade" IS NOT NULL AND length(trim("evidenciaRetroatividade")) >= 5)
  )
);
CREATE UNIQUE INDEX "SolicitacaoEncerramentoMatriculas_registradorId_chaveIdempotenc_key" ON "SolicitacaoEncerramentoMatriculas"("registradorId", "chaveIdempotencia");
CREATE UNIQUE INDEX "SolicitacaoEncerramentoMatriculas_id_alunoId_key" ON "SolicitacaoEncerramentoMatriculas"("id", "alunoId");
CREATE INDEX "SolicitacaoEncerramentoMatriculas_alunoId_criadoEm_idx" ON "SolicitacaoEncerramentoMatriculas"("alunoId", "criadoEm");
CREATE TABLE "ItemSolicitacaoEncerramento" (
  "id" TEXT PRIMARY KEY,
  "solicitacaoId" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  FOREIGN KEY ("solicitacaoId", "alunoId") REFERENCES "SolicitacaoEncerramentoMatriculas"("id", "alunoId") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("matriculaId", "alunoId") REFERENCES "Matricula"("id", "alunoId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ItemSolicitacaoEncerramento_solicitacaoId_matriculaId_key" ON "ItemSolicitacaoEncerramento"("solicitacaoId", "matriculaId");
CREATE INDEX "ItemSolicitacaoEncerramento_matriculaId_idx" ON "ItemSolicitacaoEncerramento"("matriculaId");
