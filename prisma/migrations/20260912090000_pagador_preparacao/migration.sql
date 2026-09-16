-- CreateTable
CREATE TABLE "PagadorPreparacaoMatricula" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagadorPreparacaoMatricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PagadorPreparacaoMatricula_matriculaId_versao_key" ON "PagadorPreparacaoMatricula"("matriculaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PagadorPreparacaoMatricula_preparadorId_chaveIdempotencia_key" ON "PagadorPreparacaoMatricula"("preparadorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "PagadorPreparacaoMatricula" ADD CONSTRAINT "PagadorPreparacaoMatricula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PagadorPreparacaoMatricula" ADD CONSTRAINT "PagadorPreparacaoMatricula_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PagadorPreparacaoMatricula" ADD CONSTRAINT "pagador_preparacao_tipo" CHECK (tipo IN ('ALUNO', 'RESPONSAVEL', 'EMPRESA'));
ALTER TABLE "PagadorPreparacaoMatricula" ADD CONSTRAINT "pagador_preparacao_versao" CHECK (versao > 0);
CREATE FUNCTION preservar_pagador_preparacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Registro de pagador é imutável; registre nova versão';
END;
$$;
CREATE TRIGGER preservar_pagador_preparacao BEFORE UPDATE OR DELETE ON "PagadorPreparacaoMatricula" FOR EACH ROW EXECUTE FUNCTION preservar_pagador_preparacao();
