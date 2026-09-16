CREATE OR REPLACE FUNCTION "guard_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."eventoId" IS NULL OR NEW."matriculaId" IS NULL OR NEW.situacao <> 'PREPARADO'::"SituacaoAvisoAlteracaoAgenda" THEN RAISE EXCEPTION 'Aviso exige origem aplicada e estado PREPARADO'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Evento" e WHERE e.id=NEW."eventoId" AND e."agregadoTipo"='Matricula' AND e."agregadoId"=NEW."matriculaId" AND e.tipo IN ('RemarcacaoParticularDecidida','RemarcacaoAgendaReposicaoDecidida') AND e.payload->>'aprovada'='true' AND e.payload ? 'encontroOriginalId' AND e.payload ? 'encontroNovoId' AND e.payload->>'encontroNovoId' IS NOT NULL) THEN RAISE EXCEPTION 'Origem do aviso inválida'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Matricula" m WHERE m.id=NEW."matriculaId" AND m."alunoId"=NEW."alunoId") THEN RAISE EXCEPTION 'Matrícula do aviso incompatível'; END IF;
  ELSE
    IF NEW."eventoId" IS DISTINCT FROM OLD."eventoId" OR NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId" OR NEW."alunoId" <> OLD."alunoId" OR NEW.canal <> OLD.canal OR NEW."contatoHash" <> OLD."contatoHash" OR NEW.chave<>OLD.chave OR NEW."mudancaId"<>OLD."mudancaId" OR NEW."criadoEm"<>OLD."criadoEm" THEN RAISE EXCEPTION 'Origem do aviso é imutável'; END IF;
    IF NOT ((OLD.situacao='PREPARADO' AND NEW.situacao IN ('INCERTO','FALHOU')) OR (OLD.situacao='INCERTO' AND NEW.situacao='ENVIADO')) AND NEW.situacao<>OLD.situacao THEN RAISE EXCEPTION 'Transição de aviso inválida'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "guard_aviso_alteracao_agenda" BEFORE INSERT OR UPDATE ON "AvisoAlteracaoAgenda" FOR EACH ROW EXECUTE FUNCTION "guard_aviso_alteracao_agenda"();

CREATE OR REPLACE FUNCTION "guard_item_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AvisoAlteracaoAgenda" a JOIN "EncontroAgenda" encontro ON encontro.id=NEW."encontroId" JOIN "Evento" evento ON evento.id=a."eventoId" WHERE a.id=NEW."avisoId" AND a.situacao='PREPARADO' AND encontro."matriculaId"=a."matriculaId" AND NEW."encontroId" IN (evento.payload->>'encontroOriginalId', evento.payload->>'encontroNovoId')) THEN RAISE EXCEPTION 'Item não pertence à alteração aplicada'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION "imutavel_item_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Itens de aviso são imutáveis'; END $$;
CREATE TRIGGER "imutavel_aviso_alteracao_agenda" BEFORE DELETE ON "AvisoAlteracaoAgenda" FOR EACH ROW EXECUTE FUNCTION "imutavel_item_aviso_alteracao_agenda"();
CREATE TRIGGER "guard_item_aviso_alteracao_agenda" BEFORE INSERT ON "ItemAvisoAlteracaoAgenda" FOR EACH ROW EXECUTE FUNCTION "guard_item_aviso_alteracao_agenda"();
CREATE TRIGGER "imutavel_item_aviso_alteracao_agenda" BEFORE UPDATE OR DELETE ON "ItemAvisoAlteracaoAgenda" FOR EACH ROW EXECUTE FUNCTION "imutavel_item_aviso_alteracao_agenda"();

CREATE OR REPLACE FUNCTION "guard_tentativa_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.situacao='ENVIADO'::"SituacaoAvisoAlteracaoAgenda") <> (NEW."provedorId" IS NOT NULL AND btrim(NEW."provedorId")<>'') THEN RAISE EXCEPTION 'Recibo exige tentativa ENVIADO'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "AvisoAlteracaoAgenda" a WHERE a.id=NEW."avisoId" AND a.situacao=NEW.situacao) THEN RAISE EXCEPTION 'Tentativa não corresponde ao estado atual'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "guard_tentativa_aviso_alteracao_agenda" BEFORE INSERT ON "TentativaAvisoAlteracaoAgenda" FOR EACH ROW EXECUTE FUNCTION "guard_tentativa_aviso_alteracao_agenda"();
CREATE TRIGGER "imutavel_tentativa_aviso_alteracao_agenda" BEFORE UPDATE OR DELETE ON "TentativaAvisoAlteracaoAgenda" FOR EACH ROW EXECUTE FUNCTION "imutavel_item_aviso_alteracao_agenda"();

CREATE OR REPLACE FUNCTION "conferir_estado_final_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.situacao='ENVIADO'::"SituacaoAvisoAlteracaoAgenda" AND NOT EXISTS (SELECT 1 FROM "TentativaAvisoAlteracaoAgenda" t WHERE t."avisoId"=NEW.id AND t.situacao='ENVIADO' AND t."provedorId" IS NOT NULL) THEN RAISE EXCEPTION 'Aviso enviado exige recibo'; END IF;
  IF NEW.situacao='INCERTO'::"SituacaoAvisoAlteracaoAgenda" AND NOT EXISTS (SELECT 1 FROM "TentativaAvisoAlteracaoAgenda" t WHERE t."avisoId"=NEW.id AND t.situacao='INCERTO') THEN RAISE EXCEPTION 'Aviso incerto exige tentativa'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "conferir_estado_final_aviso_alteracao_agenda" AFTER INSERT OR UPDATE ON "AvisoAlteracaoAgenda" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "conferir_estado_final_aviso_alteracao_agenda"();
