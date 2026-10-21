ALTER TABLE "AvisoAlteracaoAgenda" ADD COLUMN "eventoId" TEXT, ADD COLUMN "matriculaId" TEXT;
ALTER TABLE "AvisoAlteracaoAgenda" ALTER COLUMN "turmaId" DROP NOT NULL;
ALTER TABLE "AvisoAlteracaoAgenda" DROP CONSTRAINT "AvisoAlteracaoAgenda_mudanca_aluno_canal_key";
CREATE TABLE "ItemAvisoAlteracaoAgenda" (id TEXT PRIMARY KEY, "avisoId" TEXT NOT NULL REFERENCES "AvisoAlteracaoAgenda"(id) ON DELETE RESTRICT, "encontroId" TEXT NOT NULL REFERENCES "EncontroAgenda"(id) ON DELETE RESTRICT, UNIQUE("avisoId","encontroId"));
CREATE TABLE "TentativaAvisoAlteracaoAgenda" (id TEXT PRIMARY KEY, "avisoId" TEXT NOT NULL REFERENCES "AvisoAlteracaoAgenda"(id) ON DELETE RESTRICT, situacao "SituacaoAvisoAlteracaoAgenda" NOT NULL, "provedorId" TEXT, "criadaEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE "AvisoAlteracaoAgenda" ADD CONSTRAINT "AvisoAlteracaoAgenda_evento_fkey" FOREIGN KEY("eventoId") REFERENCES "Evento"(id) ON DELETE RESTRICT, ADD CONSTRAINT "AvisoAlteracaoAgenda_matricula_fkey" FOREIGN KEY("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX "AvisoAlteracaoAgenda_evento_matricula_canal_key" ON "AvisoAlteracaoAgenda"("eventoId","matriculaId",canal) WHERE "eventoId" IS NOT NULL AND "matriculaId" IS NOT NULL;
