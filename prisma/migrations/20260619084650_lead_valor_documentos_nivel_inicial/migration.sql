-- CreateEnum
CREATE TYPE "CategoriaDocumento" AS ENUM ('PROPOSTA', 'CONTRATO', 'COMPROVANTE', 'TESTE_NIVEL', 'OUTRO');

-- CreateEnum
CREATE TYPE "OrigemNivel" AS ENUM ('AVALIACAO', 'MANUAL');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "comissaoPrevista" DOUBLE PRECISION,
ADD COLUMN     "planoPrevisto" TEXT,
ADD COLUMN     "valorPrevisto" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Matricula" ADD COLUMN     "dataAvaliacaoNivel" TIMESTAMP(3),
ADD COLUMN     "nivelInicialId" TEXT,
ADD COLUMN     "origemNivel" "OrigemNivel";

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "categoria" "CategoriaDocumento" NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Documento_leadId_idx" ON "Documento"("leadId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

