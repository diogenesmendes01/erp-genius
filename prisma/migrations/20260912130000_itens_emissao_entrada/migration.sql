-- CreateTable
CREATE TABLE "ItemEmissaoEntrada" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "emissaoId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,

    CONSTRAINT "ItemEmissaoEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemEmissaoEntrada_cobrancaId_key" ON "ItemEmissaoEntrada"("cobrancaId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemEmissaoEntrada_cobrancaId_matriculaId_key" ON "ItemEmissaoEntrada"("cobrancaId", "matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "EmissaoCobrancasEntrada_id_matriculaId_key" ON "EmissaoCobrancasEntrada"("id", "matriculaId");

-- AddForeignKey
ALTER TABLE "ItemEmissaoEntrada" ADD CONSTRAINT "ItemEmissaoEntrada_emissaoId_matriculaId_fkey" FOREIGN KEY ("emissaoId", "matriculaId") REFERENCES "EmissaoCobrancasEntrada"("id", "matriculaId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ItemEmissaoEntrada" ADD CONSTRAINT "ItemEmissaoEntrada_cobrancaId_matriculaId_fkey" FOREIGN KEY ("cobrancaId", "matriculaId") REFERENCES "Cobranca"("id", "matriculaId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Vincula apenas os IDs já registrados. FK inválida aborta migração em vez de inventar histórico.
INSERT INTO "ItemEmissaoEntrada" (id, "matriculaId", "emissaoId", "cobrancaId")
SELECT 'backfill-entrada-' || e.id || '-' || (c->>'id'), e."matriculaId", e.id, c->>'id'
FROM "EmissaoCobrancasEntrada" e CROSS JOIN LATERAL jsonb_array_elements(e.memoria->'cobrancas') c;
CREATE FUNCTION preservar_item_emissao_entrada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Vínculo de emissão é imutável'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "EmissaoCobrancasEntrada" e CROSS JOIN LATERAL jsonb_array_elements(e.memoria->'cobrancas') c WHERE e.id=NEW."emissaoId" AND c->>'id'=NEW."cobrancaId") THEN RAISE EXCEPTION 'Cobrança ausente da memória de emissão'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_item_emissao_entrada BEFORE INSERT OR UPDATE OR DELETE ON "ItemEmissaoEntrada" FOR EACH ROW EXECUTE FUNCTION preservar_item_emissao_entrada();
