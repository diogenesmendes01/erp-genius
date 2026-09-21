CREATE TYPE "StatusMudancaAcademica" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'EXECUTADA', 'CANCELADA');

CREATE TABLE "SolicitacaoMudancaAcademica" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "alocacaoOrigemId" TEXT NOT NULL,
    "turmaOrigemId" TEXT NOT NULL,
    "turmaDestinoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "horarioCompativel" BOOLEAN NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" "StatusMudancaAcademica" NOT NULL DEFAULT 'PENDENTE',
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "motivoDecisao" TEXT,
    "justificativaDispensaParecer" TEXT,
    "decididoEm" TIMESTAMP(3),
    "executorId" TEXT,
    "motivoExecucao" TEXT,
    "executadoEm" TIMESTAMP(3),
    "canceladorId" TEXT,
    "motivoCancelamento" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "movimentacaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolicitacaoMudancaAcademica_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mudanca_academica_proposta_valida" CHECK (
      length(btrim("motivo")) >= 5 AND "horarioCompativel" = TRUE
      AND "turmaOrigemId" <> "turmaDestinoId" AND jsonb_typeof("snapshot") = 'object'
    ),
    CONSTRAINT "mudanca_academica_aprovacao_independente" CHECK ("aprovadorId" <> "solicitanteId"),
    CONSTRAINT "mudanca_academica_decisao_completa" CHECK (
      ("aprovadorId" IS NULL AND "motivoDecisao" IS NULL AND "decididoEm" IS NULL AND "justificativaDispensaParecer" IS NULL)
      OR ("aprovadorId" IS NOT NULL AND "motivoDecisao" IS NOT NULL AND length(btrim("motivoDecisao")) >= 5 AND "decididoEm" IS NOT NULL)
    ),
    CONSTRAINT "mudanca_academica_dispensa_justificada" CHECK ("justificativaDispensaParecer" IS NULL OR length(btrim("justificativaDispensaParecer")) >= 5),
    CONSTRAINT "mudanca_academica_estado_decisao" CHECK (
      ("status" = 'PENDENTE' AND "aprovadorId" IS NULL)
      OR ("status" IN ('APROVADA', 'REJEITADA', 'EXECUTADA') AND "aprovadorId" IS NOT NULL)
      OR "status" = 'CANCELADA'
    ),
    CONSTRAINT "mudanca_academica_execucao_completa" CHECK (
      ("status" = 'EXECUTADA' AND "executorId" IS NOT NULL AND "motivoExecucao" IS NOT NULL
        AND length(btrim("motivoExecucao")) >= 5 AND "executadoEm" IS NOT NULL AND "movimentacaoId" IS NOT NULL)
      OR ("status" <> 'EXECUTADA' AND "executorId" IS NULL AND "motivoExecucao" IS NULL AND "executadoEm" IS NULL AND "movimentacaoId" IS NULL)
    ),
    CONSTRAINT "mudanca_academica_cancelamento_completo" CHECK (
      ("status" = 'CANCELADA' AND "canceladorId" IS NOT NULL AND "motivoCancelamento" IS NOT NULL
        AND length(btrim("motivoCancelamento")) >= 5 AND "canceladoEm" IS NOT NULL)
      OR ("status" <> 'CANCELADA' AND "canceladorId" IS NULL AND "motivoCancelamento" IS NULL AND "canceladoEm" IS NULL)
    )
);

CREATE TABLE "ParecerMudancaAcademica" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParecerMudancaAcademica_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "parecer_academico_conteudo" CHECK (length(btrim("conteudo")) >= 5)
);

CREATE UNIQUE INDEX "SolicitacaoMudancaAcademica_movimentacaoId_key" ON "SolicitacaoMudancaAcademica"("movimentacaoId");
-- Prisma não representa unicidade parcial: aprovação continua aberta até execução ou cancelamento.
CREATE UNIQUE INDEX "mudanca_academica_uma_aberta_por_aluno" ON "SolicitacaoMudancaAcademica"("alunoId") WHERE "status" IN ('PENDENTE', 'APROVADA');
CREATE INDEX "SolicitacaoMudancaAcademica_alunoId_criadoEm_idx" ON "SolicitacaoMudancaAcademica"("alunoId", "criadoEm");
CREATE INDEX "SolicitacaoMudancaAcademica_status_criadoEm_idx" ON "SolicitacaoMudancaAcademica"("status", "criadoEm");
CREATE INDEX "SolicitacaoMudancaAcademica_turmaOrigemId_status_idx" ON "SolicitacaoMudancaAcademica"("turmaOrigemId", "status");
CREATE INDEX "ParecerMudancaAcademica_solicitacaoId_criadoEm_idx" ON "ParecerMudancaAcademica"("solicitacaoId", "criadoEm");

ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_alocacaoOrigemId_fkey" FOREIGN KEY ("alocacaoOrigemId") REFERENCES "AlocacaoTurma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_turmaOrigemId_fkey" FOREIGN KEY ("turmaOrigemId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_turmaDestinoId_fkey" FOREIGN KEY ("turmaDestinoId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_canceladorId_fkey" FOREIGN KEY ("canceladorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "MovimentacaoAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParecerMudancaAcademica" ADD CONSTRAINT "ParecerMudancaAcademica_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoMudancaAcademica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParecerMudancaAcademica" ADD CONSTRAINT "ParecerMudancaAcademica_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
