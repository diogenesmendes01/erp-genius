-- Q117: toda proposta posterior declara exatamente a cadeia formalizada antes dela.
CREATE OR REPLACE FUNCTION conferir_fonte_aditivo_117(p "PropostaAditivoContratual")
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE c "ConclusaoAssinaturaContratual"%ROWTYPE; processo "ProcessoAssinaturaContratual"%ROWTYPE;
        artefato "ArtefatoContratual"%ROWTYPE; modelo "VersaoModeloContratual"%ROWTYPE; publicacao "DecisaoModeloContratual"%ROWTYPE;
        ultima "VersaoCondicoesAditivo"%ROWTYPE; cadeia JSONB;
BEGIN
  -- Ordem global: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  SELECT * INTO c FROM "ConclusaoAssinaturaContratual" WHERE id = p."conclusaoOriginalId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conclusão original indisponível'; END IF;
  SELECT * INTO processo FROM "ProcessoAssinaturaContratual" WHERE id = c."processoId" FOR UPDATE;
  SELECT * INTO artefato FROM "ArtefatoContratual" WHERE id = processo."artefatoId" FOR SHARE;
  SELECT * INTO modelo FROM "VersaoModeloContratual" WHERE id = p."modeloId" FOR SHARE;
  SELECT * INTO publicacao FROM "DecisaoModeloContratual" WHERE "modeloId" = p."modeloId" AND aprovada FOR SHARE;
  IF NOT FOUND OR modelo.conteudo->>'finalidade' <> 'ADITIVO' THEN RAISE EXCEPTION 'Aditivo exige modelo ADITIVO aprovado'; END IF;
  IF processo."matriculaId" IS DISTINCT FROM p."matriculaId" OR processo.estado::text <> 'ENVIADO'
    OR processo."referenciaExterna" IS NULL OR c."referenciaExterna" IS DISTINCT FROM processo."referenciaExterna"
    OR c."originalHash" IS DISTINCT FROM artefato."pdfHash" THEN
    RAISE EXCEPTION 'Aditivo exige conclusão do processo enviado, matrícula e original exatos';
  END IF;
  IF p.snapshot->'base'->>'conclusaoHash' IS DISTINCT FROM c."entradaHash"
    OR p.snapshot->'base'->>'originalHash' IS DISTINCT FROM c."originalHash"
    OR p.snapshot->'base'->>'originalHash' IS DISTINCT FROM artefato."pdfHash"
    OR p.snapshot->'base'->>'referenciaExterna' IS DISTINCT FROM processo."referenciaExterna"
    OR p.snapshot->'base'->>'ambiente' IS DISTINCT FROM processo.ambiente::text
    OR p.snapshot->'base'->>'artefatoOriginalId' IS DISTINCT FROM artefato.id
    OR p.snapshot->'base'->>'modeloHash' IS DISTINCT FROM modelo."conteudoHash"
    OR p.snapshot->'base'->>'publicacaoId' IS DISTINCT FROM publicacao.id THEN
    RAISE EXCEPTION 'Base preservada não corresponde à conclusão, original, modelo ou publicação';
  END IF;
  IF EXISTS (SELECT 1 FROM "ConclusaoAssinaturaContratual" outra JOIN "ProcessoAssinaturaContratual" op ON op.id = outra."processoId"
    WHERE op."matriculaId" = p."matriculaId" AND outra.id <> c.id) THEN
    RAISE EXCEPTION 'Há mais de um original assinado nesta matrícula';
  END IF;
  IF p.snapshot->'base'->'condicoes'->>'id' IS DISTINCT FROM (SELECT id FROM "CondicoesEntradaPreparacao" WHERE "matriculaId" = p."matriculaId" ORDER BY versao DESC LIMIT 1)
    OR p.snapshot->'base'->'pagador'->>'id' IS DISTINCT FROM (SELECT id FROM "PagadorPreparacaoMatricula" WHERE "matriculaId" = p."matriculaId" ORDER BY versao DESC LIMIT 1) THEN
    RAISE EXCEPTION 'Condições ou pagador da base do aditivo mudaram';
  END IF;
  PERFORM v.id FROM "VersaoCondicoesAditivo" v JOIN "PropostaAditivoContratual" anterior ON anterior.id = v."propostaId"
    WHERE v."matriculaId" = p."matriculaId" AND anterior.versao < p.versao ORDER BY anterior.versao FOR SHARE;
  SELECT COALESCE(jsonb_agg(v.id ORDER BY anterior.versao), '[]'::jsonb) INTO cadeia
    FROM "VersaoCondicoesAditivo" v JOIN "PropostaAditivoContratual" anterior ON anterior.id = v."propostaId"
    WHERE v."matriculaId" = p."matriculaId" AND anterior.versao < p.versao;
  IF p.snapshot->'base'->'aditivosAnterioresIds' IS DISTINCT FROM cadeia THEN
    RAISE EXCEPTION 'Cadeia de condições formalizadas não corresponde à proposta';
  END IF;
  SELECT v.* INTO ultima FROM "VersaoCondicoesAditivo" v JOIN "PropostaAditivoContratual" anterior ON anterior.id = v."propostaId"
    WHERE v."matriculaId" = p."matriculaId" AND anterior.versao < p.versao ORDER BY anterior.versao DESC LIMIT 1 FOR SHARE;
  IF FOUND AND p."vigenciaInicio" <= ultima."vigenciaInicio" THEN
    RAISE EXCEPTION 'Vigência da proposta deve suceder a última condição formalizada';
  END IF;
END;
$$;
