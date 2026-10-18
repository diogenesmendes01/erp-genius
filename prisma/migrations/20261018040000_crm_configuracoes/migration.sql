-- CreateEnum
CREATE TYPE "RegraDistribuicao" AS ENUM ('RODIZIO', 'MENOR_CARGA', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoTemplate" AS ENUM ('MODELO_AUTOMACAO', 'RESPOSTA_RAPIDA');

-- AlterTable
ALTER TABLE "NumeroWhatsApp" ADD COLUMN     "perfilFotoUploadId" TEXT,
ADD COLUMN     "perfilNome" TEXT,
ADD COLUMN     "perfilRecado" TEXT,
ADD COLUMN     "privacidade" JSONB,
ADD COLUMN     "temporariasSegundos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PrazoRespostaSetor" ADD COLUMN     "alertarGerente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alertarResponsavel" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contarSoNoHorario" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "participantesIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "regraDistribuicao" "RegraDistribuicao" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "ultimoAtribuidoId" TEXT;

-- AlterTable
ALTER TABLE "TemplateWhatsApp" ADD COLUMN     "ariaPodeUsar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "arquivadoEm" TIMESTAMP(3),
ADD COLUMN     "atalho" TEXT,
ADD COLUMN     "setor" "FinalidadeAtendimentoWhatsApp",
ADD COLUMN     "tipo" "TipoTemplate" NOT NULL DEFAULT 'MODELO_AUTOMACAO';

-- CreateIndex
CREATE UNIQUE INDEX "TemplateWhatsApp_atalho_key" ON "TemplateWhatsApp"("atalho");
