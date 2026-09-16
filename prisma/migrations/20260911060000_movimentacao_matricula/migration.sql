-- Preserva os registros antigos sem presumir a contratação correspondente.
ALTER TABLE "MovimentacaoAluno" ADD COLUMN "matriculaId" TEXT;
CREATE INDEX "MovimentacaoAluno_matriculaId_alunoId_idx" ON "MovimentacaoAluno" ("matriculaId", "alunoId");
ALTER TABLE "MovimentacaoAluno" ADD CONSTRAINT "MovimentacaoAluno_matriculaId_alunoId_fkey"
  FOREIGN KEY ("matriculaId", "alunoId") REFERENCES "Matricula" ("id", "alunoId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
