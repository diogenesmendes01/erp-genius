CREATE TABLE "VersaoCalendarioEscolar" (
 "id" TEXT PRIMARY KEY,
 "versao" INTEGER NOT NULL UNIQUE CHECK (versao > 0),
 "preparadorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "fusoInstitucional" TEXT NOT NULL,
 "periodos" JSONB NOT NULL CHECK (jsonb_typeof(periodos) = 'array'),
 "motivo" TEXT NOT NULL CHECK (length(trim(motivo)) >= 5),
 "chaveIdempotencia" TEXT NOT NULL,
 "entradaHash" TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "calendario_escolar_chave_key" ON "VersaoCalendarioEscolar"("preparadorId", "chaveIdempotencia");
CREATE FUNCTION preservar_versao_calendario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Versão de calendário deve permanecer preservada'; END $$;
CREATE TRIGGER versao_calendario_preservada BEFORE UPDATE OR DELETE ON "VersaoCalendarioEscolar"
 FOR EACH ROW EXECUTE FUNCTION preservar_versao_calendario();
