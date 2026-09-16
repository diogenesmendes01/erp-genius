CREATE TABLE "PropostaGradeTurma" (
 "id" TEXT PRIMARY KEY,
 "turmaId" TEXT NOT NULL REFERENCES "Turma"("id") ON DELETE RESTRICT,
 "calendarioId" TEXT NOT NULL REFERENCES "VersaoCalendarioEscolar"("id") ON DELETE RESTRICT,
 "preparadorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "versao" INTEGER NOT NULL CHECK (versao > 0),
 "fusoOrigem" TEXT NOT NULL,
 "motivo" TEXT NOT NULL CHECK (length(trim(motivo)) >= 5),
 "chaveIdempotencia" TEXT NOT NULL,
 "entradaHash" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PropostaGradeTurma_turmaId_versao_key" ON "PropostaGradeTurma"("turmaId", versao);
CREATE UNIQUE INDEX "grade_turma_chave_key" ON "PropostaGradeTurma"("preparadorId", "chaveIdempotencia");
CREATE FUNCTION preservar_proposta_grade() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Proposta de grade deve permanecer preservada'; END $$;
CREATE TRIGGER proposta_grade_preservada BEFORE UPDATE OR DELETE ON "PropostaGradeTurma"
 FOR EACH ROW EXECUTE FUNCTION preservar_proposta_grade();
