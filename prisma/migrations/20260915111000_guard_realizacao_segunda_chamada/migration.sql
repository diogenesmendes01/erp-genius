-- Q148/Q152: uma realização só reproduz o encontro reservado e o aplicador
-- que estava autorizado tanto agora quanto no instante do fato.
ALTER TABLE "RealizacaoSegundaChamada"
  ALTER COLUMN "criadaEm" SET DEFAULT (clock_timestamp() AT TIME ZONE 'UTC');

CREATE OR REPLACE FUNCTION preservar_realizacao_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserva "ReservaSegundaChamada"%ROWTYPE; fonte record; encontro record; agora TIMESTAMP;
        designado_atual TEXT; designado_historico TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Realização de segunda chamada é imutável'; END IF;
 SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id=NEW."reservaId" FOR UPDATE;
 IF NOT FOUND OR reserva.status<>'CONSUMIDA_REALIZACAO' THEN RAISE EXCEPTION 'Realização exige reserva consumida por realização'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT p.id AS "propostaId",p."matriculaId" AS "matriculaId",p."turmaId" AS "turmaId",p."regraId" AS "regraId",p."codigoAvaliacao" AS "codigoAvaliacao"
   INTO fonte FROM "PropostaSegundaChamada" p
   JOIN "AlocacaoTurma" alocacao ON alocacao.id=p."alocacaoId" AND alocacao."matriculaId"=p."matriculaId" AND alocacao."turmaId"=p."turmaId"
   JOIN "Turma" turma ON turma.id=p."turmaId" AND turma."regraAvaliacaoId"=p."regraId"
   WHERE p.id=reserva."propostaId" FOR SHARE OF p,alocacao,turma;
 IF NOT FOUND OR (reserva."matriculaId",reserva."regraId",reserva."codigoAvaliacao")
   IS DISTINCT FROM (fonte."matriculaId",fonte."regraId",fonte."codigoAvaliacao") THEN
  RAISE EXCEPTION 'Realização exige fonte exata da reserva';
 END IF;
 SELECT e.id,e."matriculaId" AS "matriculaId",e."turmaId" AS "turmaId",e."professorId" AS "professorId",e.inicio,e.fim,e.status,e.finalidade
   INTO encontro FROM "AgendaSegundaChamada" agenda JOIN "EncontroAgenda" e ON e.id=agenda."encontroId"
   WHERE agenda."reservaId"=reserva.id FOR SHARE OF agenda,e;
 IF NOT FOUND OR encontro.finalidade<>'SEGUNDA_CHAMADA' OR encontro.status<>'PREVISTO'
   OR encontro."matriculaId" IS DISTINCT FROM fonte."matriculaId" OR encontro."turmaId" IS DISTINCT FROM fonte."turmaId"
   OR encontro."professorId" IS DISTINCT FROM NEW."professorId" OR NEW."professorId" IS DISTINCT FROM NEW."registradaPorId" THEN
  RAISE EXCEPTION 'Realização exige encontro de segunda chamada e aplicador exatos';
 END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."professorId" AND ativo AND 'PROFESSOR'::"Papel"=ANY(papeis) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Realização exige professor ativo'; END IF;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF NEW."realizadaEm" IS NULL OR NOT isfinite(NEW."realizadaEm") OR NOT isfinite(reserva."reservadaEm")
   OR encontro.inicio IS NULL OR encontro.fim IS NULL OR NOT isfinite(encontro.inicio) OR NOT isfinite(encontro.fim)
   OR NEW."realizadaEm">agora OR NEW."realizadaEm"<reserva."reservadaEm"
   OR NEW."realizadaEm"<encontro.inicio OR NEW."realizadaEm">=encontro.fim THEN
  RAISE EXCEPTION 'Data da realização fora do encontro reservado';
 END IF;
 IF NEW.evidencia IS NULL OR length(btrim(NEW.evidencia))<5 OR length(NEW.evidencia)>4000 THEN RAISE EXCEPTION 'Evidência da realização inválida'; END IF;
 designado_atual:=professor_segunda_chamada_no_instante(fonte."propostaId",agora);
 designado_historico:=professor_segunda_chamada_no_instante(fonte."propostaId",NEW."realizadaEm");
 IF NOT (
   (EXISTS (SELECT 1 FROM "Turma" turma JOIN "VinculoDocente" vinculo ON vinculo."turmaId"=turma.id
      WHERE turma.id=fonte."turmaId" AND turma."professorId"=NEW."professorId" AND turma.status<>'CONCLUIDA'
        AND vinculo."professorId"=NEW."professorId" AND vinculo.inicio<=agora AND vinculo.fim IS NULL)
    OR designado_atual IS NOT DISTINCT FROM NEW."professorId")
   AND
   (EXISTS (SELECT 1 FROM "VinculoDocente" vinculo WHERE vinculo."turmaId"=fonte."turmaId" AND vinculo."professorId"=NEW."professorId"
      AND vinculo.inicio<=NEW."realizadaEm" AND (vinculo.fim IS NULL OR vinculo.fim>NEW."realizadaEm"))
    OR designado_historico IS NOT DISTINCT FROM NEW."professorId")
 ) THEN RAISE EXCEPTION 'Professor sem atribuição atual ou histórica para realização'; END IF;
 IF EXISTS (SELECT 1 FROM "IndisponibilidadeDocente" indisponibilidade
   JOIN "DecisaoIndisponibilidadeDocente" decisao ON decisao."indisponibilidadeId"=indisponibilidade.id AND decisao.aprovada
   WHERE indisponibilidade."professorId"=NEW."professorId" AND indisponibilidade.inicio<=NEW."realizadaEm" AND indisponibilidade.fim>NEW."realizadaEm") THEN
  RAISE EXCEPTION 'Professor possui indisponibilidade aprovada no instante da realização';
 END IF;
 NEW."criadaEm":=agora;
 RETURN NEW;
END $$;

CREATE TRIGGER conferir_realizacao_segunda_chamada_insert
BEFORE INSERT ON "RealizacaoSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION preservar_realizacao_segunda_chamada();
