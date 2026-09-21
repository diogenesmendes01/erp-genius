-- Reforço da conferência: JSON containment de [] não prova ausência de itens.
CREATE FUNCTION validar_integridade_plano_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE plano JSONB; regras JSONB; modelo JSONB; pagador TEXT; maioridade TEXT;
BEGIN
  IF NEW.snapshot->'assinaturasHerdadas' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'Aditivo não pode herdar assinaturas anteriores'; END IF;
  IF NEW.snapshot->'plano'->'pendencias' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'Plano de assinatura contém pendências'; END IF;
  SELECT jsonb_agg(jsonb_build_object('papel', v->>'papel', 'etapa', v->>'etapa')
    ORDER BY CASE WHEN v->>'etapa' = 'CLIENTE' THEN 0 ELSE 1 END, (v->>'papel') COLLATE "C")
    INTO plano FROM jsonb_array_elements(NEW.snapshot->'participantes') v;
  IF NEW.snapshot->'plano'->'participantesExigidos' IS DISTINCT FROM plano THEN RAISE EXCEPTION 'Plano não corresponde aos signatários conferidos'; END IF;
  SELECT m.conteudo INTO modelo FROM "PropostaAditivoContratual" p JOIN "VersaoModeloContratual" m ON m.id = p."modeloId" WHERE p.id = NEW."propostaId";
  pagador := NEW.snapshot->'plano'->'contexto'->>'pagador'; maioridade := NEW.snapshot->'plano'->'contexto'->>'maioridade';
  SELECT jsonb_agg(regra || jsonb_build_object('resultado', CASE WHEN
      CASE regra->>'condicao' WHEN 'SEMPRE' THEN TRUE WHEN 'PAGADOR_DISTINTO' THEN pagador <> 'ALUNO'
        WHEN 'PAGADOR_EMPRESA' THEN pagador = 'EMPRESA' WHEN 'ALUNO_MAIOR' THEN maioridade = 'MAIOR'
        WHEN 'ALUNO_MENOR' THEN maioridade = 'MENOR' ELSE NULL END
      THEN 'EXIGIDA' ELSE 'NAO_APLICAVEL' END) ORDER BY ordem)
    INTO regras FROM jsonb_array_elements(modelo->'assinaturas') WITH ORDINALITY AS r(regra, ordem);
  IF NEW.snapshot->'plano'->'regras' IS DISTINCT FROM regras THEN RAISE EXCEPTION 'Regras do plano divergem do modelo aprovado'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_integridade_plano_aditivo_117 BEFORE INSERT ON "ConferenciaParticipantesAditivo"
  FOR EACH ROW EXECUTE FUNCTION validar_integridade_plano_aditivo_117();
