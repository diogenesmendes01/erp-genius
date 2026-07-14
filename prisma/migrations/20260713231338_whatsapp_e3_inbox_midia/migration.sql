-- AlterTable
ALTER TABLE "ConversaWhatsApp" ADD COLUMN     "inboundTratadoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IntencaoMensagem" ADD COLUMN     "midiaPath" TEXT,
ADD COLUMN     "tipo" "TipoMensagem" NOT NULL DEFAULT 'TEXTO';
