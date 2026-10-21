-- AlterTable
ALTER TABLE "AulaDiario" ADD COLUMN     "encontroId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AulaDiario_encontroId_key" ON "AulaDiario"("encontroId");

-- AddForeignKey
ALTER TABLE "AulaDiario" ADD CONSTRAINT "AulaDiario_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
