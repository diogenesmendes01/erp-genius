-- Q19: a exceção pertence a uma proposta e exige autorização explícita
-- na decisão independente. As colunas permanecem nulas para o histórico 121;
-- uma proposta sem a conferência de calendário não pode ser aprovada.
ALTER TABLE "PropostaRemarcacaoAgendaSegundaChamada"
  ADD COLUMN "motivoExcecaoNaoLetiva" TEXT,
  ADD COLUMN "calendarioId" TEXT,
  ADD COLUMN "calendarioVersao" INTEGER,
  ADD COLUMN "fusoInstitucional" TEXT,
  ADD COLUMN "periodosNaoLetivos" JSONB;

ALTER TABLE "PropostaRemarcacaoAgendaSegundaChamada"
  ADD CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_motivoExcecaoNaoLetiva_check"
    CHECK ("motivoExcecaoNaoLetiva" IS NULL OR length(btrim("motivoExcecaoNaoLetiva")) BETWEEN 5 AND 2000),
  ADD CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_calendarioVersao_check"
    CHECK ("calendarioVersao" IS NULL OR "calendarioVersao" > 0),
  ADD CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_fusoInstitucional_check"
    CHECK ("fusoInstitucional" IS NULL OR length(btrim("fusoInstitucional")) > 0),
  ADD CONSTRAINT "PropostaRemarcacaoAgendaSegundaChamada_periodosNaoLetivos_check"
    CHECK ("periodosNaoLetivos" IS NULL OR jsonb_typeof("periodosNaoLetivos") = 'array');

ALTER TABLE "DecisaoRemarcacaoAgendaSegundaChamada"
  ADD COLUMN "autorizarDiaNaoLetivo" BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION estado_calendario_remarcacao_segunda_chamada(
  p_inicio TIMESTAMP,
  p_fim TIMESTAMP
) RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
  calendario "VersaoCalendarioEscolar"%ROWTYPE;
  fuso_configurado TEXT;
  periodos JSONB;
