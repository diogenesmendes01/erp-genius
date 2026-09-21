-- Q23: uma aula coletiva ministrada conserva o diário e a chamada originais.
-- Correções passam a ser propostas/versionadas; não alteram a fonte concluída.
-- A barreira não impede registrar diário/chamada enquanto o encontro ainda está
-- PREVISTO, portanto preserva a conclusão legítima PREVISTO -> MINISTRADO.

CREATE OR REPLACE FUNCTION proteger_originais_aula_ministrada_204()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  IF TG_TABLE_NAME = 'EncontroAgenda' THEN
    IF TG_OP = 'DELETE'
      AND OLD.finalidade = 'AULA'::"FinalidadeEncontroAgenda"
      AND OLD.status = 'MINISTRADO'::"StatusEncontroAgenda" THEN
      RAISE EXCEPTION 'Encontro de aula ministrado é histórico; não pode ser removido';
    END IF;

    IF TG_OP = 'UPDATE'
      AND OLD.finalidade = 'AULA'::"FinalidadeEncontroAgenda"
      AND OLD.status = 'MINISTRADO'::"StatusEncontroAgenda" THEN
      RAISE EXCEPTION 'Encontro de aula ministrado é histórico; reabertura ou alteração exige correção versionada';
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'AulaDiario' THEN
    -- Impede alterar, apagar ou desassociar o diário que já é fonte de uma
    -- aula concluída.
    IF TG_OP <> 'INSERT' AND EXISTS (
      SELECT 1 FROM "EncontroAgenda" encontro
      WHERE encontro.id = OLD."encontroId"
        AND encontro.finalidade = 'AULA'::"FinalidadeEncontroAgenda"
        AND encontro.status = 'MINISTRADO'::"StatusEncontroAgenda"
    ) THEN
      RAISE EXCEPTION 'Diário de aula ministrada é histórico; correção exige proposta versionada';
    END IF;

    -- Também não permite anexar/trocar um diário depois da conclusão. Assim,
    -- apagar o vínculo e criar outra fonte não contorna a imutabilidade.
    IF TG_OP <> 'DELETE' AND NEW."encontroId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "EncontroAgenda" encontro
      WHERE encontro.id = NEW."encontroId"
        AND encontro.finalidade = 'AULA'::"FinalidadeEncontroAgenda"
        AND encontro.status = 'MINISTRADO'::"StatusEncontroAgenda"
    ) THEN
      RAISE EXCEPTION 'Aula ministrada não aceita diário novo ou reassociado';
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- RegistroAulaAluno: a presença/classificação também não pode ser trocada,
  -- removida, movida para outro diário ou inserida tardiamente após MINISTRADO.
  IF TG_OP <> 'INSERT' AND EXISTS (
    SELECT 1
    FROM "AulaDiario" diario
    JOIN "EncontroAgenda" encontro ON encontro.id = diario."encontroId"
    WHERE diario.id = OLD."aulaId"
      AND encontro.finalidade = 'AULA'::"FinalidadeEncontroAgenda"
      AND encontro.status = 'MINISTRADO'::"StatusEncontroAgenda"
  ) THEN
    RAISE EXCEPTION 'Chamada de aula ministrada é histórica; correção exige proposta versionada';
  END IF;

  IF TG_OP <> 'DELETE' AND EXISTS (
    SELECT 1
    FROM "AulaDiario" diario
    JOIN "EncontroAgenda" encontro ON encontro.id = diario."encontroId"
    WHERE diario.id = NEW."aulaId"
      AND encontro.finalidade = 'AULA'::"FinalidadeEncontroAgenda"
      AND encontro.status = 'MINISTRADO'::"StatusEncontroAgenda"
  ) THEN
    RAISE EXCEPTION 'Aula ministrada não aceita novo ou reassociado registro de chamada';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proteger_encontro_aula_ministrado_204
  BEFORE UPDATE OR DELETE ON "EncontroAgenda"
  FOR EACH ROW EXECUTE FUNCTION proteger_originais_aula_ministrada_204();

CREATE TRIGGER proteger_diario_aula_ministrado_204
  BEFORE INSERT OR UPDATE OR DELETE ON "AulaDiario"
  FOR EACH ROW EXECUTE FUNCTION proteger_originais_aula_ministrada_204();

CREATE TRIGGER proteger_chamada_aula_ministrada_204
  BEFORE INSERT OR UPDATE OR DELETE ON "RegistroAulaAluno"
  FOR EACH ROW EXECUTE FUNCTION proteger_originais_aula_ministrada_204();