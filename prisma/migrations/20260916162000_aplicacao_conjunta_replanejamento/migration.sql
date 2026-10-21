CREATE TABLE "DecisaoReplanejamentoConjunto" (
  "id" TEXT NOT NULL,
  "rascunhoId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoReplanejamentoConjunto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DecisaoReplanejamentoConjunto_rascunhoId_key" ON "DecisaoReplanejamentoConjunto"("rascunhoId");
ALTER TABLE "DecisaoReplanejamentoConjunto" ADD CONSTRAINT "DecisaoReplanejamentoConjunto_rascunhoId_fkey" FOREIGN KEY ("rascunhoId") REFERENCES "RascunhoReplanejamento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoReplanejamentoConjunto" ADD CONSTRAINT "DecisaoReplanejamentoConjunto_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "AplicacaoReplanejamentoConjunto" (
  "id" TEXT NOT NULL,
  "rascunhoId" TEXT NOT NULL,
  "decisaoId" TEXT NOT NULL,
  "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "estadoHash" TEXT NOT NULL,
  CONSTRAINT "AplicacaoReplanejamentoConjunto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AplicacaoReplanejamentoConjunto_rascunhoId_key" ON "AplicacaoReplanejamentoConjunto"("rascunhoId");
CREATE UNIQUE INDEX "AplicacaoReplanejamentoConjunto_decisaoId_key" ON "AplicacaoReplanejamentoConjunto"("decisaoId");
ALTER TABLE "AplicacaoReplanejamentoConjunto" ADD CONSTRAINT "AplicacaoReplanejamentoConjunto_rascunhoId_fkey" FOREIGN KEY ("rascunhoId") REFERENCES "RascunhoReplanejamento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoReplanejamentoConjunto" ADD CONSTRAINT "AplicacaoReplanejamentoConjunto_decisaoId_fkey" FOREIGN KEY ("decisaoId") REFERENCES "DecisaoReplanejamentoConjunto"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION "preservar_decisao_replanejamento_conjunto_162"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Decisão de replanejamento conjunto deve permanecer preservada'; END $$;
CREATE TRIGGER "decisao_replanejamento_conjunto_preservada_162" BEFORE UPDATE OR DELETE ON "DecisaoReplanejamentoConjunto" FOR EACH ROW EXECUTE FUNCTION "preservar_decisao_replanejamento_conjunto_162"();
CREATE OR REPLACE FUNCTION "preservar_aplicacao_replanejamento_conjunto_162"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Aplicação de replanejamento conjunto deve permanecer preservada'; END $$;
CREATE TRIGGER "aplicacao_replanejamento_conjunto_preservada_162" BEFORE UPDATE OR DELETE ON "AplicacaoReplanejamentoConjunto" FOR EACH ROW EXECUTE FUNCTION "preservar_aplicacao_replanejamento_conjunto_162"();
-- Database guardrails mirror the server action, so direct SQL cannot forge an approval.
CREATE OR REPLACE FUNCTION "validar_decisao_replanejamento_conjunto_162"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE preparado TEXT; calendario_preparador TEXT; ultimo TEXT; ativo BOOLEAN; papeis "Papel"[];
BEGIN
  SELECT r."preparadorId", c."preparadorId" INTO preparado, calendario_preparador FROM "RascunhoReplanejamento" r JOIN "VersaoCalendarioEscolar" c ON c.id=r."calendarioId" WHERE r.id=NEW."rascunhoId";
  SELECT id INTO ultimo FROM "RascunhoReplanejamento" WHERE "calendarioId"=(SELECT "calendarioId" FROM "RascunhoReplanejamento" WHERE id=NEW."rascunhoId") ORDER BY versao DESC LIMIT 1;
  SELECT ativo, papeis INTO ativo, papeis FROM "Usuario" WHERE id=NEW."decisorId";
  IF preparado IS NULL OR NEW."rascunhoId" IS DISTINCT FROM ultimo OR NEW."decisorId"=preparado OR NEW."decisorId"=calendario_preparador
     OR NOT ativo OR NOT (papeis && ARRAY['GERENTE_PEDAGOGICO'::"Papel", 'ADMINISTRADOR'::"Papel"])
     OR length(trim(NEW.motivo)) < 5 OR NEW."estadoHash" IS DISTINCT FROM (SELECT "estadoHash" FROM "RascunhoReplanejamento" WHERE id=NEW."rascunhoId") THEN
    RAISE EXCEPTION 'Decisão conjunta de replanejamento inválida';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "validar_decisao_replanejamento_conjunto_162" BEFORE INSERT ON "DecisaoReplanejamentoConjunto" FOR EACH ROW EXECUTE FUNCTION "validar_decisao_replanejamento_conjunto_162"();

CREATE OR REPLACE FUNCTION "validar_aplicacao_replanejamento_conjunto_162"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE decisao_rascunho TEXT; decisao_hash TEXT; aprovada BOOLEAN;
BEGIN
 SELECT "rascunhoId", "estadoHash", aprovada INTO decisao_rascunho, decisao_hash, aprovada FROM "DecisaoReplanejamentoConjunto" WHERE id=NEW."decisaoId";
 IF NOT aprovada OR NEW."rascunhoId" IS DISTINCT FROM decisao_rascunho OR NEW."estadoHash" IS DISTINCT FROM decisao_hash THEN
   RAISE EXCEPTION 'Aplicação conjunta exige a decisão aprovada do mesmo rascunho e hash';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "validar_aplicacao_replanejamento_conjunto_162" BEFORE INSERT ON "AplicacaoReplanejamentoConjunto" FOR EACH ROW EXECUTE FUNCTION "validar_aplicacao_replanejamento_conjunto_162"();
