-- CreateEnum
CREATE TYPE "StatusAtendimentoWhatsApp" AS ENUM ('ABERTO_SEM_RESPONSAVEL', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'ENCERRADO');

-- AlterTable
ALTER TABLE "AtendimentoWhatsApp" ADD COLUMN     "atendimentoOrigemId" TEXT,
ADD COLUMN     "prazoRespostaEm" TIMESTAMP(3),
ADD COLUMN     "primeiraRespostaEm" TIMESTAMP(3),
ADD COLUMN     "primeiroInboundEm" TIMESTAMP(3),
ADD COLUMN     "status" "StatusAtendimentoWhatsApp" NOT NULL DEFAULT 'ABERTO_SEM_RESPONSAVEL';

-- CreateTable
CREATE TABLE "PrazoRespostaSetor" (
    "finalidade" "FinalidadeAtendimentoWhatsApp" NOT NULL,
    "minutos" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrazoRespostaSetor_pkey" PRIMARY KEY ("finalidade")
);

-- CreateIndex
CREATE INDEX "AtendimentoWhatsApp_status_finalidade_idx" ON "AtendimentoWhatsApp"("status", "finalidade");

-- CreateIndex
CREATE INDEX "AtendimentoWhatsApp_atendimentoOrigemId_idx" ON "AtendimentoWhatsApp"("atendimentoOrigemId");

-- AddForeignKey
ALTER TABLE "AtendimentoWhatsApp" ADD CONSTRAINT "AtendimentoWhatsApp_atendimentoOrigemId_fkey" FOREIGN KEY ("atendimentoOrigemId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteAtendimentoWhatsApp" ADD CONSTRAINT "ParticipanteAtendimentoWhatsApp_concedenteId_fkey" FOREIGN KEY ("concedenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill do status a partir do estado atual (antes dos CHECKs).
UPDATE "AtendimentoWhatsApp" SET status = CASE
  WHEN "encerradoEm" IS NOT NULL THEN 'ENCERRADO'
  WHEN "responsavelId" IS NOT NULL THEN 'EM_ATENDIMENTO'
  ELSE 'ABERTO_SEM_RESPONSAVEL' END::"StatusAtendimentoWhatsApp";

-- CHECKs escritos à mão (o Prisma não os modela).
ALTER TABLE "AtendimentoWhatsApp" ADD CONSTRAINT "Atendimento_status_encerrado" CHECK ((status = 'ENCERRADO') = ("encerradoEm" IS NOT NULL));
ALTER TABLE "AtendimentoWhatsApp" ADD CONSTRAINT "Atendimento_origem_distinta" CHECK ("atendimentoOrigemId" IS NULL OR "atendimentoOrigemId" <> id);
ALTER TABLE "PrazoRespostaSetor" ADD CONSTRAINT "PrazoRespostaSetor_minutos_positivo" CHECK (minutos > 0);

-- Prazos provisórios por setor (Q3), em minutos.
INSERT INTO "PrazoRespostaSetor"(finalidade, minutos, "atualizadoEm") VALUES
  ('COMERCIAL', 15, CURRENT_TIMESTAMP),
  ('FINANCEIRO', 240, CURRENT_TIMESTAMP),
  ('SECRETARIA', 240, CURRENT_TIMESTAMP),
  ('PEDAGOGICO', 1440, CURRENT_TIMESTAMP);
