-- CreateEnum
CREATE TYPE "TipoTarefa" AS ENUM ('WHATSAPP', 'LIGACAO', 'EMAIL', 'REUNIAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('ABERTA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PrioridadeTarefa" AS ENUM ('NORMAL', 'ALTA');

-- CreateEnum
CREATE TYPE "OrigemTarefa" AS ENUM ('HUMANO', 'IA', 'IA_SUGERIDA', 'AUTOMACAO');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('LEMBRETE_TAREFA');

-- AlterTable
ALTER TABLE "IntencaoMensagem" ADD COLUMN     "agendadaPara" TIMESTAMP(3),
ADD COLUMN     "tarefaId" TEXT;

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoTarefa" NOT NULL,
    "setor" "FinalidadeAtendimentoWhatsApp" NOT NULL,
    "status" "StatusTarefa" NOT NULL DEFAULT 'ABERTA',
    "prioridade" "PrioridadeTarefa" NOT NULL DEFAULT 'NORMAL',
    "dataCivil" TEXT,
    "inicioEm" TIMESTAMPTZ,
    "duracaoMin" INTEGER NOT NULL DEFAULT 30,
    "fusoOrigem" TEXT NOT NULL,
    "lembreteAntecedenciaMin" INTEGER,
    "lembrarEm" TIMESTAMPTZ,
    "lembreteDisparadoEm" TIMESTAMPTZ,
    "responsavelId" TEXT,
    "criadorId" TEXT,
    "concluidaEm" TIMESTAMPTZ,
    "concluidaPorId" TEXT,
    "resultado" TEXT,
    "canceladaEm" TIMESTAMPTZ,
    "motivoCancelamento" TEXT,
    "leadId" TEXT,
    "pessoaId" TEXT,
    "alunoId" TEXT,
    "matriculaId" TEXT,
    "origem" "OrigemTarefa" NOT NULL DEFAULT 'HUMANO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacaoUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "refTipo" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "NotificacaoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tarefa_responsavelId_status_dataCivil_idx" ON "Tarefa"("responsavelId", "status", "dataCivil");

-- CreateIndex
CREATE INDEX "Tarefa_setor_status_responsavelId_idx" ON "Tarefa"("setor", "status", "responsavelId");

-- CreateIndex
CREATE INDEX "Tarefa_status_lembrarEm_idx" ON "Tarefa"("status", "lembrarEm");

-- CreateIndex
CREATE INDEX "Tarefa_leadId_status_idx" ON "Tarefa"("leadId", "status");

-- CreateIndex
CREATE INDEX "Tarefa_pessoaId_status_idx" ON "Tarefa"("pessoaId", "status");

-- CreateIndex
CREATE INDEX "NotificacaoUsuario_usuarioId_lidaEm_idx" ON "NotificacaoUsuario"("usuarioId", "lidaEm");

-- CreateIndex
CREATE UNIQUE INDEX "NotificacaoUsuario_tipo_refId_criadaEm_key" ON "NotificacaoUsuario"("tipo", "refId", "criadaEm");

-- CreateIndex
CREATE INDEX "IntencaoMensagem_status_agendadaPara_idx" ON "IntencaoMensagem"("status", "agendadaPara");

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_criadorId_fkey" FOREIGN KEY ("criadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_concluidaPorId_fkey" FOREIGN KEY ("concluidaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacaoUsuario" ADD CONSTRAINT "NotificacaoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tem horário só se tem data civil.
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_inicioEm_requer_dataCivil_check" CHECK ("inicioEm" IS NULL OR "dataCivil" IS NOT NULL);
