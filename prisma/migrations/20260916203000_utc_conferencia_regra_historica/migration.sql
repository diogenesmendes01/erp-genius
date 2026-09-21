CREATE OR REPLACE FUNCTION conferir_conferencia_regra_historica() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaConferenciaRegraHistoricaTurma"%ROWTYPE; t "Turma"%ROWTYPE; autor TEXT; r "VersaoRegraAvaliacao"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferência histórica de regra e decisão são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'PropostaConferenciaRegraHistoricaTurma' THEN p := NEW; autor := NEW."preparadorId";
 ELSE SELECT * INTO p FROM "PropostaConferenciaRegraHistoricaTurma" WHERE id=NEW."propostaId"; autor:=NEW."decisorId";
   IF autor=p."preparadorId" THEN RAISE EXCEPTION 'Conferência histórica exige decisão independente'; END IF;
 END IF;
 SELECT * INTO t FROM "Turma" WHERE id=p."turmaId"; IF NOT FOUND THEN RAISE EXCEPTION 'Turma não encontrada'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('regra-avaliacao-nivel:' || t."nivelId",0));
 PERFORM id FROM "Turma" WHERE id=t.id FOR UPDATE; SELECT * INTO t FROM "Turma" WHERE id=p."turmaId";
 PERFORM id FROM "Usuario" WHERE id=autor AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conferência histórica exige gestão ativa'; END IF;
 IF TG_TABLE_NAME <> 'PropostaConferenciaRegraHistoricaTurma' THEN IF NOT NEW.aprovada THEN RETURN NEW; END IF; END IF;
 SELECT * INTO r FROM "VersaoRegraAvaliacao" WHERE id=p."destinoId"; IF NOT FOUND OR r."nivelId"<>t."nivelId" OR NOT EXISTS(SELECT 1 FROM "DecisaoRegraAvaliacao" d WHERE d."regraId"=r.id AND d.aprovada) THEN RAISE EXCEPTION 'Destino exige versão publicada do mesmo nível'; END IF;
 IF t."regraAvaliacaoId" IS NOT NULL OR EXISTS(SELECT 1 FROM "RegistroAvaliacaoMatricula" WHERE "turmaId"=t.id) THEN RAISE EXCEPTION 'A conferência histórica exige turma sem regra e sem avaliações'; END IF;
 IF TG_TABLE_NAME='PropostaConferenciaRegraHistoricaTurma' THEN
   IF p.versao<>(SELECT COALESCE(MAX(versao),0)+1 FROM "PropostaConferenciaRegraHistoricaTurma" WHERE "turmaId"=t.id) THEN RAISE EXCEPTION 'Versão da conferência desatualizada'; END IF;
 ELSIF p.versao<>(SELECT MAX(versao) FROM "PropostaConferenciaRegraHistoricaTurma" WHERE "turmaId"=t.id) THEN RAISE EXCEPTION 'Existe conferência mais recente';
 END IF;
 IF p.snapshot->'turma'->>'id' IS DISTINCT FROM t.id OR p.snapshot->'turma'->>'nome' IS DISTINCT FROM t.nome OR p.snapshot->'turma'->>'codigo' IS DISTINCT FROM t.codigo OR p.snapshot->'turma'->>'nivelId' IS DISTINCT FROM t."nivelId" OR p.snapshot->'turma'->>'status' IS DISTINCT FROM t.status::text OR (NULLIF(p.snapshot->'turma'->>'dataInicio','')::timestamptz AT TIME ZONE 'UTC') IS DISTINCT FROM t."dataInicio" OR (NULLIF(p.snapshot->'turma'->>'dataFim','')::timestamptz AT TIME ZONE 'UTC') IS DISTINCT FROM t."dataFim" OR p.snapshot->'destino'->>'id' IS DISTINCT FROM r.id OR p.snapshot->'destino'->>'conteudoHash' IS DISTINCT FROM r."conteudoHash" THEN RAISE EXCEPTION 'A fotografia da turma ou da versão mudou'; END IF;
 IF jsonb_typeof(p.snapshot->'encontros')<>'array' OR jsonb_typeof(p.snapshot->'diarios')<>'array' OR jsonb_typeof(p.snapshot->'alocacoes')<>'array' THEN RAISE EXCEPTION 'A fotografia da conferência é inválida'; END IF;
 IF jsonb_array_length(p.snapshot->'encontros')<>(SELECT count(*) FROM "EncontroAgenda" WHERE "turmaId"=t.id) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'encontros') s WHERE NOT EXISTS(SELECT 1 FROM "EncontroAgenda" e WHERE e.id=s->>'id' AND e."turmaId"=t.id AND e.inicio=((s->>'inicio')::timestamptz AT TIME ZONE 'UTC') AND e.fim=((s->>'fim')::timestamptz AT TIME ZONE 'UTC') AND e.status::text=s->>'status' AND e."professorId" IS NOT DISTINCT FROM s->>'professorId')) THEN RAISE EXCEPTION 'A agenda da fotografia mudou'; END IF;
 IF jsonb_array_length(p.snapshot->'diarios')<>(SELECT count(*) FROM "AulaDiario" WHERE "turmaId"=t.id) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'diarios') s WHERE NOT EXISTS(SELECT 1 FROM "AulaDiario" a WHERE a.id=s->>'id' AND a."turmaId"=t.id AND a."ocorridaEm"=((s->>'ocorridaEm')::timestamptz AT TIME ZONE 'UTC') AND a."professorId"=s->>'professorId')) THEN RAISE EXCEPTION 'O diário da fotografia mudou'; END IF;
 IF jsonb_array_length(p.snapshot->'alocacoes')<>(SELECT count(*) FROM "AlocacaoTurma" WHERE "turmaId"=t.id) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'alocacoes') s WHERE NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" a WHERE a.id=s->>'id' AND a."turmaId"=t.id AND a."alunoId"=s->>'alunoId' AND a."matriculaId" IS NOT DISTINCT FROM s->>'matriculaId' AND a.ativa=(s->>'ativa')::boolean AND a."criadoEm"=((s->>'criadoEm')::timestamptz AT TIME ZONE 'UTC') AND a."encerradaEm" IS NOT DISTINCT FROM (NULLIF(s->>'encerradaEm','')::timestamptz AT TIME ZONE 'UTC') AND a."provenienciaVinculo"::text IS NOT DISTINCT FROM s->>'provenienciaVinculo' AND a."inicioVigencia" IS NOT DISTINCT FROM NULLIF(s->>'inicioVigencia','')::timestamptz AND a."fimVigencia" IS NOT DISTINCT FROM NULLIF(s->>'fimVigencia','')::timestamptz)) THEN RAISE EXCEPTION 'As alocações da fotografia mudaram'; END IF;
 RETURN NEW;
END $$;
