-- Guards executáveis da segunda chamada. Aplicar somente após segunda-chamada-ddl-gerado.sql.
CREATE OR REPLACE FUNCTION "guard_segunda_chamada_link_nota"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; v record;
BEGIN
  IF NEW."segundaChamadaRealizacaoId" IS NULL THEN RETURN NEW; END IF;
  SELECT sc.*, rs.status, p."matriculaId",p."alocacaoId",p."regraId",p."codigoAvaliacao"
    INTO r FROM "RealizacaoSegundaChamada" sc JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId"
    JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE sc.id=NEW."segundaChamadaRealizacaoId" FOR KEY SHARE;
  IF NOT FOUND OR r.status <> 'CONSUMIDA_REALIZACAO' THEN RAISE EXCEPTION 'realização de segunda chamada não consumida'; END IF;
  SELECT ra."matriculaId",ra."alocacaoId",ra."regraId",ra."codigoAvaliacao" INTO v FROM "RegistroAvaliacaoMatricula" ra WHERE ra.id=NEW."registroId";
  IF NOT FOUND OR (v."matriculaId",v."alocacaoId",v."regraId",v."codigoAvaliacao") IS DISTINCT FROM (r."matriculaId",r."alocacaoId",r."regraId",r."codigoAvaliacao") THEN RAISE EXCEPTION 'lançamento não pertence à realização de segunda chamada'; END IF;
  IF NEW."realizadaPorId" IS DISTINCT FROM r."professorId" OR NEW."realizadaEm" IS DISTINCT FROM r."realizadaEm" THEN RAISE EXCEPTION 'autoria e data da realização são imutáveis'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "trg_segunda_chamada_link_nota" BEFORE INSERT OR UPDATE OF "segundaChamadaRealizacaoId","registroId","realizadaPorId","realizadaEm" ON "VersaoLancamentoAvaliacao" FOR EACH ROW EXECUTE FUNCTION "guard_segunda_chamada_link_nota"();

CREATE OR REPLACE FUNCTION "guard_segunda_chamada_reserva"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE limite integer; extras integer; ocupadas integer; p record; e record;
BEGIN
 SELECT * INTO p FROM "PropostaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 IF NOT FOUND OR (SELECT aprovada FROM "DecisaoSegundaChamada" WHERE "propostaId"=p.id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'reserva exige proposta aprovada'; END IF;
 IF NEW."matriculaId"<>p."matriculaId" OR NEW."regraId"<>p."regraId" OR NEW."codigoAvaliacao"<>p."codigoAvaliacao" THEN RAISE EXCEPTION 'contexto da reserva diverge da proposta'; END IF;
 SELECT COALESCE((r.conteudo->'avaliacoes'->(SELECT ordinality-1 FROM jsonb_array_elements(r.conteudo->'avaliacoes') WITH ORDINALITY x(v,ordinality) WHERE x.v->>'codigo'=p."codigoAvaliacao" LIMIT 1)->>'limiteSegundasChamadas')::integer,-1) INTO limite FROM "VersaoRegraAvaliacao" r WHERE r.id=p."regraId";
 IF limite IS NULL OR limite<0 THEN RAISE EXCEPTION 'limite da segunda chamada não configurado'; END IF;
 SELECT COALESCE(sum(x.quantidade),0) INTO extras FROM "PropostaExtraSegundaChamada" x JOIN "DecisaoExtraSegundaChamada" d ON d."propostaId"=x.id AND d.aprovada WHERE x."matriculaId"=NEW."matriculaId" AND x."regraId"=NEW."regraId" AND x."codigoAvaliacao"=NEW."codigoAvaliacao";
 PERFORM pg_advisory_xact_lock(hashtextextended('segunda:'||NEW."matriculaId"||':'||NEW."regraId"||':'||NEW."codigoAvaliacao",0));
 SELECT count(*) INTO ocupadas FROM "ReservaSegundaChamada" WHERE "matriculaId"=NEW."matriculaId" AND "regraId"=NEW."regraId" AND "codigoAvaliacao"=NEW."codigoAvaliacao" AND status IN ('RESERVADA','CONSUMIDA_REALIZACAO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO');
 IF ocupadas >= limite+extras THEN RAISE EXCEPTION 'saldo de segunda chamada esgotado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "trg_segunda_chamada_reserva" BEFORE INSERT ON "ReservaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION "guard_segunda_chamada_reserva"();

