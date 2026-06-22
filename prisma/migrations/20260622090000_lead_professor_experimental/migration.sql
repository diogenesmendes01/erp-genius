-- AlterTable
-- Vínculo professor↔experimental (Issue #13). Coluna NULL: experimentais
-- existentes ficam sem professor atribuído até serem (re)atribuídas.
ALTER TABLE "Lead" ADD COLUMN     "professorExperimentalId" TEXT;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_professorExperimentalId_fkey" FOREIGN KEY ("professorExperimentalId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
