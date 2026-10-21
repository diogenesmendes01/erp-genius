-- CreateTable
CREATE TABLE "EmissaoCobrancasEntrada" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "condicoesId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "memoria" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmissaoCobrancasEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmissaoCobrancasEntrada_matriculaId_etapa_key" ON "EmissaoCobrancasEntrada"("matriculaId", "etapa");

-- AddForeignKey
ALTER TABLE "EmissaoCobrancasEntrada" ADD CONSTRAINT "EmissaoCobrancasEntrada_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmissaoCobrancasEntrada" ADD CONSTRAINT "EmissaoCobrancasEntrada_condicoesId_fkey" FOREIGN KEY ("condicoesId") REFERENCES "CondicoesEntradaPreparacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmissaoCobrancasEntrada" ADD CONSTRAINT "EmissaoCobrancasEntrada_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "EmissaoCobrancasEntrada" ADD CONSTRAINT "emissao_entrada_etapa" CHECK (etapa IN ('CONFERENCIA_SECRETARIA', 'ATIVACAO'));
CREATE FUNCTION preservar_emissao_entrada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Emissão inicial é imutável'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "CondicoesEntradaPreparacao" c WHERE c.id=NEW."condicoesId" AND c."matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Condições de outra matrícula'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_emissao_entrada BEFORE INSERT OR UPDATE OR DELETE ON "EmissaoCobrancasEntrada" FOR EACH ROW EXECUTE FUNCTION preservar_emissao_entrada();