CREATE OR REPLACE FUNCTION "guard_agenda_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; e record;
BEGIN
 SELECT rs.*,p."matriculaId",p."turmaId" INTO r FROM "ReservaSegundaChamada" rs JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE rs.id=NEW."reservaId" FOR KEY SHARE;
 SELECT id,"matriculaId","turmaId",status,finalidade INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR KEY SHARE;
 IF NOT FOUND OR e.finalidade<>'SEGUNDA_CHAMADA' OR e.status<>'PREVISTO' OR e."matriculaId" IS DISTINCT FROM r."matriculaId" OR e."turmaId" IS DISTINCT FROM r."turmaId" THEN RAISE EXCEPTION 'agenda exige encontro SEGUNDA_CHAMADA previsto do vínculo exato'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "trg_agenda_segunda_chamada" BEFORE INSERT OR UPDATE OF "reservaId","encontroId" ON "AgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION "guard_agenda_segunda_chamada"();

CREATE OR REPLACE FUNCTION "guard_decisao_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record;
BEGIN SELECT * INTO p FROM "PropostaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE; IF NOT FOUND OR p."autorId"=NEW."decisorId" THEN RAISE EXCEPTION 'decisão exige proposta e decisor independente'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "trg_decisao_segunda_chamada" BEFORE INSERT ON "DecisaoSegundaChamada" FOR EACH ROW EXECUTE FUNCTION "guard_decisao_segunda_chamada"();

-- Revisão adversarial: estes CREATE OR REPLACE substituem as versões iniciais acima.
CREATE OR REPLACE FUNCTION "guard_decisao_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; u record;
BEGIN
 SELECT * INTO p FROM "PropostaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR KEY SHARE;
 IF NOT FOUND OR p."autorId"=NEW."decisorId" OR NOT u.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'decisor ativo e independente da gestão é obrigatório'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_segunda_chamada_link_nota"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; v record;
BEGIN
 IF NEW."segundaChamadaRealizacaoId" IS NULL THEN RETURN NEW; END IF;
 SELECT sc.*,rs.status,p."matriculaId",p."alocacaoId",p."regraId",p."codigoAvaliacao" INTO r FROM "RealizacaoSegundaChamada" sc JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId" JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE sc.id=NEW."segundaChamadaRealizacaoId" FOR KEY SHARE;
 SELECT "matriculaId","alocacaoId","regraId","codigoAvaliacao" INTO v FROM "RegistroAvaliacaoMatricula" WHERE id=NEW."registroId";
 IF NOT FOUND OR r.status<>'CONSUMIDA_REALIZACAO' OR (v."matriculaId",v."alocacaoId",v."regraId",v."codigoAvaliacao") IS DISTINCT FROM (r."matriculaId",r."alocacaoId",r."regraId",r."codigoAvaliacao") OR NEW."realizadaPorId" IS DISTINCT FROM r."professorId" OR NEW."realizadaEm" IS DISTINCT FROM r."realizadaEm" THEN RAISE EXCEPTION 'vínculo da nota original de segunda chamada inválido'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_oficializacao_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v record;
BEGIN
 SELECT l."autorId",l."realizadaPorId",l."segundaChamadaRealizacaoId" INTO v FROM "VersaoLancamentoAvaliacao" l WHERE l.id=NEW."lancamentoId" FOR KEY SHARE;
 IF v."segundaChamadaRealizacaoId" IS NOT NULL AND (NEW."decisorId"=v."autorId" OR NEW."decisorId"=v."realizadaPorId") THEN RAISE EXCEPTION 'realizador ou autor não pode oficializar a própria segunda chamada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "trg_oficializacao_segunda_chamada" BEFORE INSERT ON "DecisaoLancamentoAvaliacao" FOR EACH ROW EXECUTE FUNCTION "guard_oficializacao_segunda_chamada"();