BEGIN
  IF NOT isfinite(p_inicio) OR NOT isfinite(p_fim) OR p_fim <= p_inicio THEN
    RAISE EXCEPTION 'Intervalo da remarcação inválido para conferência de calendário';
  END IF;

  SELECT c.* INTO calendario
  FROM "VersaoCalendarioEscolar" c
  JOIN "DecisaoCalendarioEscolar" d ON d."calendarioId" = c.id AND d.aprovada
  ORDER BY c.versao DESC
  LIMIT 1;
  SELECT "fusoInstitucional" INTO fuso_configurado
  FROM "ConfiguracaoOperacional" WHERE id = 'escola';

  IF calendario.id IS NULL OR fuso_configurado IS DISTINCT FROM calendario."fusoInstitucional" THEN
    RAISE EXCEPTION 'Calendário publicado e fuso institucional conferido são obrigatórios';
  END IF;

  SELECT COALESCE(jsonb_agg(periodo->>'id' ORDER BY periodo->>'id'), '[]'::jsonb)
  INTO periodos
  FROM jsonb_array_elements(calendario.periodos) periodo
  WHERE ((p_inicio AT TIME ZONE 'UTC') AT TIME ZONE calendario."fusoInstitucional")::date
          <= (periodo->>'fim')::date
    AND (((p_fim - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE calendario."fusoInstitucional")::date
          >= (periodo->>'inicio')::date;

  RETURN jsonb_build_object(
    'calendarioId', calendario.id,
    'calendarioVersao', calendario.versao,
    'fusoInstitucional', calendario."fusoInstitucional",
    'periodosNaoLetivos', periodos
  );
END $$;

CREATE FUNCTION conferir_excecao_nao_letiva_remarcacao_segunda_chamada()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reserva_id TEXT;
  reserva "ReservaSegundaChamada"%ROWTYPE;
  proposta "PropostaRemarcacaoAgendaSegundaChamada"%ROWTYPE;
  estado_calendario JSONB;
  tem_periodo BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'PropostaRemarcacaoAgendaSegundaChamada' THEN
    IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;

    SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id = NEW."reservaId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Remarcação exige reserva existente'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

    estado_calendario := estado_calendario_remarcacao_segunda_chamada(NEW.inicio, NEW.fim);
    IF NEW."calendarioId" IS DISTINCT FROM estado_calendario->>'calendarioId'
       OR NEW."calendarioVersao" IS DISTINCT FROM (estado_calendario->>'calendarioVersao')::integer
       OR NEW."fusoInstitucional" IS DISTINCT FROM estado_calendario->>'fusoInstitucional'
       OR NEW."periodosNaoLetivos" IS DISTINCT FROM estado_calendario->'periodosNaoLetivos' THEN
      RAISE EXCEPTION 'Confira o calendário e os períodos não letivos antes de propor a remarcação';
    END IF;

    tem_periodo := jsonb_array_length(estado_calendario->'periodosNaoLetivos') > 0;
    IF tem_periodo AND (NEW."motivoExcecaoNaoLetiva" IS NULL
      OR length(btrim(NEW."motivoExcecaoNaoLetiva")) NOT BETWEEN 5 AND 2000) THEN
      RAISE EXCEPTION 'Período não letivo exige justificativa específica';
    END IF;
    IF NOT tem_periodo AND NEW."motivoExcecaoNaoLetiva" IS NOT NULL THEN
      RAISE EXCEPTION 'Justificativa de exceção só é válida para período não letivo';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  SELECT "reservaId" INTO reserva_id
  FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id = NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige proposta de remarcação existente'; END IF;
  SELECT * INTO reserva FROM "ReservaSegundaChamada" WHERE id = reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige reserva de remarcação existente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaRemarcacaoAgendaSegundaChamada"
  WHERE id = NEW."propostaId" FOR KEY SHARE;
  IF NOT FOUND OR proposta."reservaId" IS DISTINCT FROM reserva.id THEN
    RAISE EXCEPTION 'Decisão exige proposta de remarcação existente';
  END IF;

  IF NOT NEW.aprovada AND NEW."autorizarDiaNaoLetivo" THEN
    RAISE EXCEPTION 'Rejeição não autoriza exceção de calendário';
  END IF;
  IF NEW.aprovada THEN
    estado_calendario := estado_calendario_remarcacao_segunda_chamada(proposta.inicio, proposta.fim);
    IF proposta."calendarioId" IS DISTINCT FROM estado_calendario->>'calendarioId'
       OR proposta."calendarioVersao" IS DISTINCT FROM (estado_calendario->>'calendarioVersao')::integer
       OR proposta."fusoInstitucional" IS DISTINCT FROM estado_calendario->>'fusoInstitucional'
       OR proposta."periodosNaoLetivos" IS DISTINCT FROM estado_calendario->'periodosNaoLetivos' THEN
      RAISE EXCEPTION 'Calendário ou período não letivo mudou; prepare nova remarcação';
    END IF;
    tem_periodo := jsonb_array_length(estado_calendario->'periodosNaoLetivos') > 0;
    IF NEW."autorizarDiaNaoLetivo" IS DISTINCT FROM tem_periodo THEN
      RAISE EXCEPTION 'Confira a autorização explícita para período não letivo';
    END IF;
    IF tem_periodo AND (proposta."motivoExcecaoNaoLetiva" IS NULL
      OR length(btrim(proposta."motivoExcecaoNaoLetiva")) NOT BETWEEN 5 AND 2000) THEN
      RAISE EXCEPTION 'Período não letivo exige justificativa específica';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- O prefixo garante que esta conferência ocorre antes do guard 121, sem
-- reescrever os guards já aplicados de estado, autoria e aplicação atômica.
CREATE TRIGGER a_conferir_excecao_nao_letiva_remarcacao_segunda_chamada_proposta
BEFORE INSERT ON "PropostaRemarcacaoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION conferir_excecao_nao_letiva_remarcacao_segunda_chamada();

CREATE TRIGGER a_conferir_excecao_nao_letiva_remarcacao_segunda_chamada_decisao
BEFORE INSERT ON "DecisaoRemarcacaoAgendaSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION conferir_excecao_nao_letiva_remarcacao_segunda_chamada();
