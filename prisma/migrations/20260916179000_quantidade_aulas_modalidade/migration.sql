CREATE TYPE "SituacaoPropostaQuantidadeAulas" AS ENUM ('PREPARADA', 'REJEITADA', 'APROVADA', 'APLICADA');
CREATE TYPE "AlcanceImpactoQuantidadeAulas" AS ENUM ('FINALIZADA_PRESERVADA', 'REDUCAO_INICIADA_PRESERVADA', 'REDUCAO_NAO_INICIADA', 'REDUCAO_RASCUNHO', 'AUMENTO_INICIADA', 'AUMENTO_NAO_INICIADA', 'AUMENTO_RASCUNHO');

CREATE TABLE "PropostaQuantidadeAulasModalidade" (
  "id" TEXT NOT NULL,
  "modalidadeId" TEXT NOT NULL,
  "preparadorId" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "quantidadeAnterior" INTEGER NOT NULL,
  "quantidadeNova" INTEGER NOT NULL,
  "motivo" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "situacao" "SituacaoPropostaQuantidadeAulas" NOT NULL DEFAULT 'PREPARADA',
  "criadaEm" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropostaQuantidadeAulasModalidade_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropostaQuantidadeAulasModalidade_quantidades_validas" CHECK ("quantidadeAnterior" > 0 AND "quantidadeNova" > 0 AND "quantidadeAnterior" <> "quantidadeNova"),
  CONSTRAINT "PropostaQuantidadeAulasModalidade_motivo_valido" CHECK (length(trim("motivo")) >= 5)
);
CREATE TABLE "ImpactoQuantidadeAulasModalidade" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "turmaId" TEXT NOT NULL,
  "alcance" "AlcanceImpactoQuantidadeAulas" NOT NULL,
  "quantidadeAnterior" INTEGER NOT NULL,
  "quantidadeNova" INTEGER NOT NULL,
  "iniciadaEm" TIMESTAMPTZ(6),
  "publicada" BOOLEAN NOT NULL,
  "excecoesQ37" JSONB NOT NULL DEFAULT '[]',
  "snapshot" JSONB NOT NULL,
  "criadoEm" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImpactoQuantidadeAulasModalidade_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImpactoQuantidadeAulasModalidade_quantidades_validas" CHECK ("quantidadeAnterior" > 0 AND "quantidadeNova" > 0)
);
CREATE TABLE "DecisaoQuantidadeAulasModalidade" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "decididaEm" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoQuantidadeAulasModalidade_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisaoQuantidadeAulasModalidade_motivo_valido" CHECK (length(trim("motivo")) >= 5)
);
CREATE TABLE "AplicacaoQuantidadeAulasModalidade" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "aplicadorId" TEXT NOT NULL,
  "aplicadaEm" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "estadoHash" TEXT NOT NULL,
  CONSTRAINT "AplicacaoQuantidadeAulasModalidade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropostaQuantidadeAulasModalidade_modalidadeId_versao_key" ON "PropostaQuantidadeAulasModalidade"("modalidadeId", "versao");
CREATE UNIQUE INDEX "PropostaQuantidadeAulasModalidade_preparadorId_chaveIdempotencia_key" ON "PropostaQuantidadeAulasModalidade"("preparadorId", "chaveIdempotencia");
CREATE INDEX "PropostaQuantidadeAulasModalidade_modalidadeId_situacao_criadaEm_idx" ON "PropostaQuantidadeAulasModalidade"("modalidadeId", "situacao", "criadaEm");
CREATE UNIQUE INDEX "ImpactoQuantidadeAulasModalidade_propostaId_turmaId_key" ON "ImpactoQuantidadeAulasModalidade"("propostaId", "turmaId");
CREATE INDEX "ImpactoQuantidadeAulasModalidade_turmaId_criadoEm_idx" ON "ImpactoQuantidadeAulasModalidade"("turmaId", "criadoEm");
CREATE UNIQUE INDEX "DecisaoQuantidadeAulasModalidade_propostaId_key" ON "DecisaoQuantidadeAulasModalidade"("propostaId");
CREATE UNIQUE INDEX "AplicacaoQuantidadeAulasModalidade_propostaId_key" ON "AplicacaoQuantidadeAulasModalidade"("propostaId");

