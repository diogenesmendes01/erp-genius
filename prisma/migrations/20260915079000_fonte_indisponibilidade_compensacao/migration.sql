-- FIN-02/Q70: novas aprovações de compensação exigem indisponibilidade escolar
-- confirmada para cada dia. Não reinterpreta fatos já aprovados.
CREATE FUNCTION conferir_fonte_indisponibilidade_compensacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cobranca "Cobranca"%ROWTYPE;
BEGIN
  IF NEW.status <> 'APROVADA' OR (TG_OP = 'UPDATE' AND OLD.status = 'APROVADA') THEN
    RETURN NEW;
  END IF;

  -- Ordem compatível com os consumidores financeiros: calendário -> matrícula -> cobrança.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula de compensação não encontrada.';
  END IF;
  SELECT * INTO cobranca
    FROM "Cobranca"
    WHERE id = NEW."cobrancaOrigemId" AND "matriculaId" = NEW."matriculaId"
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobrança de origem da compensação não encontrada.';
  END IF;
  IF cobranca.tipo <> 'MENSALIDADE' OR cobranca."coberturaInicio" IS NULL OR cobranca."coberturaFim" IS NULL
    OR cobranca."coberturaFim" < cobranca."coberturaInicio"
    OR cobranca."coberturaInicio" IS DISTINCT FROM NEW."coberturaOriginalInicio"
    OR cobranca."coberturaFim" IS DISTINCT FROM NEW."coberturaOriginalFim" THEN
    RAISE EXCEPTION 'Cobertura de origem da compensação diverge da cobrança atual.';
  END IF;
  IF cobranca."coberturaInicio" < DATE '0001-01-01' OR cobranca."coberturaFim" > DATE '9999-12-31'
    OR cobranca."coberturaFim" - cobranca."coberturaInicio" > 365 THEN
    RAISE EXCEPTION 'Cobertura de compensação exige intervalo persistível de até 366 dias.';
  END IF;
  IF jsonb_typeof(NEW."diasPropostos") <> 'array'
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW."diasPropostos") elemento
      WHERE jsonb_typeof(elemento) <> 'string'
        OR elemento #>> '{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    ) THEN
    RAISE EXCEPTION 'Dias propostos de compensação inválidos.';
  END IF;

  -- Cada dia parcial exige fato positivo. Fim de relato aberto é projetado por
  -- término aprovado; relato sem término continua aberto até 9999-12-31.
  IF EXISTS (
    WITH dias AS (
      SELECT (elemento #>> '{}')::date AS dia
      FROM jsonb_array_elements(NEW."diasPropostos") elemento
    )
    SELECT 1 FROM dias
    WHERE dia < cobranca."coberturaInicio" OR dia > cobranca."coberturaFim"
      OR NOT EXISTS (
        SELECT 1
        FROM "RegistroIndisponibilidadeOfertaMatricula" relato
        JOIN "ConfirmacaoIndisponibilidadeOfertaMatricula" confirmacao
          ON confirmacao."registroId" = relato.id AND confirmacao.confirmada = true
        LEFT JOIN LATERAL (
          SELECT termino.fim
          FROM "PropostaTerminoIndisponibilidadeOferta" termino
          JOIN "DecisaoTerminoIndisponibilidadeOferta" decisao
            ON decisao."propostaId" = termino.id AND decisao.aprovada = true
          WHERE termino."registroId" = relato.id
          LIMIT 1
        ) termino ON true
        WHERE relato."matriculaId" = NEW."matriculaId"
          AND relato.inicio <= dia
          AND COALESCE(relato.fim, termino.fim, DATE '9999-12-31') >= dia
      )
  ) THEN
    RAISE EXCEPTION 'Compensação aprovada exige indisponibilidade da oferta confirmada para cada dia proposto.';
  END IF;

  -- Compensação diária não pode ser usada para período integral: mesmo que o
  -- formulário selecione apenas alguns dias, a fonte positiva completa exige
  -- o tratamento de crédito ou cobertura futura do FIN-02.
  IF NOT EXISTS (
    WITH dias_cobertura AS (
      SELECT serie::date AS dia
      FROM generate_series(cobranca."coberturaInicio", cobranca."coberturaFim", INTERVAL '1 day') serie
    )
    SELECT 1 FROM dias_cobertura
    WHERE NOT EXISTS (
      SELECT 1
      FROM "RegistroIndisponibilidadeOfertaMatricula" relato
      JOIN "ConfirmacaoIndisponibilidadeOfertaMatricula" confirmacao
        ON confirmacao."registroId" = relato.id AND confirmacao.confirmada = true
      LEFT JOIN LATERAL (
        SELECT termino.fim
        FROM "PropostaTerminoIndisponibilidadeOferta" termino
        JOIN "DecisaoTerminoIndisponibilidadeOferta" decisao
          ON decisao."propostaId" = termino.id AND decisao.aprovada = true
        WHERE termino."registroId" = relato.id
        LIMIT 1
      ) termino ON true
      WHERE relato."matriculaId" = NEW."matriculaId"
        AND relato.inicio <= dias_cobertura.dia
        AND COALESCE(relato.fim, termino.fim, DATE '9999-12-31') >= dias_cobertura.dia
    )
  ) THEN
    RAISE EXCEPTION 'Período integral sem oferta exige crédito ou cobertura futura, não compensação diária.';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER conferir_fonte_indisponibilidade_compensacao
BEFORE INSERT OR UPDATE ON "CompensacaoCoberturaMatricula"
FOR EACH ROW EXECUTE FUNCTION conferir_fonte_indisponibilidade_compensacao();
