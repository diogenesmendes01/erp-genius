CREATE TABLE "RegistroEncerramentoMatricula" (
 id TEXT PRIMARY KEY, "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "decisaoId" TEXT NOT NULL REFERENCES "DecisaoAcertoEncerramento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "statusAnterior" TEXT NOT NULL CHECK("statusAnterior" IN ('ATIVA','PAUSADA')),
 "dataEfetiva" DATE NOT NULL,"fusoInstitucional" TEXT NOT NULL,"incluiDia" BOOLEAN NOT NULL,
 "limiteVinculo" TIMESTAMP(3) NOT NULL,"aplicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RegistroEncerramentoMatricula_matriculaId_key" ON "RegistroEncerramentoMatricula"("matriculaId");
CREATE TRIGGER encerramento_temporal_preservado BEFORE UPDATE OR DELETE ON "RegistroEncerramentoMatricula" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_registro_temporal_encerramento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c JSONB; estado TEXT; fuso TEXT; limite TIMESTAMP;
BEGIN
 SELECT status::text INTO estado FROM "Matricula" WHERE id=NEW."matriculaId" FOR UPDATE;
 SELECT ct INTO c FROM "DecisaoAcertoEncerramento" d JOIN "RascunhoAcertoEncerramento" r ON r.id=d."rascunhoId", jsonb_array_elements(r.snapshot->'contratos') ct
 WHERE d.id=NEW."decisaoId" AND d.aprovada AND ct->'calculo'->>'matriculaId'=NEW."matriculaId";
 SELECT "fusoInstitucional" INTO fuso FROM "ConfiguracaoOperacional" WHERE id='escola' FOR SHARE;
 limite := (((NEW."dataEfetiva" + CASE WHEN NEW."incluiDia" THEN 1 ELSE 0 END)::timestamp AT TIME ZONE NEW."fusoInstitucional") AT TIME ZONE 'UTC');
 IF c IS NULL OR NEW."statusAnterior" IS DISTINCT FROM estado OR NEW."fusoInstitucional" IS DISTINCT FROM fuso
 OR NEW."dataEfetiva" IS DISTINCT FROM (c->'calculo'->>'dataEfetiva')::date
 OR NEW."incluiDia" IS DISTINCT FROM (c->'origem'->'condicoes'->'regras'->>'diaEncerramento'='INCLUIR')
 OR NEW."limiteVinculo" IS DISTINCT FROM limite
 THEN RAISE EXCEPTION 'Registro temporal diverge das condições aprovadas'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER registro_temporal_encerramento_conferido BEFORE INSERT ON "RegistroEncerramentoMatricula" FOR EACH ROW EXECUTE FUNCTION conferir_registro_temporal_encerramento();