ALTER TABLE "PropostaQuantidadeAulasModalidade" ADD CONSTRAINT "PropostaQuantidadeAulasModalidade_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaQuantidadeAulasModalidade" ADD CONSTRAINT "PropostaQuantidadeAulasModalidade_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ImpactoQuantidadeAulasModalidade" ADD CONSTRAINT "ImpactoQuantidadeAulasModalidade_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaQuantidadeAulasModalidade"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ImpactoQuantidadeAulasModalidade" ADD CONSTRAINT "ImpactoQuantidadeAulasModalidade_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoQuantidadeAulasModalidade" ADD CONSTRAINT "DecisaoQuantidadeAulasModalidade_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaQuantidadeAulasModalidade"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoQuantidadeAulasModalidade" ADD CONSTRAINT "DecisaoQuantidadeAulasModalidade_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoQuantidadeAulasModalidade" ADD CONSTRAINT "AplicacaoQuantidadeAulasModalidade_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaQuantidadeAulasModalidade"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AplicacaoQuantidadeAulasModalidade" ADD CONSTRAINT "AplicacaoQuantidadeAulasModalidade_aplicadorId_fkey" FOREIGN KEY ("aplicadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION "validar_proposta_quantidade_aulas_179"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_ativo BOOLEAN; v_papeis "Papel"[]; v_decisao_aprovada BOOLEAN; v_aplicacao BOOLEAN;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT ativo, papeis INTO v_ativo, v_papeis FROM "Usuario" WHERE id=NEW."preparadorId";
    IF NOT COALESCE(v_ativo,false) OR NOT (v_papeis && ARRAY['SECRETARIA_ACADEMICA'::"Papel", 'GERENTE_PEDAGOGICO'::"Papel", 'ADMINISTRADOR'::"Papel"])
       OR NEW.versao <= 0 OR length(NEW."entradaHash") <> 64 OR length(NEW."estadoHash") <> 64
       OR jsonb_typeof(NEW.snapshot) <> 'object' OR jsonb_typeof(NEW.snapshot->'impactos') <> 'array' THEN
      RAISE EXCEPTION 'Proposta de quantidade de aulas inválida';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' OR (to_jsonb(NEW) - 'situacao') IS DISTINCT FROM (to_jsonb(OLD) - 'situacao') THEN RAISE EXCEPTION 'Proposta de quantidade de aulas é imutável'; END IF;
  IF OLD.situacao='PREPARADA' AND NEW.situacao IN ('REJEITADA','APROVADA') THEN
    SELECT aprovada INTO v_decisao_aprovada FROM "DecisaoQuantidadeAulasModalidade" WHERE "propostaId"=OLD.id;
    IF v_decisao_aprovada IS DISTINCT FROM (NEW.situacao='APROVADA') THEN RAISE EXCEPTION 'Transição de proposta sem decisão correspondente'; END IF;
  ELSIF OLD.situacao='APROVADA' AND NEW.situacao='APLICADA' THEN
    SELECT EXISTS(SELECT 1 FROM "AplicacaoQuantidadeAulasModalidade" WHERE "propostaId"=OLD.id) INTO v_aplicacao;
    IF NOT v_aplicacao THEN RAISE EXCEPTION 'Transição de proposta sem aplicação correspondente'; END IF;
  ELSE RAISE EXCEPTION 'Transição de proposta inválida'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "validar_proposta_quantidade_aulas_179" BEFORE INSERT OR UPDATE OR DELETE ON "PropostaQuantidadeAulasModalidade" FOR EACH ROW EXECUTE FUNCTION "validar_proposta_quantidade_aulas_179"();

CREATE OR REPLACE FUNCTION "preservar_impacto_quantidade_aulas_179"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Impacto de quantidade de aulas é imutável'; END $$;
CREATE TRIGGER "impacto_quantidade_aulas_preservado_179" BEFORE UPDATE OR DELETE ON "ImpactoQuantidadeAulasModalidade" FOR EACH ROW EXECUTE FUNCTION "preservar_impacto_quantidade_aulas_179"();
CREATE OR REPLACE FUNCTION "preservar_decisao_quantidade_aulas_179"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Decisão de quantidade de aulas é imutável'; END $$;
CREATE TRIGGER "decisao_quantidade_aulas_preservada_179" BEFORE UPDATE OR DELETE ON "DecisaoQuantidadeAulasModalidade" FOR EACH ROW EXECUTE FUNCTION "preservar_decisao_quantidade_aulas_179"();
CREATE OR REPLACE FUNCTION "preservar_aplicacao_quantidade_aulas_179"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Aplicação de quantidade de aulas é imutável'; END $$;
CREATE TRIGGER "aplicacao_quantidade_aulas_preservada_179" BEFORE UPDATE OR DELETE ON "AplicacaoQuantidadeAulasModalidade" FOR EACH ROW EXECUTE FUNCTION "preservar_aplicacao_quantidade_aulas_179"();

