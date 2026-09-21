-- A proposta é um registro de intenção: sua fonte e seus itens não podem ser
-- reescritos depois de persistidos. As decisões permanecem no histórico de
-- eventos; em especial, APROVADA -> REJEITADA é a retirada da aprovação que a
-- ação existente já registra como uma nova decisão.
CREATE FUNCTION validar_proposta_retomada_matriculas_integridade() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  decisor "Usuario"%ROWTYPE;
  solicitante "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Propostas de retomada de matrículas são preservadas.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDENTE'
      OR NEW."decisorId" IS NOT NULL
      OR NEW."motivoDecisao" IS NOT NULL
      OR NEW."decididoEm" IS NOT NULL
      OR NEW."aplicadaEm" IS NOT NULL THEN
      RAISE EXCEPTION 'Uma proposta de retomada deve iniciar pendente, sem decisão ou aplicação.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW."alunoId" IS DISTINCT FROM OLD."alunoId"
    OR NEW."solicitanteId" IS DISTINCT FROM OLD."solicitanteId"
    OR NEW."chaveIdempotencia" IS DISTINCT FROM OLD."chaveIdempotencia"
    OR NEW."entradaHash" IS DISTINCT FROM OLD."entradaHash"
    OR NEW."estadoHash" IS DISTINCT FROM OLD."estadoHash"
    OR NEW.motivo IS DISTINCT FROM OLD.motivo
    OR NEW.entrada IS DISTINCT FROM OLD.entrada
    OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" THEN
    RAISE EXCEPTION 'A fonte da proposta de retomada não pode ser alterada.';
  END IF;

  IF OLD.status IN ('REJEITADA', 'APLICADA') THEN
    RAISE EXCEPTION 'Uma proposta de retomada final não pode ser alterada.';
  END IF;

  -- PENDENTE só pode ser decidida uma vez. APROVADA pode ser rejeitada antes
  -- da execução, o que preserva a aprovação anterior no Evento da ação.
  IF (OLD.status = 'PENDENTE' AND NEW.status IN ('APROVADA', 'REJEITADA'))
    OR (OLD.status = 'APROVADA' AND NEW.status = 'REJEITADA') THEN
    IF NEW."decisorId" IS NULL
      OR NEW."motivoDecisao" IS NULL
      OR NEW."decididoEm" IS NULL
      OR NEW."aplicadaEm" IS NOT NULL
      OR NEW."decisorId" = NEW."solicitanteId" THEN
      RAISE EXCEPTION 'A decisão de retomada deve ser independente, completa e ainda não aplicada.';
    END IF;

    SELECT * INTO decisor FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
    IF decisor.ativo IS DISTINCT FROM true
      OR NOT (decisor.papeis && ARRAY['FINANCEIRO', 'ADMINISTRADOR']::"Papel"[]) THEN
      RAISE EXCEPTION 'A decisão de retomada exige decisor financeiro ou administrador ativo.';
    END IF;

    IF NEW.status = 'APROVADA' THEN
      SELECT * INTO solicitante FROM "Usuario" WHERE id = NEW."solicitanteId" FOR SHARE;
      IF solicitante.ativo IS DISTINCT FROM true
        OR NOT (solicitante.papeis && ARRAY['SECRETARIA_ACADEMICA', 'FINANCEIRO', 'ADMINISTRADOR']::"Papel"[]) THEN
        RAISE EXCEPTION 'A aprovação exige solicitante com papel ativo de pausa.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'APROVADA' AND NEW.status = 'APLICADA' THEN
    IF NEW."decisorId" IS NULL
      OR NEW."motivoDecisao" IS NULL
      OR NEW."decididoEm" IS NULL
      OR NEW."aplicadaEm" IS NULL
      OR NEW."decisorId" = NEW."solicitanteId"
      OR NEW."decisorId" IS DISTINCT FROM OLD."decisorId"
      OR NEW."motivoDecisao" IS DISTINCT FROM OLD."motivoDecisao"
      OR NEW."decididoEm" IS DISTINCT FROM OLD."decididoEm" THEN
      RAISE EXCEPTION 'A aplicação exige e preserva uma aprovação independente completa.';
    END IF;

    SELECT * INTO decisor FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
    SELECT * INTO solicitante FROM "Usuario" WHERE id = NEW."solicitanteId" FOR SHARE;
    IF decisor.ativo IS DISTINCT FROM true
      OR NOT (decisor.papeis && ARRAY['FINANCEIRO', 'ADMINISTRADOR']::"Papel"[]) THEN
      RAISE EXCEPTION 'A aplicação exige decisor financeiro ou administrador ativo.';
    END IF;
    IF solicitante.ativo IS DISTINCT FROM true
      OR NOT (solicitante.papeis && ARRAY['SECRETARIA_ACADEMICA', 'FINANCEIRO', 'ADMINISTRADOR']::"Papel"[]) THEN
      RAISE EXCEPTION 'A aplicação exige solicitante com papel ativo de pausa.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transição de proposta de retomada inválida.';
END $$;

CREATE TRIGGER validar_proposta_retomada_matriculas_integridade
BEFORE INSERT OR UPDATE OR DELETE ON "PropostaRetomadaMatriculas"
FOR EACH ROW EXECUTE FUNCTION validar_proposta_retomada_matriculas_integridade();

CREATE FUNCTION validar_item_proposta_retomada_matriculas_integridade() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  proposta "PropostaRetomadaMatriculas"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Itens de proposta de retomada são preservados.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Itens de proposta de retomada não podem ser alterados.';
  END IF;

  SELECT * INTO proposta FROM "PropostaRetomadaMatriculas"
    WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta de retomada não encontrada para o item.';
  END IF;
  IF proposta.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'Itens só podem ser inseridos em proposta de retomada pendente.';
  END IF;
  IF NEW."alunoId" IS DISTINCT FROM proposta."alunoId" THEN
    RAISE EXCEPTION 'O aluno do item deve pertencer à proposta de retomada.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(proposta.entrada -> 'matriculas') = 'array'
        THEN proposta.entrada -> 'matriculas'
        ELSE '[]'::jsonb
      END
    ) AS matricula(entrada)
    WHERE matricula.entrada ->> 'matriculaId' = NEW."matriculaId"
  ) THEN
    RAISE EXCEPTION 'A matrícula do item deve constar na entrada da proposta de retomada.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_item_proposta_retomada_matriculas_integridade
BEFORE INSERT OR UPDATE OR DELETE ON "ItemPropostaRetomadaMatriculas"
FOR EACH ROW EXECUTE FUNCTION validar_item_proposta_retomada_matriculas_integridade();
