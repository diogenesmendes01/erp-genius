CREATE TABLE "AplicacaoRecomposicaoCobertura" (
  "id" TEXT PRIMARY KEY,
  "decisaoId" TEXT NOT NULL REFERENCES "DecisaoRecomposicaoCobertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "executorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AplicacaoRecomposicaoCobertura_decisaoId_key" ON "AplicacaoRecomposicaoCobertura"("decisaoId");
CREATE TABLE "DiaProgramadoRecomposicao" (
  "id" TEXT PRIMARY KEY,
  "aplicacaoId" TEXT NOT NULL REFERENCES "AplicacaoRecomposicaoCobertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "direitoId" TEXT NOT NULL REFERENCES "DiaCompensacaoCobertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "dataCobertura" DATE NOT NULL
);
CREATE UNIQUE INDEX "DiaProgramadoRecomposicao_direitoId_key" ON "DiaProgramadoRecomposicao"("direitoId");
CREATE FUNCTION conferir_programacao_recomposicao() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "AplicacaoRecomposicaoCobertura" a
    JOIN "DecisaoRecomposicaoCobertura" d ON d.id = a."decisaoId"
    JOIN "RascunhoRecomposicaoCobertura" r ON r.id = d."rascunhoId"
    JOIN "DiaCompensacaoCobertura" dia ON dia.id = NEW."direitoId"
    WHERE a.id = NEW."aplicacaoId" AND d.aprovada AND r."matriculaId" = dia."matriculaId" AND dia.estado = 'PENDENTE'
  ) THEN RAISE EXCEPTION 'Programação exige decisão aprovada e direito pendente da mesma matrícula.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER programacao_recomposicao_origem BEFORE INSERT ON "DiaProgramadoRecomposicao"
FOR EACH ROW EXECUTE FUNCTION conferir_programacao_recomposicao();
