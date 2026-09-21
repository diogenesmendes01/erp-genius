-- AlterTable
ALTER TABLE "RegistroUpload" ADD COLUMN     "matriculaId" TEXT;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "matriculaId" TEXT,
ALTER COLUMN "leadId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Documento_matriculaId_idx" ON "Documento"("matriculaId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Um documento nunca fica sem contexto nem herda permissões de dois objetos.
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_contexto_exclusivo_check"
CHECK (num_nonnulls("leadId", "matriculaId") = 1);
