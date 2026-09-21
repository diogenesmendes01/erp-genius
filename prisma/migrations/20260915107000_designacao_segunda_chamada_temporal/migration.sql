-- Q152: a última designação conhecida prevalece mesmo se já não cobrir o instante.
-- Para agenda futura, não antecipa versões cuja criação ainda não ocorreu.
CREATE FUNCTION professor_segunda_chamada_no_instante(proposta_id TEXT, instante TIMESTAMP)
RETURNS TEXT LANGUAGE plpgsql VOLATILE AS $$
DECLARE designacao "DesignacaoSegundaChamada"%ROWTYPE;
BEGIN
 IF proposta_id IS NULL OR instante IS NULL OR NOT isfinite(instante) THEN RETURN NULL; END IF;
 SELECT d.* INTO designacao
 FROM "DesignacaoSegundaChamada" d
 WHERE d."propostaId"=proposta_id
   AND d."criadaEm"<=LEAST(instante,clock_timestamp() AT TIME ZONE 'UTC')
 ORDER BY d.versao DESC
 LIMIT 1
 FOR SHARE;
 IF NOT FOUND OR designacao.inicio>instante
    OR (designacao.fim IS NOT NULL AND designacao.fim<=instante) THEN
  RETURN NULL;
 END IF;
 RETURN designacao."professorId";
END $$;

CREATE OR REPLACE FUNCTION autoria_segunda_chamada_valida(
  registro_id TEXT, realizacao_id TEXT, autor_id TEXT, realizada_por_id TEXT, realizada_em TIMESTAMP
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE proposta_id TEXT; professor_atual TEXT; professor_historico TEXT;
BEGIN
 IF autor_id IS NULL OR autor_id IS DISTINCT FROM realizada_por_id
    OR NOT nota_segunda_chamada_autorizada(registro_id,realizacao_id,realizada_em,realizada_por_id) THEN
  RETURN false;
 END IF;
 SELECT p.id INTO proposta_id FROM "RealizacaoSegundaChamada" sc
   JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId"
   JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId"
   WHERE sc.id=realizacao_id FOR KEY SHARE OF sc,rs,p;
 IF NOT FOUND THEN RETURN false; END IF;
 professor_atual:=professor_segunda_chamada_no_instante(proposta_id,clock_timestamp() AT TIME ZONE 'UTC');
 professor_historico:=professor_segunda_chamada_no_instante(proposta_id,realizada_em);
 RETURN COALESCE(professor_atual=autor_id AND professor_historico=autor_id,false);
END $$;

CREATE OR REPLACE FUNCTION autoria_segunda_chamada_valida(
  registro_id TEXT, realizacao_id TEXT, autor_id TEXT, realizada_por_id TEXT, realizada_em TIMESTAMP, motivo TEXT, evidencias TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE proposta_id TEXT; designado_atual TEXT; designado_historico TEXT;
BEGIN
 IF autor_id IS NULL OR realizada_por_id IS NULL
    OR NOT nota_segunda_chamada_autorizada(registro_id,realizacao_id,realizada_em,realizada_por_id) THEN RETURN false; END IF;
 SELECT p.id INTO proposta_id FROM "RealizacaoSegundaChamada" sc JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId" JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE sc.id=realizacao_id FOR KEY SHARE OF sc,rs,p;
 IF NOT FOUND THEN RETURN false; END IF;
 designado_historico:=professor_segunda_chamada_no_instante(proposta_id,realizada_em);
 IF autor_id=realizada_por_id THEN
  IF motivo IS NOT NULL OR evidencias IS NOT NULL THEN RETURN false; END IF;
  designado_atual:=professor_segunda_chamada_no_instante(proposta_id,clock_timestamp() AT TIME ZONE 'UTC');
  RETURN COALESCE(designado_atual=autor_id AND designado_historico=autor_id,false);
 END IF;
 IF COALESCE(length(btrim(motivo)),0)<5 OR COALESCE(length(btrim(evidencias)),0)<5 OR length(motivo)>2000 OR length(evidencias)>4000 OR designado_historico IS DISTINCT FROM realizada_por_id THEN RETURN false; END IF;
 SELECT d."professorId" INTO designado_atual FROM "DesignacaoAvaliacao" d WHERE d."registroId"=registro_id ORDER BY d.versao DESC LIMIT 1 FOR SHARE;
 RETURN COALESCE(designado_atual=autor_id,false);
END $$;

CREATE OR REPLACE FUNCTION "guard_agenda_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; e record; u record;
BEGIN
 SELECT rs.*,p."matriculaId",p."turmaId" INTO r FROM "ReservaSegundaChamada" rs JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE rs.id=NEW."reservaId" FOR KEY SHARE;
 SELECT id,"matriculaId","turmaId","professorId",inicio,fim,status,finalidade INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR KEY SHARE;
 IF NOT FOUND OR e.finalidade<>'SEGUNDA_CHAMADA' OR e.status<>'PREVISTO' OR e."matriculaId" IS DISTINCT FROM r."matriculaId" OR e."turmaId" IS DISTINCT FROM r."turmaId" THEN RAISE EXCEPTION 'agenda exige encontro SEGUNDA_CHAMADA previsto do vínculo exato'; END IF;
 IF e."professorId" IS NULL THEN RAISE EXCEPTION 'agenda exige professor identificado'; END IF;
 SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=e."professorId" FOR SHARE; IF NOT FOUND OR NOT u.ativo OR NOT ('PROFESSOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'professor da agenda precisa estar ativo'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "VinculoDocente" v WHERE v."turmaId"=e."turmaId" AND v."professorId"=e."professorId" AND v.inicio<=e.inicio AND (v.fim IS NULL OR v.fim>e.inicio))
    AND professor_segunda_chamada_no_instante(r."propostaId",e.inicio) IS DISTINCT FROM e."professorId" THEN
  RAISE EXCEPTION 'professor sem escopo para segunda chamada';
 END IF;
 RETURN NEW;
END $$;
