-- AlterTable
-- `precoReferenciaAusente` já foi adicionada pela migration
-- 20260622120000_matricula_preco_referencia_ausente; aqui só a justificativa (issue #22).
ALTER TABLE "Matricula" ADD COLUMN     "justificativaSemPreco" TEXT;
