CREATE TYPE "CanalAvisoAlteracaoAgenda" AS ENUM ('EMAIL','WHATSAPP');
CREATE TYPE "SituacaoAvisoAlteracaoAgenda" AS ENUM ('PREPARADO','ENVIADO','INCERTO','FALHOU');
CREATE TABLE "AvisoAlteracaoAgenda" (
 id TEXT NOT NULL, "mudancaId" TEXT NOT NULL, "turmaId" TEXT NOT NULL, "alunoId" TEXT NOT NULL,
 canal "CanalAvisoAlteracaoAgenda" NOT NULL, "contatoHash" TEXT NOT NULL,
 situacao "SituacaoAvisoAlteracaoAgenda" NOT NULL DEFAULT 'PREPARADO', chave TEXT NOT NULL,
 "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AvisoAlteracaoAgenda_pkey" PRIMARY KEY(id), CONSTRAINT "AvisoAlteracaoAgenda_chave_key" UNIQUE(chave),
 CONSTRAINT "AvisoAlteracaoAgenda_mudanca_aluno_canal_key" UNIQUE("mudancaId","alunoId",canal),
 CONSTRAINT "AvisoAlteracaoAgenda_alunoId_fkey" FOREIGN KEY("alunoId") REFERENCES "Aluno"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AvisoAlteracaoAgenda_situacao_criada_idx" ON "AvisoAlteracaoAgenda"(situacao,"criadoEm");
CREATE INDEX "AvisoAlteracaoAgenda_turma_aluno_idx" ON "AvisoAlteracaoAgenda"("turmaId","alunoId");