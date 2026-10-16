-- CreateEnum
CREATE TYPE "OrigemCanal" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'ANUNCIO', 'GOOGLE', 'SITE', 'INDICACAO', 'EVENTO', 'LINKEDIN', 'IMPORTACAO', 'OUTRO');

-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "pessoaId" TEXT;
ALTER TABLE "ContatoWhatsApp" ADD COLUMN     "pessoaId" TEXT;
ALTER TABLE "Lead" ADD COLUMN     "origemCanal" "OrigemCanal",
ADD COLUMN     "pessoaId" TEXT;
ALTER TABLE "Responsavel" ADD COLUMN     "pessoaId" TEXT;

-- CreateTable
CREATE TABLE "Pessoa" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "cidade" TEXT,
    "cargo" TEXT,
    "linkedin" TEXT,
    "origemCanal" "OrigemCanal",
    "empresaId" TEXT,
    "mescladaEmId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pessoa_pkey" PRIMARY KEY ("id")
);


CREATE UNIQUE INDEX "Pessoa_codigo_key" ON "Pessoa"("codigo");
CREATE INDEX "Pessoa_empresaId_idx" ON "Pessoa"("empresaId");
CREATE INDEX "Pessoa_mescladaEmId_idx" ON "Pessoa"("mescladaEmId");
CREATE UNIQUE INDEX "Aluno_pessoaId_key" ON "Aluno"("pessoaId");
CREATE INDEX "ContatoWhatsApp_pessoaId_idx" ON "ContatoWhatsApp"("pessoaId");
CREATE INDEX "Lead_pessoaId_idx" ON "Lead"("pessoaId");
CREATE UNIQUE INDEX "Responsavel_pessoaId_key" ON "Responsavel"("pessoaId");

ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Responsavel" ADD CONSTRAINT "Responsavel_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContatoWhatsApp" ADD CONSTRAINT "ContatoWhatsApp_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_mescladaEmId_fkey" FOREIGN KEY ("mescladaEmId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lápide de mesclagem nunca aponta para a própria pessoa.
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_mescladaEmId_check" CHECK ("mescladaEmId" IS NULL OR "mescladaEmId" <> "id");
