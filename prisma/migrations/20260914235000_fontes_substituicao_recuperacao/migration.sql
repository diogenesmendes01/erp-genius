-- Estado mínimo e determinístico das fontes que podem tornar uma substituição obsoleta.
CREATE FUNCTION estado_fontes_substituicao_recuperacao(alocacao_id TEXT) RETURNS JSONB LANGUAGE sql STABLE AS $$
 WITH base AS (
  SELECT "matriculaId", "nivelId", "regraId" FROM "PropostaPlanoRecuperacao" WHERE "alocacaoId"=alocacao_id ORDER BY "criadaEm" DESC LIMIT 1
 )
 SELECT jsonb_build_object(
  'regulares', COALESCE((
   SELECT jsonb_agg(jsonb_build_object('registroId',registro.id,'lancamentoId',lancamento.id,'decisaoId',decisao.id,'correcaoId',correcao.id) ORDER BY registro."codigoAvaliacao",registro.id)
   FROM "RegistroAvaliacaoMatricula" registro
   LEFT JOIN LATERAL (SELECT * FROM "VersaoLancamentoAvaliacao" WHERE "registroId"=registro.id ORDER BY versao DESC LIMIT 1) lancamento ON true
   LEFT JOIN "DecisaoLancamentoAvaliacao" decisao ON decisao."lancamentoId"=lancamento.id
   LEFT JOIN LATERAL (SELECT correcao.id FROM "PropostaCorrecaoNota" correcao JOIN "DecisaoCorrecaoNota" decisao_correcao ON decisao_correcao."propostaId"=correcao.id AND decisao_correcao.aprovada WHERE correcao."lancamentoId"=lancamento.id ORDER BY correcao.versao DESC LIMIT 1) correcao ON true
   WHERE registro."alocacaoId"=alocacao_id
  ),'[]'::jsonb),
  'recuperacoes', COALESCE((
   SELECT jsonb_agg(jsonb_build_object('realizacaoId',realizacao.id,'notaId',nota.id,'decisaoId',decisao_nota.id,'correcaoId',correcao.id) ORDER BY realizacao."realizadaEm",realizacao.id)
   FROM "RealizacaoRecuperacao" realizacao
   JOIN "ItemReservaTentativaRecuperacao" item ON item.id=realizacao."itemReservaId"
   JOIN "ReservaTentativaRecuperacao" reserva ON reserva.id=item."reservaId"
   JOIN "PropostaPlanoRecuperacao" plano ON plano.id=reserva."propostaId"
   JOIN base ON base."matriculaId"=plano."matriculaId" AND base."nivelId"=plano."nivelId" AND base."regraId"=plano."regraId"
   LEFT JOIN LATERAL (SELECT * FROM "NotaRecuperacao" WHERE "realizacaoId"=realizacao.id ORDER BY versao DESC LIMIT 1) nota ON true
   LEFT JOIN "DecisaoNotaRecuperacao" decisao_nota ON decisao_nota."notaId"=nota.id
   LEFT JOIN LATERAL (SELECT correcao.id FROM "PropostaCorrecaoRecuperacao" correcao JOIN "DecisaoCorrecaoRecuperacao" decisao_correcao ON decisao_correcao."propostaId"=correcao.id AND decisao_correcao.aprovada WHERE correcao."notaId"=nota.id ORDER BY correcao.versao DESC LIMIT 1) correcao ON true
   WHERE plano."alocacaoId"=alocacao_id AND nota.id IS NOT NULL
  ),'[]'::jsonb)
 );
$$;

CREATE FUNCTION conferir_fontes_substituicao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaSubstituicaoRecuperacao"%ROWTYPE; alocacao_id TEXT; atual JSONB;
BEGIN
 IF TG_OP<>'INSERT' OR NOT NEW.aprovada THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO proposta FROM "PropostaSubstituicaoRecuperacao" WHERE id=NEW."propostaId";
 SELECT plano."alocacaoId" INTO alocacao_id FROM "EncontroAgenda" encontro JOIN "PropostaAgendaRecuperacao" agenda ON agenda.id=encontro."propostaAgendaRecuperacaoId" JOIN "ItemReservaTentativaRecuperacao" item ON item.id=agenda."itemReservaId" JOIN "ReservaTentativaRecuperacao" reserva ON reserva.id=item."reservaId" JOIN "PropostaPlanoRecuperacao" plano ON plano.id=reserva."propostaId" WHERE encontro.id=proposta."encontroId";
 atual:=estado_fontes_substituicao_recuperacao(alocacao_id);
 IF alocacao_id IS NULL OR proposta.snapshot->'fontesEstado' IS DISTINCT FROM atual THEN RAISE EXCEPTION 'As fontes do plano mudaram; prepare nova substituição'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_fontes_substituicao_recuperacao BEFORE INSERT ON "DecisaoSubstituicaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION conferir_fontes_substituicao_recuperacao();
