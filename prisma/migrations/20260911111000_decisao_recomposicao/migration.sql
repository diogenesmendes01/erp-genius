CREATE TABLE "DecisaoRecomposicaoCobertura" (
  "id" TEXT PRIMARY KEY,
  "rascunhoId" TEXT NOT NULL REFERENCES "RascunhoRecomposicaoCobertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "decisorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL CHECK (length(trim("motivo")) >= 5),
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DecisaoRecomposicaoCobertura_rascunhoId_key" ON "DecisaoRecomposicaoCobertura"("rascunhoId");
CREATE FUNCTION conferir_decisao_recomposicao() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'A decisão de recomposição deve permanecer no histórico.'; END IF;
  IF EXISTS (SELECT 1 FROM "RascunhoRecomposicaoCobertura" WHERE id = NEW."rascunhoId" AND "preparadorId" = NEW."decisorId") THEN
    RAISE EXCEPTION 'Outra pessoa deve decidir a recomposição.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER decisao_recomposicao_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoRecomposicaoCobertura"
FOR EACH ROW EXECUTE FUNCTION conferir_decisao_recomposicao();
