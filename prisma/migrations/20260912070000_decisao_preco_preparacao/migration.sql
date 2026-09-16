-- CreateTable
CREATE TABLE "DecisaoPrecoPreparacao" (
    "id" TEXT NOT NULL,
    "preparacaoId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoPrecoPreparacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoPrecoPreparacao_preparacaoId_key" ON "DecisaoPrecoPreparacao"("preparacaoId");

-- AddForeignKey
ALTER TABLE "DecisaoPrecoPreparacao" ADD CONSTRAINT "DecisaoPrecoPreparacao_preparacaoId_fkey" FOREIGN KEY ("preparacaoId") REFERENCES "PreparacaoComercialMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoPrecoPreparacao" ADD CONSTRAINT "DecisaoPrecoPreparacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


CREATE FUNCTION proteger_decisao_preco_preparacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão comercial é imutável'; END IF;
  IF EXISTS (SELECT 1 FROM "PreparacaoComercialMatricula" p WHERE p.id = NEW."preparacaoId" AND p."preparadorId" = NEW."decisorId") THEN RAISE EXCEPTION 'Autoaprovação não permitida'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_decisao_preco_preparacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoPrecoPreparacao" FOR EACH ROW EXECUTE FUNCTION proteger_decisao_preco_preparacao();
