-- CreateEnum
CREATE TYPE "CorTag" AS ENUM ('NEUTRA', 'MARCA', 'INFO', 'SUCESSO', 'ALERTA', 'PERIGO', 'IA');

-- CreateEnum
CREATE TYPE "TipoCampoPersonalizado" AS ENUM ('TEXTO', 'NUMERO', 'DATA', 'SELECAO', 'BOOLEANO');

-- CreateEnum
CREATE TYPE "AlvoCampoPersonalizado" AS ENUM ('PESSOA', 'EMPRESA');

-- CreateEnum
CREATE TYPE "TelaFiltroSalvo" AS ENUM ('FUNIL', 'CONTATOS', 'CARTEIRA', 'TAREFAS', 'COMISSOES');

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" "CorTag" NOT NULL,
    "grupo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PessoaTag" (
    "pessoaId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PessoaTag_pkey" PRIMARY KEY ("pessoaId","tagId")
);

-- CreateTable
CREATE TABLE "EmpresaTag" (
    "empresaId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpresaTag_pkey" PRIMARY KEY ("empresaId","tagId")
);

-- CreateTable
CREATE TABLE "CampoPersonalizado" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCampoPersonalizado" NOT NULL,
    "alvo" "AlvoCampoPersonalizado" NOT NULL,
    "opcoes" TEXT[],
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "arquivadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampoPersonalizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorCampoPersonalizado" (
    "id" TEXT NOT NULL,
    "campoId" TEXT NOT NULL,
    "pessoaId" TEXT,
    "empresaId" TEXT,
    "valor" JSONB,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValorCampoPersonalizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiltroSalvo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tela" "TelaFiltroSalvo" NOT NULL,
    "nome" TEXT NOT NULL,
    "filtros" JSONB NOT NULL,
    "compartilhado" BOOLEAN NOT NULL DEFAULT false,
    "arquivadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiltroSalvo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_nome_key" ON "Tag"("nome");

-- CreateIndex
CREATE INDEX "PessoaTag_tagId_idx" ON "PessoaTag"("tagId");

-- CreateIndex
CREATE INDEX "EmpresaTag_tagId_idx" ON "EmpresaTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CampoPersonalizado_alvo_nome_key" ON "CampoPersonalizado"("alvo", "nome");

-- CreateIndex
CREATE INDEX "ValorCampoPersonalizado_pessoaId_idx" ON "ValorCampoPersonalizado"("pessoaId");

-- CreateIndex
CREATE INDEX "ValorCampoPersonalizado_empresaId_idx" ON "ValorCampoPersonalizado"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "ValorCampoPersonalizado_campoId_pessoaId_key" ON "ValorCampoPersonalizado"("campoId", "pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "ValorCampoPersonalizado_campoId_empresaId_key" ON "ValorCampoPersonalizado"("campoId", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "FiltroSalvo_usuarioId_tela_nome_key" ON "FiltroSalvo"("usuarioId", "tela", "nome");

-- AddForeignKey
ALTER TABLE "PessoaTag" ADD CONSTRAINT "PessoaTag_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaTag" ADD CONSTRAINT "PessoaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaTag" ADD CONSTRAINT "PessoaTag_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaTag" ADD CONSTRAINT "EmpresaTag_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaTag" ADD CONSTRAINT "EmpresaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaTag" ADD CONSTRAINT "EmpresaTag_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorCampoPersonalizado" ADD CONSTRAINT "ValorCampoPersonalizado_campoId_fkey" FOREIGN KEY ("campoId") REFERENCES "CampoPersonalizado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorCampoPersonalizado" ADD CONSTRAINT "ValorCampoPersonalizado_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorCampoPersonalizado" ADD CONSTRAINT "ValorCampoPersonalizado_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiltroSalvo" ADD CONSTRAINT "FiltroSalvo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exatamente um dono por valor: pessoa ou empresa.
ALTER TABLE "ValorCampoPersonalizado" ADD CONSTRAINT "ValorCampoPersonalizado_um_dono_check" CHECK (num_nonnulls("pessoaId","empresaId") = 1);
