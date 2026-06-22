-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('MATRICULA', 'TROCA_TURMA', 'PAUSA', 'REATIVACAO', 'ENCERRAMENTO');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoCobranca_new" AS ENUM ('MATRICULA', 'MENSALIDADE', 'HORA_PARTICULAR', 'MATERIAL', 'CERTIFICADO');
ALTER TABLE "PrecoReferencia" ALTER COLUMN "tipoCobranca" TYPE "TipoCobranca_new" USING ("tipoCobranca"::text::"TipoCobranca_new");
ALTER TABLE "Cobranca" ALTER COLUMN "tipo" TYPE "TipoCobranca_new" USING ("tipo"::text::"TipoCobranca_new");
ALTER TYPE "TipoCobranca" RENAME TO "TipoCobranca_old";
ALTER TYPE "TipoCobranca_new" RENAME TO "TipoCobranca";
DROP TYPE "TipoCobranca_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "PrecoReferencia" DROP CONSTRAINT "PrecoReferencia_produtoPaisId_fkey";

-- AlterTable
ALTER TABLE "Matricula" DROP COLUMN "pagamentoOk",
ADD COLUMN     "ativadaComPendencia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pagamentoTaxaOk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primeiraMensalidadeOk" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PrecoReferencia" DROP COLUMN "produtoPaisId",
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "modalidadeId" TEXT NOT NULL,
ADD COLUMN     "moeda" TEXT NOT NULL,
ADD COLUMN     "paisId" TEXT NOT NULL,
ADD COLUMN     "produtoId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "MovimentacaoAluno" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "turmaOrigemId" TEXT,
    "turmaDestinoId" TEXT,
    "statusOrigem" "StatusAluno",
    "statusDestino" "StatusAluno",
    "motivo" TEXT,
    "observacao" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoAluno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimentacaoAluno_alunoId_idx" ON "MovimentacaoAluno"("alunoId");

-- CreateIndex
CREATE INDEX "MovimentacaoAluno_tipo_idx" ON "MovimentacaoAluno"("tipo");

-- CreateIndex
CREATE INDEX "MovimentacaoAluno_criadoEm_idx" ON "MovimentacaoAluno"("criadoEm");

-- CreateIndex
CREATE INDEX "PrecoReferencia_paisId_produtoId_modalidadeId_tipoCobranca_idx" ON "PrecoReferencia"("paisId", "produtoId", "modalidadeId", "tipoCobranca");

-- CreateIndex
CREATE INDEX "PrecoReferencia_ativo_idx" ON "PrecoReferencia"("ativo");

-- AddForeignKey
ALTER TABLE "PrecoReferencia" ADD CONSTRAINT "PrecoReferencia_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoReferencia" ADD CONSTRAINT "PrecoReferencia_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoReferencia" ADD CONSTRAINT "PrecoReferencia_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoAluno" ADD CONSTRAINT "MovimentacaoAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoAluno" ADD CONSTRAINT "MovimentacaoAluno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

