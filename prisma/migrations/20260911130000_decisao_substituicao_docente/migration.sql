-- CreateTable
CREATE TABLE "DecisaoSubstituicaoDocente" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoSubstituicaoDocente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoSubstituicaoDocente_propostaId_key" ON "DecisaoSubstituicaoDocente"("propostaId");

-- AddForeignKey
ALTER TABLE "DecisaoSubstituicaoDocente" ADD CONSTRAINT "DecisaoSubstituicaoDocente_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaSubstituicaoDocente"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoSubstituicaoDocente" ADD CONSTRAINT "DecisaoSubstituicaoDocente_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION conferir_decisao_substituicao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão da substituição deve permanecer preservada'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaSubstituicaoDocente" WHERE id=NEW."propostaId" AND "preparadorId"=NEW."decisorId") THEN RAISE EXCEPTION 'Outra pessoa deve decidir a substituição'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_substituicao_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoSubstituicaoDocente" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_substituicao();
