-- Q151: uma nota original vinculada a uma segunda chamada só pode representar
-- a realização imutável já registrada. Em pausa/encerramento, a autorização
-- precisa ter vigência no instante daquele fato, e não no instante da nota.
CREATE OR REPLACE FUNCTION "guard_segunda_chamada_link_nota"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE realizacao record; lancamento record; situacao TEXT;
BEGIN
 IF NEW."segundaChamadaRealizacaoId" IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));

 SELECT sc.*,rs.status,p."matriculaId",p."alocacaoId",p."regraId",p."codigoAvaliacao"
   INTO realizacao
   FROM "RealizacaoSegundaChamada" sc
   JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId"
   JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId"
   JOIN "Matricula" m ON m.id=p."matriculaId"
   WHERE sc.id=NEW."segundaChamadaRealizacaoId"
   FOR KEY SHARE OF sc,rs,p,m;
 IF NOT FOUND THEN RAISE EXCEPTION 'realização de segunda chamada não encontrada'; END IF;

 SELECT "matriculaId","alocacaoId","regraId","codigoAvaliacao" INTO lancamento
   FROM "RegistroAvaliacaoMatricula" WHERE id=NEW."registroId" FOR KEY SHARE;
 IF NOT FOUND
    OR realizacao.status<>'CONSUMIDA_REALIZACAO'
    OR (lancamento."matriculaId",lancamento."alocacaoId",lancamento."regraId",lancamento."codigoAvaliacao")
       IS DISTINCT FROM (realizacao."matriculaId",realizacao."alocacaoId",realizacao."regraId",realizacao."codigoAvaliacao")
    OR NEW."realizadaPorId" IS DISTINCT FROM realizacao."professorId"
    OR NEW."realizadaEm" IS DISTINCT FROM realizacao."realizadaEm" THEN
   RAISE EXCEPTION 'vínculo da nota original de segunda chamada inválido';
 END IF;

 SELECT situacao_matricula_no_instante(realizacao."matriculaId",realizacao."realizadaEm") INTO situacao;
 IF situacao='ATIVA' THEN RETURN NEW; END IF;
 IF situacao IN ('PAUSADA','ENCERRADA')
    AND autorizacao_especial_segunda_chamada_valida(
      realizacao."alocacaoId",realizacao."codigoAvaliacao",realizacao."realizadaEm"
    ) THEN
   RETURN NEW;
 END IF;
 IF situacao='A_CONFERIR' THEN RAISE EXCEPTION 'Histórico contratual da nota de segunda chamada exige conferência'; END IF;
 RAISE EXCEPTION 'Nota de segunda chamada pausada ou encerrada exige autorização especial válida na data da realização';
END $$;
