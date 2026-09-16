CREATE TABLE "RascunhoRecomposicaoCobertura" (
  "id" TEXT PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "preparadorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "versao" INTEGER NOT NULL CHECK ("versao" > 0),
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "entrada" JSONB NOT NULL,
  "snapshot" JSONB NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "recomposicao_rascunho_versao_key" ON "RascunhoRecomposicaoCobertura"("matriculaId", "versao");
CREATE UNIQUE INDEX "recomposicao_rascunho_chave_key" ON "RascunhoRecomposicaoCobertura"("preparadorId", "chaveIdempotencia");
CREATE FUNCTION preservar_rascunho_recomposicao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Rascunho de recomposição é histórico; prepare uma nova versão.';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER rascunho_recomposicao_imutavel BEFORE UPDATE OR DELETE ON "RascunhoRecomposicaoCobertura"
FOR EACH ROW EXECUTE FUNCTION preservar_rascunho_recomposicao();
