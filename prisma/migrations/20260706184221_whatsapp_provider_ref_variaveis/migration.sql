-- AlterTable
ALTER TABLE "IntencaoMensagem" ADD COLUMN     "variaveis" JSONB;

-- AlterTable
ALTER TABLE "NumeroWhatsApp" ADD COLUMN     "providerRef" TEXT;