CREATE OR REPLACE FUNCTION "validar_decisao_quantidade_aulas_179"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_preparador TEXT; v_estado TEXT; v_ultimo TEXT; v_ativo BOOLEAN; v_papeis "Papel"[]; v_situacao "SituacaoPropostaQuantidadeAulas";
BEGIN
  SELECT "preparadorId", "estadoHash", situacao INTO v_preparador, v_estado, v_situacao FROM "PropostaQuantidadeAulasModalidade" WHERE id=NEW."propostaId";
  SELECT id INTO v_ultimo FROM "PropostaQuantidadeAulasModalidade" WHERE "modalidadeId"=(SELECT "modalidadeId" FROM "PropostaQuantidadeAulasModalidade" WHERE id=NEW."propostaId") ORDER BY versao DESC LIMIT 1;
  SELECT ativo, papeis INTO v_ativo, v_papeis FROM "Usuario" WHERE id=NEW."decisorId";
  IF v_preparador IS NULL OR v_situacao <> 'PREPARADA' OR (NEW.aprovada IS TRUE AND NEW."propostaId" <> v_ultimo) OR NEW."decisorId"=v_preparador OR NOT COALESCE(v_ativo,false) OR NOT (v_papeis && ARRAY['GERENTE_PEDAGOGICO'::"Papel", 'ADMINISTRADOR'::"Papel"]) OR length(trim(NEW.motivo)) < 5 OR NEW."estadoHash" IS DISTINCT FROM v_estado THEN RAISE EXCEPTION 'Decisão de quantidade de aulas inválida'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "validar_decisao_quantidade_aulas_179" BEFORE INSERT ON "DecisaoQuantidadeAulasModalidade" FOR EACH ROW EXECUTE FUNCTION "validar_decisao_quantidade_aulas_179"();

CREATE OR REPLACE FUNCTION "validar_aplicacao_quantidade_aulas_179"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_decisor TEXT; v_aprovada BOOLEAN; v_preparador TEXT; v_estado TEXT; v_situacao "SituacaoPropostaQuantidadeAulas"; v_ativo BOOLEAN; v_papeis "Papel"[];
BEGIN
  SELECT d."decisorId", d.aprovada, p."preparadorId", p."estadoHash", p.situacao INTO v_decisor, v_aprovada, v_preparador, v_estado, v_situacao FROM "PropostaQuantidadeAulasModalidade" p JOIN "DecisaoQuantidadeAulasModalidade" d ON d."propostaId"=p.id WHERE p.id=NEW."propostaId";
  SELECT ativo, papeis INTO v_ativo, v_papeis FROM "Usuario" WHERE id=NEW."aplicadorId";
  IF v_decisor IS NULL OR v_aprovada IS NOT TRUE OR v_situacao <> 'APROVADA' OR NEW."aplicadorId" <> v_decisor OR NEW."aplicadorId"=v_preparador OR NOT COALESCE(v_ativo,false) OR NOT (v_papeis && ARRAY['GERENTE_PEDAGOGICO'::"Papel", 'ADMINISTRADOR'::"Papel"]) OR NEW."estadoHash" IS DISTINCT FROM v_estado THEN RAISE EXCEPTION 'Aplicação de quantidade de aulas inválida'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "validar_aplicacao_quantidade_aulas_179" BEFORE INSERT ON "AplicacaoQuantidadeAulasModalidade" FOR EACH ROW EXECUTE FUNCTION "validar_aplicacao_quantidade_aulas_179"();

