-- Q117: decisões de alçada são fatos independentes da aprovação administrativa
-- genérica. Não formalizam nem aplicam os impactos do aditivo.
CREATE TABLE "DecisaoAlcadaAditivo" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL REFERENCES "PropostaAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  alcada TEXT NOT NULL CHECK (alcada IN ('FINANCEIRA', 'COMERCIAL', 'PEDAGOGICA')),
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 4000 AND motivo = btrim(motivo)),
  "propostaHash" TEXT NOT NULL CHECK ("propostaHash" ~ '^[a-f0-9]{64}$'),
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX "DecisaoAlcadaAditivo_propostaId_alcada_key" ON "DecisaoAlcadaAditivo"("propostaId", alcada);

CREATE FUNCTION validar_decisao_alcada_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE; decisao "DecisaoAditivoContratual"%ROWTYPE;
        conclusao "ConclusaoAssinaturaContratual"%ROWTYPE; ator "Usuario"%ROWTYPE; campos TEXT[];
        aplicavel BOOLEAN := FALSE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de alçada de aditivo é imutável'; END IF;
  -- Ordem global: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  SELECT * INTO conclusao FROM "ConclusaoAssinaturaContratual" WHERE id = proposta."conclusaoOriginalId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conclusão original indisponível'; END IF;
  PERFORM id FROM "ProcessoAssinaturaContratual" WHERE id = conclusao."processoId" FOR UPDATE;
  SELECT * INTO decisao FROM "DecisaoAditivoContratual" WHERE "propostaId" = proposta.id FOR SHARE;
  IF NOT FOUND OR NOT decisao.aprovada OR decisao."propostaHash" IS DISTINCT FROM proposta."entradaHash"
    OR NEW."propostaHash" IS DISTINCT FROM proposta."entradaHash" THEN
    RAISE EXCEPTION 'Decisão de alçada exige aprovação administrativa da proposta exata';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" nova WHERE nova."matriculaId" = proposta."matriculaId" AND nova.versao > proposta.versao) THEN
    RAISE EXCEPTION 'Existe proposta de aditivo mais recente';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  IF jsonb_typeof(proposta.snapshot->'alteracoes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Alterações estruturadas da proposta são inválidas';
  END IF;
  SELECT array_agg(DISTINCT item->>'campo' ORDER BY item->>'campo') INTO campos
    FROM jsonb_array_elements(proposta.snapshot->'alteracoes') AS item
    WHERE jsonb_typeof(item) = 'object' AND jsonb_typeof(item->'campo') = 'string' AND btrim(item->>'campo') <> '';
  IF jsonb_array_length(proposta.snapshot->'alteracoes') = 0
    OR cardinality(campos) IS DISTINCT FROM jsonb_array_length(proposta.snapshot->'alteracoes') THEN
    RAISE EXCEPTION 'Alterações estruturadas da proposta são inválidas';
  END IF;
  IF NEW.alcada = 'FINANCEIRA' THEN
    aplicavel := campos && ARRAY['TAXA_VALOR','MENSALIDADE_VALOR','HORA_VALOR','ADIANTAMENTO_VALOR','TAXA_VENCIMENTO','PRIMEIRA_MENSALIDADE_VENCIMENTO','COBERTURA_INICIO','COBERTURA_FIM','ADIANTAMENTO_VENCIMENTO','ADIANTAMENTO_MINUTOS','MOEDA','REGIME'];
  ELSIF NEW.alcada = 'COMERCIAL' THEN
    aplicavel := campos && ARRAY['TAXA_VALOR','MENSALIDADE_VALOR','HORA_VALOR','ADIANTAMENTO_VALOR','MOEDA','REGIME'];
  ELSIF NEW.alcada = 'PEDAGOGICA' THEN
    aplicavel := campos && ARRAY['AGENDA_PARTICULAR','REGIME'];
  END IF;
  IF aplicavel IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'A alçada informada não é aplicável às alterações da proposta'; END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NEW."decisorId" = proposta."preparadaPorId" THEN
    RAISE EXCEPTION 'Decisão de alçada exige decisor ativo diferente do preparador';
  END IF;
  IF (NEW.alcada = 'FINANCEIRA' AND NOT ('ADMINISTRADOR'::"Papel" = ANY(ator.papeis) OR ('FINANCEIRO'::"Papel" = ANY(ator.papeis) AND 'financeiro.aprovar_acertos' = ANY(ator.permissoes))))
    OR (NEW.alcada = 'COMERCIAL' AND NOT ('ADMINISTRADOR'::"Papel" = ANY(ator.papeis) OR 'GERENTE_COMERCIAL'::"Papel" = ANY(ator.papeis)))
    OR (NEW.alcada = 'PEDAGOGICA' AND NOT ('ADMINISTRADOR'::"Papel" = ANY(ator.papeis) OR 'GERENTE_PEDAGOGICO'::"Papel" = ANY(ator.papeis))) THEN
    RAISE EXCEPTION 'Decisor não possui a alçada exigida';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_decisao_alcada_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAlcadaAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_decisao_alcada_aditivo_117();

CREATE FUNCTION exigir_alcadas_aditivo_117(proposta "PropostaAditivoContratual") RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE campos TEXT[]; alcadas TEXT[] := ARRAY[]::TEXT[]; alcada_atual TEXT;
BEGIN
  -- A própria barreira toma a mesma ordem dos guardas de preservação.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM conferir_fonte_aditivo_117(proposta);
  IF jsonb_typeof(proposta.snapshot->'alteracoes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Alterações estruturadas da proposta são inválidas';
  END IF;
  SELECT array_agg(DISTINCT item->>'campo' ORDER BY item->>'campo') INTO campos
    FROM jsonb_array_elements(proposta.snapshot->'alteracoes') AS item
    WHERE jsonb_typeof(item) = 'object' AND jsonb_typeof(item->'campo') = 'string' AND btrim(item->>'campo') <> '';
  IF jsonb_array_length(proposta.snapshot->'alteracoes') = 0
    OR cardinality(campos) IS DISTINCT FROM jsonb_array_length(proposta.snapshot->'alteracoes') THEN
    RAISE EXCEPTION 'Alterações estruturadas da proposta são inválidas';
  END IF;
  IF campos && ARRAY['TAXA_VALOR','MENSALIDADE_VALOR','HORA_VALOR','ADIANTAMENTO_VALOR','TAXA_VENCIMENTO','PRIMEIRA_MENSALIDADE_VENCIMENTO','COBERTURA_INICIO','COBERTURA_FIM','ADIANTAMENTO_VENCIMENTO','ADIANTAMENTO_MINUTOS','MOEDA','REGIME'] THEN
    alcadas := array_append(alcadas, 'FINANCEIRA');
  END IF;
  IF campos && ARRAY['TAXA_VALOR','MENSALIDADE_VALOR','HORA_VALOR','ADIANTAMENTO_VALOR','MOEDA','REGIME'] THEN
    alcadas := array_append(alcadas, 'COMERCIAL');
  END IF;
  IF campos && ARRAY['AGENDA_PARTICULAR','REGIME'] THEN
    alcadas := array_append(alcadas, 'PEDAGOGICA');
  END IF;
  FOREACH alcada_atual IN ARRAY alcadas LOOP
    IF NOT EXISTS (SELECT 1 FROM "DecisaoAlcadaAditivo" d WHERE d."propostaId" = proposta.id
      AND d.alcada = alcada_atual AND d.aprovada AND d."propostaHash" = proposta."entradaHash") THEN
      RAISE EXCEPTION 'A proposta exige decisão de alçada % aprovada e da versão exata', alcada_atual;
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION validar_alcadas_conferencia_participantes_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM exigir_alcadas_aditivo_117(proposta);
  RETURN NEW;
END;
$$;
CREATE TRIGGER exigir_alcadas_conferencia_participantes_aditivo_117 BEFORE INSERT ON "ConferenciaParticipantesAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_alcadas_conferencia_participantes_aditivo_117();

CREATE FUNCTION validar_alcadas_artefato_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM exigir_alcadas_aditivo_117(proposta);
  RETURN NEW;
END;
$$;
CREATE TRIGGER exigir_alcadas_artefato_aditivo_117 BEFORE INSERT ON "ArtefatoAditivoContratual"
FOR EACH ROW EXECUTE FUNCTION validar_alcadas_artefato_aditivo_117();

CREATE FUNCTION validar_alcadas_conferencia_assinatura_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE artefato "ArtefatoAditivoContratual"%ROWTYPE; proposta "PropostaAditivoContratual"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = NEW."artefatoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original de aditivo inexistente'; END IF;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = artefato."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM exigir_alcadas_aditivo_117(proposta);
  RETURN NEW;
END;
$$;
CREATE TRIGGER exigir_alcadas_conferencia_assinatura_aditivo_117 BEFORE INSERT ON "ConferenciaAssinaturaAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_alcadas_conferencia_assinatura_aditivo_117();
