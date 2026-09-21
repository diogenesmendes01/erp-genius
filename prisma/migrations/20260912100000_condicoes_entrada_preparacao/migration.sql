-- CreateTable
CREATE TABLE "CondicoesEntradaPreparacao" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CondicoesEntradaPreparacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CondicoesEntradaPreparacao_matriculaId_versao_key" ON "CondicoesEntradaPreparacao"("matriculaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "CondicoesEntradaPreparacao_preparadorId_chaveIdempotencia_key" ON "CondicoesEntradaPreparacao"("preparadorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "CondicoesEntradaPreparacao" ADD CONSTRAINT "CondicoesEntradaPreparacao_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CondicoesEntradaPreparacao" ADD CONSTRAINT "CondicoesEntradaPreparacao_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "CondicoesEntradaPreparacao" ADD CONSTRAINT "condicoes_entrada_versao" CHECK (versao > 0);
CREATE FUNCTION preservar_condicoes_entrada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Condições de entrada são imutáveis; registre nova versão';
END;
$$;
CREATE TRIGGER preservar_condicoes_entrada BEFORE UPDATE OR DELETE ON "CondicoesEntradaPreparacao" FOR EACH ROW EXECUTE FUNCTION preservar_condicoes_entrada();
