-- CreateEnum
CREATE TYPE "TipoFonteConhecimento" AS ENUM ('TEXTO', 'ARQUIVO');

-- CreateEnum
CREATE TYPE "StatusFonteConhecimento" AS ENUM ('PROCESSANDO', 'PRONTA', 'ERRO');

-- CreateTable
CREATE TABLE "FonteConhecimento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoFonteConhecimento" NOT NULL,
    "nome" TEXT NOT NULL,
    "registroUploadId" TEXT,
    "status" "StatusFonteConhecimento" NOT NULL,
    "erro" TEXT,
    "hashConteudo" TEXT NOT NULL,
    "validoAte" TIMESTAMP(3),
    "enviavelAoLead" BOOLEAN NOT NULL DEFAULT false,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivadaEm" TIMESTAMP(3),

    CONSTRAINT "FonteConhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrechoConhecimento" (
    "id" TEXT NOT NULL,
    "fonteId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "busca" tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', "texto")) STORED,

    CONSTRAINT "TrechoConhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FonteConhecimento_status_arquivadaEm_idx" ON "FonteConhecimento"("status", "arquivadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "TrechoConhecimento_fonteId_ordem_key" ON "TrechoConhecimento"("fonteId", "ordem");

-- CreateIndex (SQL manual: busca textual em português)
CREATE INDEX "TrechoConhecimento_busca_idx" ON "TrechoConhecimento" USING GIN ("busca");

-- AddForeignKey
ALTER TABLE "FonteConhecimento" ADD CONSTRAINT "FonteConhecimento_registroUploadId_fkey" FOREIGN KEY ("registroUploadId") REFERENCES "RegistroUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrechoConhecimento" ADD CONSTRAINT "TrechoConhecimento_fonteId_fkey" FOREIGN KEY ("fonteId") REFERENCES "FonteConhecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
