CREATE FUNCTION preservar_aplicacao_recomposicao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Aplicação e programação são histórico; use um fluxo de correção com rastreabilidade.';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER aplicacao_recomposicao_imutavel BEFORE UPDATE OR DELETE ON "AplicacaoRecomposicaoCobertura"
FOR EACH ROW EXECUTE FUNCTION preservar_aplicacao_recomposicao();
CREATE TRIGGER dia_programado_recomposicao_imutavel BEFORE UPDATE OR DELETE ON "DiaProgramadoRecomposicao"
FOR EACH ROW EXECUTE FUNCTION preservar_aplicacao_recomposicao();

CREATE FUNCTION conferir_aplicacao_recomposicao() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "DecisaoRecomposicaoCobertura" WHERE id = NEW."decisaoId" AND aprovada) THEN
    RAISE EXCEPTION 'Aplicação exige uma decisão aprovada.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER aplicacao_recomposicao_aprovada BEFORE INSERT ON "AplicacaoRecomposicaoCobertura"
FOR EACH ROW EXECUTE FUNCTION conferir_aplicacao_recomposicao();

CREATE OR REPLACE FUNCTION conferir_programacao_recomposicao() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "AplicacaoRecomposicaoCobertura" a
    JOIN "DecisaoRecomposicaoCobertura" d ON d.id = a."decisaoId"
    JOIN "RascunhoRecomposicaoCobertura" r ON r.id = d."rascunhoId"
    JOIN "DiaCompensacaoCobertura" dia ON dia.id = NEW."direitoId"
    WHERE a.id = NEW."aplicacaoId" AND d.aprovada AND r."matriculaId" = dia."matriculaId" AND dia.estado = 'PENDENTE'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(r.snapshot->'proposta'->'destinos', '[]'::jsonb)) destino
      WHERE destino->>'id' = NEW."direitoId"
        AND destino->>'diaCompensadoProposto' = to_char(NEW."dataCobertura", 'YYYY-MM-DD')
    )
  ) THEN RAISE EXCEPTION 'Dia e data devem corresponder exatamente à programação aprovada desta matrícula.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
