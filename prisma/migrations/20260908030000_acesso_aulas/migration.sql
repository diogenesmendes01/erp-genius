-- CreateEnum
CREATE TYPE "StatusSolicitacaoAcessoAulas" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- AlterTable
ALTER TABLE "Matricula" ADD COLUMN     "acessoBloqueioAutomatico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acessoBloqueioManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acessoVersao" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SolicitacaoAcessoAulas" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "bloquear" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "status" "StatusSolicitacaoAcessoAulas" NOT NULL DEFAULT 'PENDENTE',
    "versaoMatricula" INTEGER NOT NULL,
    "motivoDecisao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoEm" TIMESTAMP(3),

    CONSTRAINT "SolicitacaoAcessoAulas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitacaoAcessoAulas_matriculaId_status_idx" ON "SolicitacaoAcessoAulas"("matriculaId", "status");

-- AddForeignKey
ALTER TABLE "SolicitacaoAcessoAulas" ADD CONSTRAINT "SolicitacaoAcessoAulas_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoAcessoAulas" ADD CONSTRAINT "SolicitacaoAcessoAulas_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoAcessoAulas" ADD CONSTRAINT "SolicitacaoAcessoAulas_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bloqueios anteriores exigem revisão humana; quitação não os remove automaticamente.
UPDATE "Matricula" SET "acessoBloqueioManual" = true WHERE "acessoBloqueado" = true;
ALTER TABLE "SolicitacaoAcessoAulas" ADD CONSTRAINT "SolicitacaoAcessoAulas_aprovacao_independente_check"
CHECK ("aprovadorId" IS NULL OR "aprovadorId" <> "solicitanteId");
