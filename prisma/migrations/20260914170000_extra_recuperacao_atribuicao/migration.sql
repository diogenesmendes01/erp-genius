-- Mantém a autoria SQL alinhada a docenteAtual: titular, turma não concluída
-- e vínculo iniciado sem encerramento. Não reabre acesso ao histórico docente.
CREATE OR REPLACE FUNCTION preservar_extra_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaExtraRecuperacao"%ROWTYPE; atual jsonb; a "AlocacaoTurma"%ROWTYPE;
        t "Turma"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta e decisão de oportunidade extra são imutáveis'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 IF TG_TABLE_NAME = 'PropostaExtraRecuperacao' THEN
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = NEW."alocacaoId";
  PERFORM id FROM "Matricula" WHERE id = a."matriculaId" FOR UPDATE;
  SELECT * INTO t FROM "Turma" WHERE id = a."turmaId" FOR UPDATE;
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = NEW."alocacaoId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF u.id IS NULL OR NOT u.ativo THEN RAISE EXCEPTION 'Autor sem atribuição para oportunidade extra'; END IF;
  IF NOT (u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
   IF NOT ('PROFESSOR' = ANY(u.papeis)) OR t."professorId" IS DISTINCT FROM u.id OR t.status = 'CONCLUIDA' THEN
    RAISE EXCEPTION 'Autor sem atribuição para oportunidade extra';
   END IF;
   PERFORM id FROM "VinculoDocente" WHERE "turmaId" = t.id AND "professorId" = u.id
    AND fim IS NULL AND inicio <= (clock_timestamp() AT TIME ZONE 'UTC') FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Autor sem atribuição para oportunidade extra'; END IF;
  END IF;
  atual := estado_extra_recuperacao(NEW."alocacaoId",NEW.habilidade);
  IF atual->>'matriculaId' <> NEW."matriculaId" OR atual->>'nivelId' <> NEW."nivelId" OR atual <> NEW.snapshot THEN RAISE EXCEPTION 'Contexto da oportunidade extra divergente'; END IF;
 ELSE
  SELECT * INTO p FROM "PropostaExtraRecuperacao" WHERE id = NEW."propostaId";
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = p."alocacaoId";
  PERFORM id FROM "Turma" WHERE id = a."turmaId" FOR UPDATE;
  PERFORM id FROM "AlocacaoTurma" WHERE id = a.id FOR SHARE;
  IF p."autorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir a oportunidade extra'; END IF;
  PERFORM id FROM "Usuario" WHERE id = NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
  IF NOT FOUND OR length(trim(NEW.motivo)) < 5 THEN RAISE EXCEPTION 'Decisão exige gestão ativa e motivo'; END IF;
  IF NOT NEW.aprovada THEN RETURN NEW; END IF;
  atual := estado_extra_recuperacao(p."alocacaoId",p.habilidade);
  IF atual <> p.snapshot THEN RAISE EXCEPTION 'O saldo ou vínculo mudou; confira nova proposta'; END IF;
 END IF;
 IF atual->>'statusMatricula' <> 'ATIVA' OR NOT (atual->>'ativa')::boolean THEN RAISE EXCEPTION 'Oportunidade extra exige vínculo ativo conferido'; END IF;
 IF (atual->>'ocupadas')::bigint < (atual->>'limiteBase')::bigint + (atual->>'extrasAprovados')::bigint THEN RAISE EXCEPTION 'Ainda há oportunidades disponíveis'; END IF;
 RETURN NEW;
END $$;
