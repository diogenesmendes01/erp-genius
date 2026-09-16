-- CreateEnum
CREATE TYPE "StatusCorrecaoCadastro" AS ENUM ('PENDENTE', 'CONCLUIDA', 'REJEITADA');

-- AlterTable
ALTER TABLE "PagamentoInformado" ADD COLUMN     "hashDados" TEXT;

-- AlterTable
ALTER TABLE "Recebimento" ADD COLUMN     "hashDados" TEXT;

-- AlterTable
ALTER TABLE "AlocacaoTurma" ADD COLUMN     "encerradaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VinculoDocente" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),

    CONSTRAINT "VinculoDocente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AulaDiario" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "ocorridaEm" TIMESTAMP(3) NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AulaDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAulaAluno" (
    "id" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "nomeAluno" TEXT NOT NULL,
    "presente" BOOLEAN,
    "observacao" TEXT,

    CONSTRAINT "RegistroAulaAluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoCorrecaoCadastro" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorProposto" TEXT,
    "motivo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "status" "StatusCorrecaoCadastro" NOT NULL DEFAULT 'PENDENTE',
    "motivoResolucao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidaEm" TIMESTAMP(3),

    CONSTRAINT "SolicitacaoCorrecaoCadastro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VinculoDocente_turmaId_professorId_inicio_idx" ON "VinculoDocente"("turmaId", "professorId", "inicio");

-- CreateIndex
CREATE INDEX "AulaDiario_professorId_ocorridaEm_idx" ON "AulaDiario"("professorId", "ocorridaEm");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAulaAluno_aulaId_alunoId_key" ON "RegistroAulaAluno"("aulaId", "alunoId");

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecaoCadastro_matriculaId_status_idx" ON "SolicitacaoCorrecaoCadastro"("matriculaId", "status");

-- AddForeignKey
ALTER TABLE "VinculoDocente" ADD CONSTRAINT "VinculoDocente_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoDocente" ADD CONSTRAINT "VinculoDocente_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaDiario" ADD CONSTRAINT "AulaDiario_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaDiario" ADD CONSTRAINT "AulaDiario_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAulaAluno" ADD CONSTRAINT "RegistroAulaAluno_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "AulaDiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAulaAluno" ADD CONSTRAINT "RegistroAulaAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCorrecaoCadastro" ADD CONSTRAINT "SolicitacaoCorrecaoCadastro_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Só conhecemos a atribuição vigente agora. Não inventar autoria de aulas passadas.
INSERT INTO "VinculoDocente" (id, "turmaId", "professorId", inicio)
SELECT 'migracao_docente_' || id, id, "professorId", CURRENT_TIMESTAMP
FROM "Turma" WHERE "professorId" IS NOT NULL;
ALTER TABLE "VinculoDocente" ADD CONSTRAINT "VinculoDocente_periodo" CHECK (fim IS NULL OR fim >= inicio);
CREATE UNIQUE INDEX "VinculoDocente_um_atual" ON "VinculoDocente" ("turmaId") WHERE fim IS NULL;
