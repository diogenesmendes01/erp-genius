-- CreateTable
CREATE TABLE "VersaoModeloContratual" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "conteudo" JSONB NOT NULL,
    "conteudoHash" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersaoModeloContratual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoModeloContratual" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoModeloContratual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VersaoModeloContratual_codigo_versao_key" ON "VersaoModeloContratual"("codigo", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoModeloContratual_preparadorId_chaveIdempotencia_key" ON "VersaoModeloContratual"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoModeloContratual_modeloId_key" ON "DecisaoModeloContratual"("modeloId");

-- AddForeignKey
ALTER TABLE "VersaoModeloContratual" ADD CONSTRAINT "VersaoModeloContratual_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoModeloContratual" ADD CONSTRAINT "DecisaoModeloContratual_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "VersaoModeloContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoModeloContratual" ADD CONSTRAINT "DecisaoModeloContratual_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "VersaoModeloContratual" ADD CONSTRAINT "modelo_versao_positiva" CHECK (versao > 0);
CREATE FUNCTION preservar_modelo_contratual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Versão e decisão contratuais são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'DecisaoModeloContratual' THEN
  IF EXISTS (SELECT 1 FROM "VersaoModeloContratual" WHERE id=NEW."modeloId" AND "preparadorId"=NEW."decisorId") THEN RAISE EXCEPTION 'Modelo exige aprovação independente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" WHERE id=NEW."decisorId" AND ativo AND 'ADMINISTRADOR'::"Papel"=ANY(papeis)) THEN RAISE EXCEPTION 'Publicação exige Administração ativa'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_versao_modelo BEFORE UPDATE OR DELETE ON "VersaoModeloContratual" FOR EACH ROW EXECUTE FUNCTION preservar_modelo_contratual();
CREATE TRIGGER preservar_decisao_modelo BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoModeloContratual" FOR EACH ROW EXECUTE FUNCTION preservar_modelo_contratual();