CREATE OR REPLACE FUNCTION "guard_segunda_chamada_reserva"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; limite integer; extras integer; ocupadas integer; prazo timestamptz;
BEGIN
 SELECT p.*,d.aprovada AS aprovada,s.id AS disponibilizacao_id INTO p FROM "PropostaSegundaChamada" p LEFT JOIN "DecisaoSegundaChamada" d ON d."propostaId"=p.id LEFT JOIN "DisponibilizacaoSegundaChamada" s ON s."propostaId"=p.id WHERE p.id=NEW."propostaId" FOR KEY SHARE;
 IF NOT FOUND OR p.aprovada IS DISTINCT FROM true OR p.disponibilizacao_id IS NULL OR NEW."matriculaId"<>p."matriculaId" OR NEW."regraId"<>p."regraId" OR NEW."codigoAvaliacao"<>p."codigoAvaliacao" THEN RAISE EXCEPTION 'reserva exige proposta aprovada e disponibilizada no contexto exato'; END IF;
 SELECT (a->>'limiteSegundasChamadas')::integer INTO limite FROM "VersaoRegraAvaliacao" r CROSS JOIN LATERAL jsonb_array_elements(r.conteudo->'avaliacoes') a WHERE r.id=p."regraId" AND a->>'codigo'=p."codigoAvaliacao";
 IF limite IS NULL THEN RAISE EXCEPTION 'limite não configurado'; END IF;
 SELECT COALESCE(max(x."novoPrazo"),s."prazoAte") INTO prazo FROM "DisponibilizacaoSegundaChamada" s LEFT JOIN "PropostaProrrogacaoSegundaChamada" x ON x."disponibilizacaoId"=s.id LEFT JOIN "DecisaoProrrogacaoSegundaChamada" xd ON xd."propostaId"=x.id AND xd.aprovada WHERE s.id=p.disponibilizacao_id GROUP BY s."prazoAte";
 IF clock_timestamp()>=prazo THEN RAISE EXCEPTION 'prazo da segunda chamada vencido não permite reserva'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Matricula" m ON m.id=a."matriculaId" WHERE a.id=p."alocacaoId" AND a.ativa AND m.status='ATIVA') THEN RAISE EXCEPTION 'reserva exige vínculo e matrícula ativos'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('segunda:'||NEW."matriculaId"||':'||NEW."regraId"||':'||NEW."codigoAvaliacao",0));
 SELECT COALESCE(sum(x.quantidade),0) INTO extras FROM "PropostaExtraSegundaChamada" x JOIN "DecisaoExtraSegundaChamada" d ON d."propostaId"=x.id AND d.aprovada WHERE x."matriculaId"=NEW."matriculaId" AND x."regraId"=NEW."regraId" AND x."codigoAvaliacao"=NEW."codigoAvaliacao";
 SELECT count(*) INTO ocupadas FROM "ReservaSegundaChamada" WHERE "matriculaId"=NEW."matriculaId" AND "regraId"=NEW."regraId" AND "codigoAvaliacao"=NEW."codigoAvaliacao" AND status IN ('RESERVADA','CONSUMIDA_REALIZACAO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO');
 IF ocupadas>=limite+extras THEN RAISE EXCEPTION 'saldo de segunda chamada esgotado'; END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_agenda_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; e record; u record;
