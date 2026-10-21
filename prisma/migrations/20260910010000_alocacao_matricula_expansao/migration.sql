-- B01, expansão sem inferir vínculos históricos ou liberar múltiplos contratos.
ALTER TABLE "AlocacaoTurma" ADD COLUMN "matriculaId" TEXT;

CREATE UNIQUE INDEX "Matricula_id_alunoId_key" ON "Matricula" ("id", "alunoId");
CREATE INDEX "AlocacaoTurma_matriculaId_alunoId_idx" ON "AlocacaoTurma" ("matriculaId", "alunoId");
ALTER TABLE "AlocacaoTurma" ADD CONSTRAINT "AlocacaoTurma_matriculaId_alunoId_fkey"
  FOREIGN KEY ("matriculaId", "alunoId") REFERENCES "Matricula" ("id", "alunoId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "AlocacaoTurma_matriculaId_ativa_key"
  ON "AlocacaoTurma" ("matriculaId") WHERE "ativa" AND "matriculaId" IS NOT NULL;

-- Manter AlocacaoTurma_alunoId_ativa_key até migrar todos os consumidores globais.
-- Não preencher null por proximidade de datas, nome ou primeira matrícula encontrada.
