-- Preserva a trilha já registrada, inclusive a aprovação anterior quando uma
-- proposta aprovada é posteriormente rejeitada. Não altera eventos existentes.
CREATE FUNCTION preservar_evento_retomada_matriculas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."tipo" IN ('RetomadaMatriculasSolicitada', 'RetomadaMatriculasDecidida', 'MatriculaRetomada') THEN
    RAISE EXCEPTION 'O histórico de retomada deve ser preservado.';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."tipo" IN ('RetomadaMatriculasSolicitada', 'RetomadaMatriculasDecidida', 'MatriculaRetomada') THEN
    RAISE EXCEPTION 'Não é permitido converter outro evento em histórico de retomada.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER preservar_evento_retomada_matriculas
BEFORE UPDATE OR DELETE ON "Evento"
FOR EACH ROW EXECUTE FUNCTION preservar_evento_retomada_matriculas();
