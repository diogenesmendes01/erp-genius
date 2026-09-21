-- CreateEnum
CREATE TYPE "OpcaoRetomada" AS ENUM ('MANTER_VENCIMENTOS', 'REPROGRAMAR_PARCELAS');

-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN     "canceladaPorPausaId" TEXT;

-- CreateTable
CREATE TABLE "PropostaRetomada" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "pausaId" TEXT NOT NULL,
    "opcao" "OpcaoRetomada" NOT NULL,
    "status" "StatusAprovacao" NOT NULL DEFAULT 'PENDENTE',
    "motivo" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "snapshot" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoEm" TIMESTAMP(3),
    "motivoDecisao" TEXT,

    CONSTRAINT "PropostaRetomada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaRetomada_alunoId_criadoEm_idx" ON "PropostaRetomada"("alunoId", "criadoEm");

-- CreateIndex
CREATE INDEX "PropostaRetomada_status_criadoEm_idx" ON "PropostaRetomada"("status", "criadoEm");

-- AddForeignKey
ALTER TABLE "PropostaRetomada" ADD CONSTRAINT "PropostaRetomada_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaRetomada" ADD CONSTRAINT "PropostaRetomada_pausaId_fkey" FOREIGN KEY ("pausaId") REFERENCES "MovimentacaoAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaRetomada" ADD CONSTRAINT "PropostaRetomada_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaRetomada" ADD CONSTRAINT "PropostaRetomada_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_canceladaPorPausaId_fkey" FOREIGN KEY ("canceladaPorPausaId") REFERENCES "MovimentacaoAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Somente uma proposta em aberto por aluno; uma rejeição preserva o histórico.
CREATE UNIQUE INDEX "PropostaRetomada_aluno_pendente_key"
ON "PropostaRetomada" ("alunoId") WHERE "status" = 'PENDENTE';

ALTER TABLE "PropostaRetomada"
  ADD CONSTRAINT "PropostaRetomada_aprovacao_independente_check"
    CHECK ("aprovadorId" IS NULL OR "aprovadorId" <> "solicitanteId"),
  ADD CONSTRAINT "PropostaRetomada_decisao_coerente_check"
    CHECK (
      ("status" = 'PENDENTE' AND "aprovadorId" IS NULL AND "decididoEm" IS NULL AND "motivoDecisao" IS NULL)
      OR ("status" <> 'PENDENTE' AND "aprovadorId" IS NOT NULL AND "decididoEm" IS NOT NULL AND "motivoDecisao" IS NOT NULL AND length(trim("motivoDecisao")) >= 5)
    );

-- Pausa não cancela taxa, material ou parcelas de outras naturezas.
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_cancelamento_pausa_tipo_check"
CHECK ("canceladaPorPausaId" IS NULL OR "tipo" = 'MENSALIDADE');
