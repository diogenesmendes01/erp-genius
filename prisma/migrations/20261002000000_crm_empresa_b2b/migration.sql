-- CreateEnum
CREATE TYPE "PapelParticipante" AS ENUM ('DECISOR', 'INFLUENCIADOR', 'RH_OPERACIONAL', 'FINANCEIRO', 'USUARIO_FINAL', 'OUTRO');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "empresaId" TEXT;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "origemCanal" "OrigemCanal",
ADD COLUMN     "porte" TEXT,
ADD COLUMN     "segmentoMercado" TEXT,
ADD COLUMN     "site" TEXT;

-- CreateTable
CREATE TABLE "ParticipanteOportunidade" (
    "id" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "papel" "PapelParticipante" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipanteOportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipanteOportunidade_pessoaId_idx" ON "ParticipanteOportunidade"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteOportunidade_oportunidadeId_pessoaId_key" ON "ParticipanteOportunidade"("oportunidadeId", "pessoaId");

-- CreateIndex
CREATE INDEX "Lead_empresaId_idx" ON "Lead"("empresaId");

-- CreateIndex
CREATE INDEX "Empresa_origemCanal_idx" ON "Empresa"("origemCanal");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteOportunidade" ADD CONSTRAINT "ParticipanteOportunidade_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteOportunidade" ADD CONSTRAINT "ParticipanteOportunidade_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