BEGIN
 SELECT rs.*,p."matriculaId",p."turmaId" INTO r FROM "ReservaSegundaChamada" rs JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE rs.id=NEW."reservaId" FOR KEY SHARE;
 SELECT id,"matriculaId","turmaId","professorId",inicio,fim,status,finalidade INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR KEY SHARE;
 IF NOT FOUND OR e.finalidade<>'SEGUNDA_CHAMADA' OR e.status<>'PREVISTO' OR e."matriculaId" IS DISTINCT FROM r."matriculaId" OR e."turmaId" IS DISTINCT FROM r."turmaId" THEN RAISE EXCEPTION 'agenda exige encontro SEGUNDA_CHAMADA previsto do vínculo exato'; END IF;
 IF e."professorId" IS NULL THEN RAISE EXCEPTION 'agenda exige professor identificado'; END IF;
 SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=e."professorId"; IF NOT FOUND OR NOT u.ativo OR NOT ('PROFESSOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'professor da agenda precisa estar ativo'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "VinculoDocente" v WHERE v."turmaId"=e."turmaId" AND v."professorId"=e."professorId" AND v.inicio<=e.inicio AND (v.fim IS NULL OR v.fim>e.inicio)) AND NOT EXISTS (SELECT 1 FROM "DesignacaoSegundaChamada" d WHERE d."propostaId"=r."propostaId" AND d."professorId"=e."professorId" AND d.inicio<=e.inicio AND (d.fim IS NULL OR d.fim>e.inicio)) THEN RAISE EXCEPTION 'professor sem escopo para segunda chamada'; END IF;
 RETURN NEW;
END $$;

-- Correção: só a maior prorrogação APROVADA é vigente; a reserva especial Q151 substitui
-- a exigência de matrícula ativa somente para a pendência e o prazo identificados.
CREATE OR REPLACE FUNCTION "guard_segunda_chamada_reserva"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta record; limite integer; extras integer; ocupadas integer; prazo timestamp(3); especial boolean;
BEGIN
 SELECT ps.*, ds.aprovada AS decisao_aprovada, disp.id AS disponibilizacao_id INTO proposta
 FROM "PropostaSegundaChamada" ps LEFT JOIN "DecisaoSegundaChamada" ds ON ds."propostaId"=ps.id LEFT JOIN "DisponibilizacaoSegundaChamada" disp ON disp."propostaId"=ps.id
 WHERE ps.id=NEW."propostaId" FOR KEY SHARE OF ps;
 IF NOT FOUND OR proposta.decisao_aprovada IS DISTINCT FROM true OR proposta.disponibilizacao_id IS NULL OR NEW."matriculaId"<>proposta."matriculaId" OR NEW."regraId"<>proposta."regraId" OR NEW."codigoAvaliacao"<>proposta."codigoAvaliacao" THEN RAISE EXCEPTION 'reserva exige proposta aprovada e disponibilizada no contexto exato'; END IF;
 SELECT (item->>'limiteSegundasChamadas')::integer INTO limite FROM "VersaoRegraAvaliacao" regra CROSS JOIN LATERAL jsonb_array_elements(regra.conteudo->'avaliacoes') item WHERE regra.id=proposta."regraId" AND item->>'codigo'=proposta."codigoAvaliacao";
 IF limite IS NULL THEN RAISE EXCEPTION 'limite não configurado'; END IF;
 SELECT COALESCE((SELECT pr."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" pr JOIN "DecisaoProrrogacaoSegundaChamada" dp ON dp."propostaId"=pr.id AND dp.aprovada WHERE pr."disponibilizacaoId"=proposta.disponibilizacao_id ORDER BY pr.versao DESC LIMIT 1), disp."prazoAte") INTO prazo FROM "DisponibilizacaoSegundaChamada" disp WHERE disp.id=proposta.disponibilizacao_id;
 IF prazo IS NULL OR clock_timestamp()::timestamp(3)>=prazo THEN RAISE EXCEPTION 'prazo da segunda chamada vencido não permite reserva'; END IF;
 SELECT EXISTS(SELECT 1 FROM "AutorizacaoEspecialSegundaChamada" ae WHERE ae."alocacaoId"=proposta."alocacaoId" AND ae."regraId"=proposta."regraId" AND ae."codigoAvaliacao"=proposta."codigoAvaliacao" AND ae."prazoAte">clock_timestamp()::timestamp(3)) INTO especial;
 IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" al JOIN "Matricula" ma ON ma.id=al."matriculaId" WHERE al.id=proposta."alocacaoId" AND al.ativa AND ma.status='ATIVA') AND NOT especial THEN RAISE EXCEPTION 'reserva exige vínculo/matrícula ativos ou autorização especial vigente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('segunda:'||NEW."matriculaId"||':'||NEW."regraId"||':'||NEW."codigoAvaliacao",0));
 SELECT COALESCE(sum(pe.quantidade),0) INTO extras FROM "PropostaExtraSegundaChamada" pe JOIN "DecisaoExtraSegundaChamada" de ON de."propostaId"=pe.id AND de.aprovada WHERE pe."matriculaId"=NEW."matriculaId" AND pe."regraId"=NEW."regraId" AND pe."codigoAvaliacao"=NEW."codigoAvaliacao";
 SELECT count(*) INTO ocupadas FROM "ReservaSegundaChamada" WHERE "matriculaId"=NEW."matriculaId" AND "regraId"=NEW."regraId" AND "codigoAvaliacao"=NEW."codigoAvaliacao" AND status IN ('RESERVADA','CONSUMIDA_REALIZACAO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO');
 IF ocupadas>=limite+extras THEN RAISE EXCEPTION 'saldo de segunda chamada esgotado'; END IF; RETURN NEW;
END $$;

-- Próximo guard incremental: a segunda chamada é o único encontro que pertence à
-- turma e à matrícula exatas; o formato legado de aula/recuperação continua
-- exclusivo em todos os outros propósitos.
ALTER TABLE "EncontroAgenda" DROP CONSTRAINT IF EXISTS "EncontroAgenda_check";
ALTER TABLE "EncontroAgenda" ADD CONSTRAINT "EncontroAgenda_contexto_finalidade_check" CHECK (
  (("turmaId" IS NOT NULL) <> ("matriculaId" IS NOT NULL))
  OR (finalidade = 'SEGUNDA_CHAMADA'::"FinalidadeEncontroAgenda" AND "turmaId" IS NOT NULL AND "matriculaId" IS NOT NULL)
);
ALTER TABLE "EncontroAgenda" DROP CONSTRAINT IF EXISTS "encontro_recuperacao_individual";
ALTER TABLE "EncontroAgenda" ADD CONSTRAINT "encontro_finalidade_contexto_check" CHECK (
  finalidade IN ('AULA'::"FinalidadeEncontroAgenda", 'SEGUNDA_CHAMADA'::"FinalidadeEncontroAgenda")
  OR ("matriculaId" IS NOT NULL AND "turmaId" IS NULL)
);