CREATE OR REPLACE FUNCTION "conferir_material_quantidade_aulas_179"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaQuantidadeAulasModalidade"%ROWTYPE; total_snapshot INTEGER; total_impactos INTEGER; divergente BOOLEAN; agenda_ausente BOOLEAN; agenda_excedente BOOLEAN; historico_alterado BOOLEAN;
BEGIN
  SELECT * INTO p FROM "PropostaQuantidadeAulasModalidade" WHERE id=NEW."propostaId";
  IF jsonb_typeof(p.snapshot->'impactos') IS DISTINCT FROM 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(p.snapshot->'impactos') s WHERE jsonb_typeof(s->'agendaAntes') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'agendaDepois') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'excecoesQ37') IS DISTINCT FROM 'array') THEN RAISE EXCEPTION 'Snapshot material incompleto'; END IF;
  IF p.situacao <> 'APLICADA' OR NOT EXISTS (SELECT 1 FROM "Modalidade" m WHERE m.id=p."modalidadeId" AND m."aulasPorNivel"=p."quantidadeNova") THEN RAISE EXCEPTION 'Aplicação sem meta material da modalidade'; END IF;
  SELECT jsonb_array_length(p.snapshot->'impactos'), count(*) INTO total_snapshot, total_impactos FROM "ImpactoQuantidadeAulasModalidade" WHERE "propostaId"=p.id;
  IF total_snapshot <> total_impactos THEN RAISE EXCEPTION 'Aplicação sem conjunto completo de impactos'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(p.snapshot->'impactos') s LEFT JOIN "ImpactoQuantidadeAulasModalidade" i ON i."propostaId"=p.id AND i."turmaId"=s->>'turmaId' WHERE i.id IS NULL OR i.alcance::text IS DISTINCT FROM s->>'alcance' OR i."quantidadeAnterior" <> (s->>'quantidadeAnterior')::int OR i."quantidadeNova" <> (s->>'quantidadeNova')::int OR i.publicada IS DISTINCT FROM (s->>'publicada')::boolean OR i."excecoesQ37" IS DISTINCT FROM COALESCE(s->'excecoesQ37','[]'::jsonb)) INTO divergente;
  IF divergente THEN RAISE EXCEPTION 'Aplicação diverge do impacto conferido'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(p.snapshot->'impactos') s, jsonb_array_elements(s->'agendaDepois') a WHERE (s->>'publicada')::boolean AND NOT EXISTS (SELECT 1 FROM "EncontroAgenda" e WHERE e."turmaId"=s->>'turmaId' AND e.inicio=((a->>'inicio')::timestamptz AT TIME ZONE 'UTC') AND e.fim=((a->>'fim')::timestamptz AT TIME ZONE 'UTC') AND e.status::text=a->>'status' AND e."professorId" IS NOT DISTINCT FROM a->>'professorId' AND e."propostaGradeId" IS NOT DISTINCT FROM a->>'propostaGradeId' AND (a->>'id' IS NULL OR e.id=a->>'id'))) INTO agenda_ausente;
  IF agenda_ausente THEN RAISE EXCEPTION 'Aplicação não materializou a agenda conferida'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(p.snapshot->'impactos') s WHERE (s->>'publicada')::boolean AND (SELECT count(*) FROM "EncontroAgenda" e WHERE e."turmaId"=s->>'turmaId') <> jsonb_array_length(s->'agendaDepois')) INTO agenda_excedente;
  IF agenda_excedente THEN RAISE EXCEPTION 'Aplicação possui encontro fora da agenda conferida'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p.snapshot->'impactos') s WHERE (s->>'publicada')::boolean IS FALSE AND NOT EXISTS (SELECT 1 FROM "PropostaGradeTurma" nova JOIN "PropostaGradeTurma" origem ON origem.id=s->>'propostaGradeId' WHERE nova."turmaId"=s->>'turmaId' AND nova."calendarioId"=origem."calendarioId" AND nova."chaveIdempotencia"=('quantidade-rascunho:' || p.id || ':' || (s->>'turmaId')) AND nova.snapshot->'origem'->>'quantidadeAulas'=s->>'quantidadeNova' AND jsonb_typeof(nova.snapshot->'grade'->'encontros')='array' AND jsonb_array_length(nova.snapshot->'grade'->'encontros')=jsonb_array_length(s->'agendaDepois') AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s->'agendaDepois') a WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(nova.snapshot->'grade'->'encontros') e WHERE e->>'inicio'=a->>'inicio' AND e->>'fim'=a->>'fim')))) THEN RAISE EXCEPTION 'Rascunho não materializou nova versão de grade conferida'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(p.snapshot->'impactos') s, jsonb_array_elements(s->'agendaAntes') a WHERE (((a->>'inicio')::timestamptz AT TIME ZONE 'UTC') <= NEW."aplicadaEm" OR a->>'status' IN ('MINISTRADO','NAO_REALIZADO','IMPEDIDO_ESCOLA','CANCELADO')) AND NOT EXISTS (SELECT 1 FROM "EncontroAgenda" e WHERE e.id=a->>'id' AND e."turmaId"=s->>'turmaId' AND e.inicio=((a->>'inicio')::timestamptz AT TIME ZONE 'UTC') AND e.fim=((a->>'fim')::timestamptz AT TIME ZONE 'UTC') AND e.status::text=a->>'status' AND e."professorId" IS NOT DISTINCT FROM a->>'professorId' AND e."propostaGradeId" IS NOT DISTINCT FROM a->>'propostaGradeId')) INTO historico_alterado;
  IF historico_alterado THEN RAISE EXCEPTION 'Aplicação alterou encontro histórico ou diário preservado'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "conferir_material_quantidade_aulas_179" AFTER INSERT ON "AplicacaoQuantidadeAulasModalidade" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "conferir_material_quantidade_aulas_179"();

CREATE OR REPLACE FUNCTION "conferir_decisao_quantidade_aulas_179"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.aprovada IS TRUE AND NOT EXISTS (SELECT 1 FROM "AplicacaoQuantidadeAulasModalidade" a WHERE a."propostaId"=NEW."propostaId" AND a."aplicadorId"=NEW."decisorId" AND a."estadoHash"=NEW."estadoHash") THEN
    RAISE EXCEPTION 'Decisão aprovada exige aplicação material na mesma transação';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "conferir_decisao_quantidade_aulas_179" AFTER INSERT ON "DecisaoQuantidadeAulasModalidade" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "conferir_decisao_quantidade_aulas_179"();
