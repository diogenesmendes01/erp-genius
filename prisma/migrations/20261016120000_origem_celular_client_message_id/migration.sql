-- AlterEnum
ALTER TYPE "OrigemEnvio" ADD VALUE 'CELULAR';
ALTER TYPE "OrigemEnvio" ADD VALUE 'IA';

-- AlterTable
ALTER TABLE "MensagemWhatsApp" ADD COLUMN     "clientMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MensagemWhatsApp_clientMessageId_key" ON "MensagemWhatsApp"("clientMessageId");
