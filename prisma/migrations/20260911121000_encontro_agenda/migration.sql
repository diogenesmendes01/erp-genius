CREATE TYPE "StatusEncontroAgenda" AS ENUM ('RASCUNHO', 'PREVISTO', 'MINISTRADO', 'CANCELADO');
CREATE TABLE "EncontroAgenda" (
 "id" TEXT PRIMARY KEY,
 "turmaId" TEXT REFERENCES "Turma"("id") ON DELETE RESTRICT,
 "matriculaId" TEXT REFERENCES "Matricula"("id") ON DELETE RESTRICT,
 "professorId" TEXT REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "preparadorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "inicio" TIMESTAMP(3) NOT NULL,
 "fim" TIMESTAMP(3) NOT NULL,
 "fusoOrigem" TEXT NOT NULL,
 "status" "StatusEncontroAgenda" NOT NULL DEFAULT 'RASCUNHO',
 "motivo" TEXT NOT NULL CHECK (length(trim("motivo")) >= 5),
 "chaveIdempotencia" TEXT NOT NULL,
 "entradaHash" TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (("turmaId" IS NOT NULL) <> ("matriculaId" IS NOT NULL)),
 CHECK ("fim" > "inicio"),
 CHECK (status = 'RASCUNHO' OR "professorId" IS NOT NULL)
);
CREATE UNIQUE INDEX "encontro_agenda_chave_key" ON "EncontroAgenda"("preparadorId", "chaveIdempotencia");
CREATE INDEX "EncontroAgenda_professorId_inicio_fim_idx" ON "EncontroAgenda"("professorId", "inicio", "fim");
CREATE INDEX "EncontroAgenda_turmaId_inicio_idx" ON "EncontroAgenda"("turmaId", "inicio");
CREATE INDEX "EncontroAgenda_matriculaId_inicio_idx" ON "EncontroAgenda"("matriculaId", "inicio");
