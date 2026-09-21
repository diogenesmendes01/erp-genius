-- Protege vagas reservadas inclusive em caminhos legados de alocação.
CREATE FUNCTION conferir_capacidade_com_reservas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 turma_ref TEXT;
 capacidade_atual INTEGER;
 ocupadas BIGINT;
 reservadas BIGINT;
BEGIN
 IF TG_TABLE_NAME = 'Turma' THEN
  IF NEW.capacidade >= OLD.capacidade THEN RETURN NEW; END IF;
  turma_ref := NEW.id;
  capacidade_atual := NEW.capacidade;
 ELSE
  turma_ref := NEW."turmaId";
  IF TG_TABLE_NAME = 'AlocacaoTurma' THEN
   IF NOT NEW.ativa THEN RETURN NEW; END IF;
  ELSE
   IF NEW.status NOT IN ('ATIVA','MANTIDA_PENDENCIA') THEN RETURN NEW; END IF;
  END IF;
  SELECT capacidade INTO capacidade_atual FROM "Turma" WHERE id=turma_ref FOR UPDATE;
 END IF;
 IF TG_TABLE_NAME = 'AlocacaoTurma' THEN
  SELECT count(*) INTO ocupadas FROM "AlocacaoTurma" WHERE "turmaId"=turma_ref AND ativa AND id<>NEW.id;
 ELSE
  SELECT count(*) INTO ocupadas FROM "AlocacaoTurma" WHERE "turmaId"=turma_ref AND ativa;
 END IF;
 IF TG_TABLE_NAME = 'ReservaVagaMatricula' THEN
  SELECT count(*) INTO reservadas FROM "ReservaVagaMatricula" WHERE "turmaId"=turma_ref AND status IN ('ATIVA','MANTIDA_PENDENCIA') AND id<>NEW.id;
  reservadas := reservadas + 1;
 ELSE
  SELECT count(*) INTO reservadas FROM "ReservaVagaMatricula" WHERE "turmaId"=turma_ref AND status IN ('ATIVA','MANTIDA_PENDENCIA');
 END IF;
 IF TG_TABLE_NAME = 'AlocacaoTurma' THEN ocupadas := ocupadas + 1; END IF;
 IF reservadas > 0 AND ocupadas + reservadas > capacidade_atual THEN
  RAISE EXCEPTION 'Capacidade insuficiente considerando alocações e reservas ocupantes';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER alocacao_respeita_reservas BEFORE INSERT OR UPDATE OF ativa, "turmaId" ON "AlocacaoTurma" FOR EACH ROW EXECUTE FUNCTION conferir_capacidade_com_reservas();
CREATE TRIGGER reserva_respeita_capacidade BEFORE INSERT OR UPDATE OF status ON "ReservaVagaMatricula" FOR EACH ROW EXECUTE FUNCTION conferir_capacidade_com_reservas();
CREATE TRIGGER capacidade_respeita_reservas BEFORE UPDATE OF capacidade ON "Turma" FOR EACH ROW EXECUTE FUNCTION conferir_capacidade_com_reservas();
