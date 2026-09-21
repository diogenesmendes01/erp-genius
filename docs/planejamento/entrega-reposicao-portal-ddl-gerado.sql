-- CreateEnum
CREATE TYPE "ProvedorMaterialReposicao" AS ENUM ('GOOGLE_DRIVE');

-- CreateEnum
CREATE TYPE "SituacaoCorrecaoEntregaReposicao" AS ENUM ('PENDENTE', 'RESPONDIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SituacaoRelatoMaterialReposicao" AS ENUM ('ABERTO', 'CONFIRMADO', 'DESCARTADO');

-- AlterTable
ALTER TABLE "ConfiguracaoOperacional" ADD COLUMN     "prazoPrimeiraEntregaReposicaoMinutos" INTEGER,
ADD COLUMN     "prazoRespostaCorrecaoReposicaoMinutos" INTEGER;

-- AlterTable
ALTER TABLE "EntregaReposicaoGravacao" ADD COLUMN     "contaPortalAlunoId" TEXT,
ADD COLUMN     "solicitacaoCorrecaoId" TEXT;

-- CreateTable
CREATE TABLE "MaterialReposicaoGravacao" (
    "id" TEXT NOT NULL,
    "reposicaoId" TEXT NOT NULL,
    "provedor" "ProvedorMaterialReposicao" NOT NULL,
    "arquivoOficialId" TEXT NOT NULL,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "publicadoPorId" TEXT NOT NULL,
    "publicadoEm" TIMESTAMP(3) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialReposicaoGravacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisponibilizacaoEntregaReposicao" (
    "id" TEXT NOT NULL,
    "reposicaoId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "disponibilizadaEm" TIMESTAMP(3) NOT NULL,
    "prazoBaseMinutos" INTEGER NOT NULL,
    "prazoInicialAte" TIMESTAMP(3) NOT NULL,
    "publicadaPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisponibilizacaoEntregaReposicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatoIndisponibilidadeMaterialReposicao" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "contaPortalAlunoId" TEXT,
    "relatadoPorId" TEXT,
    "descricao" TEXT NOT NULL,
    "situacao" "SituacaoRelatoMaterialReposicao" NOT NULL DEFAULT 'ABERTO',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmadoEm" TIMESTAMP(3),

    CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndisponibilidadeMaterialReposicao" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "relatoId" TEXT NOT NULL,
    "confirmadaPorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndisponibilidadeMaterialReposicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoCorrecaoEntregaReposicao" (
    "id" TEXT NOT NULL,
    "reposicaoId" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "solicitadaPorId" TEXT NOT NULL,
    "comentario" TEXT NOT NULL,
    "prazoBaseMinutos" INTEGER NOT NULL,
    "prazoAte" TIMESTAMP(3) NOT NULL,
    "situacao" "SituacaoCorrecaoEntregaReposicao" NOT NULL DEFAULT 'PENDENTE',
    "respondidaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProrrogacaoPrazoReposicao" (
    "id" TEXT NOT NULL,
    "reposicaoId" TEXT NOT NULL,
    "solicitacaoCorrecaoId" TEXT,
    "versao" INTEGER NOT NULL,
    "prazoAnterior" TIMESTAMP(3) NOT NULL,
    "novoPrazo" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorizadaPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProrrogacaoPrazoReposicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiberacaoEntregaReposicao" (
    "id" TEXT NOT NULL,
    "reposicaoId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorizadaPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiberacaoEntregaReposicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReposicaoGravacao_reposicaoId_key" ON "MaterialReposicaoGravacao"("reposicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "DisponibilizacaoEntregaReposicao_reposicaoId_key" ON "DisponibilizacaoEntregaReposicao"("reposicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "DisponibilizacaoEntregaReposicao_materialId_key" ON "DisponibilizacaoEntregaReposicao"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "IndisponibilidadeMaterialReposicao_relatoId_key" ON "IndisponibilidadeMaterialReposicao"("relatoId");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitacaoCorrecaoEntregaReposicao_entregaId_key" ON "SolicitacaoCorrecaoEntregaReposicao"("entregaId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaReposicaoGravacao_solicitacaoCorrecaoId_key" ON "EntregaReposicaoGravacao"("solicitacaoCorrecaoId");

-- AddForeignKey
ALTER TABLE "MaterialReposicaoGravacao" ADD CONSTRAINT "MaterialReposicaoGravacao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MaterialReposicaoGravacao" ADD CONSTRAINT "MaterialReposicaoGravacao_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DisponibilizacaoEntregaReposicao" ADD CONSTRAINT "DisponibilizacaoEntregaReposicao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DisponibilizacaoEntregaReposicao" ADD CONSTRAINT "DisponibilizacaoEntregaReposicao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DisponibilizacaoEntregaReposicao" ADD CONSTRAINT "DisponibilizacaoEntregaReposicao_publicadaPorId_fkey" FOREIGN KEY ("publicadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RelatoIndisponibilidadeMaterialReposicao" ADD CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RelatoIndisponibilidadeMaterialReposicao" ADD CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_contaPortalAlunoI_fkey" FOREIGN KEY ("contaPortalAlunoId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RelatoIndisponibilidadeMaterialReposicao" ADD CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_relatadoPorId_fkey" FOREIGN KEY ("relatadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "IndisponibilidadeMaterialReposicao" ADD CONSTRAINT "IndisponibilidadeMaterialReposicao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "IndisponibilidadeMaterialReposicao" ADD CONSTRAINT "IndisponibilidadeMaterialReposicao_relatoId_fkey" FOREIGN KEY ("relatoId") REFERENCES "RelatoIndisponibilidadeMaterialReposicao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "IndisponibilidadeMaterialReposicao" ADD CONSTRAINT "IndisponibilidadeMaterialReposicao_confirmadaPorId_fkey" FOREIGN KEY ("confirmadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SolicitacaoCorrecaoEntregaReposicao" ADD CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SolicitacaoCorrecaoEntregaReposicao" ADD CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "EntregaReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SolicitacaoCorrecaoEntregaReposicao" ADD CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProrrogacaoPrazoReposicao" ADD CONSTRAINT "ProrrogacaoPrazoReposicao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProrrogacaoPrazoReposicao" ADD CONSTRAINT "ProrrogacaoPrazoReposicao_solicitacaoCorrecaoId_fkey" FOREIGN KEY ("solicitacaoCorrecaoId") REFERENCES "SolicitacaoCorrecaoEntregaReposicao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProrrogacaoPrazoReposicao" ADD CONSTRAINT "ProrrogacaoPrazoReposicao_autorizadaPorId_fkey" FOREIGN KEY ("autorizadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LiberacaoEntregaReposicao" ADD CONSTRAINT "LiberacaoEntregaReposicao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LiberacaoEntregaReposicao" ADD CONSTRAINT "LiberacaoEntregaReposicao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LiberacaoEntregaReposicao" ADD CONSTRAINT "LiberacaoEntregaReposicao_autorizadaPorId_fkey" FOREIGN KEY ("autorizadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EntregaReposicaoGravacao" ADD CONSTRAINT "EntregaReposicaoGravacao_contaPortalAlunoId_fkey" FOREIGN KEY ("contaPortalAlunoId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EntregaReposicaoGravacao" ADD CONSTRAINT "EntregaReposicaoGravacao_solicitacaoCorrecaoId_fkey" FOREIGN KEY ("solicitacaoCorrecaoId") REFERENCES "SolicitacaoCorrecaoEntregaReposicao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
