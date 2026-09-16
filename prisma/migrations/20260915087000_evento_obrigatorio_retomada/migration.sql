-- Cada alteração nova da proposta precisa deixar a evidência de domínio na
-- mesma transação. Este trigger não inspeciona linhas históricas: só a linha
-- inserida/atualizada que disparou a transição.
CREATE FUNCTION exigir_evento_transicao_retomada_matriculas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'PENDENTE' AND NOT EXISTS (
      SELECT 1
      FROM "Evento" e
      WHERE e.tipo = 'RetomadaMatriculasSolicitada'
        AND e."agregadoTipo" = 'Aluno'
        AND e."agregadoId" = NEW."alunoId"
        AND e."autorId" = NEW."solicitanteId"
        AND e.payload ->> 'propostaId' = NEW.id
    ) THEN
      RAISE EXCEPTION 'A solicitação de retomada exige evento correspondente.';
    END IF;
    RETURN NULL;
  END IF;

  IF OLD.status = 'PENDENTE' AND NEW.status IN ('APROVADA', 'REJEITADA') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "Evento" e
      WHERE e.tipo = 'RetomadaMatriculasDecidida'
        AND e."agregadoTipo" = 'Aluno'
        AND e."agregadoId" = NEW."alunoId"
        AND e."autorId" = NEW."decisorId"
        AND e.payload ->> 'propostaId' = NEW.id
        AND e.payload ->> 'statusAnterior' = 'PENDENTE'
        AND e.payload ->> 'status' = NEW.status::text
    ) THEN
      RAISE EXCEPTION 'A decisão de retomada exige evento correspondente.';
    END IF;
  ELSIF OLD.status = 'APROVADA' AND NEW.status = 'REJEITADA' THEN
    -- A aprovação já registrada não prova a rejeição posterior: o estado
    -- anterior também faz parte da identidade da decisão.
    IF NOT EXISTS (
      SELECT 1
      FROM "Evento" e
      WHERE e.tipo = 'RetomadaMatriculasDecidida'
        AND e."agregadoTipo" = 'Aluno'
        AND e."agregadoId" = NEW."alunoId"
        AND e."autorId" = NEW."decisorId"
        AND e.payload ->> 'propostaId' = NEW.id
        AND e.payload ->> 'statusAnterior' = 'APROVADA'
        AND e.payload ->> 'status' = 'REJEITADA'
    ) THEN
      RAISE EXCEPTION 'A rejeição de proposta aprovada exige novo evento correspondente.';
    END IF;
  ELSIF OLD.status = 'APROVADA' AND NEW.status = 'APLICADA' THEN
    IF EXISTS (
      SELECT 1
      FROM "ItemPropostaRetomadaMatriculas" i
      WHERE i."propostaId" = NEW.id
        AND NOT EXISTS (
          SELECT 1
          FROM "Evento" e
          WHERE e.tipo = 'MatriculaRetomada'
            AND e."agregadoTipo" = 'Matricula'
            AND e."agregadoId" = i."matriculaId"
            AND e.payload ->> 'propostaId' = NEW.id
        )
    ) THEN
      RAISE EXCEPTION 'A aplicação de retomada exige evento para cada matrícula selecionada.';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER exigir_evento_transicao_retomada_matriculas
AFTER INSERT OR UPDATE ON "PropostaRetomadaMatriculas"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION exigir_evento_transicao_retomada_matriculas();
