-- 231: prova por campo na cadeia imutável, sem registrar aplicação global fictícia.
CREATE FUNCTION conferir_campos_aplicacao_direta_231(versao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE atual "VersaoCondicoesAditivo"%ROWTYPE; origem "VersaoCondicoesAditivo"%ROWTYPE; campo TEXT;
BEGIN
 SELECT * INTO atual FROM "VersaoCondicoesAditivo" WHERE id=versao_id;
 IF atual.id IS NULL THEN RAISE EXCEPTION 'Versão indisponível'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PropostaAditivoContratual" p, LATERAL jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a WHERE p.id=atual."propostaId" AND a->>'origem'=ANY(ARRAY['ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','MENSALIDADE_VALOR','HORA_VALOR','AGENDA_PARTICULAR'])) THEN RAISE EXCEPTION 'A proposta contém somente condições com aplicação própria'; END IF;
 FOR campo IN SELECT jsonb_object_keys(atual.condicoes) LOOP
   WITH RECURSIVE cadeia AS (
     SELECT v.* FROM "VersaoCondicoesAditivo" v WHERE v.id=atual.id
     UNION ALL SELECT anterior.* FROM "VersaoCondicoesAditivo" anterior JOIN cadeia c ON anterior.id=c."anteriorId" AND anterior."matriculaId"=c."matriculaId" AND anterior.versao=c.versao-1
   ) SELECT c.* INTO origem FROM cadeia c JOIN "PropostaAditivoContratual" p ON p.id=c."propostaId" AND p."matriculaId"=c."matriculaId"
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a WHERE a->>'origem'=campo AND a->'valorEstruturado'=atual.condicoes->campo)
   AND NOT EXISTS(SELECT 1 FROM cadeia nova JOIN "PropostaAditivoContratual" np ON np.id=nova."propostaId" WHERE nova.versao>c.versao AND EXISTS(SELECT 1 FROM jsonb_array_elements(np.snapshot->'entrada'->'alteracoes') na WHERE na->>'origem'=campo))
   ORDER BY c.versao DESC LIMIT 1;
   IF origem.id IS NULL THEN RAISE EXCEPTION 'Origem explícita do campo divergente'; END IF;
   IF campo='PRIMEIRA_MENSALIDADE_VENCIMENTO' THEN
     IF NOT EXISTS(SELECT 1 FROM "AplicacaoVencimentoAditivo" a JOIN "DecisaoVencimentoAditivo" d ON d.id=a."decisaoId" AND d.aprovada JOIN "PropostaVencimentoAditivo" p ON p.id=d."propostaId" WHERE p."versaoCondicoesId"=origem.id AND p."propostaAditivoId"=origem."propostaId" AND p."matriculaId"=atual."matriculaId") THEN RAISE EXCEPTION 'Vencimento exige aplicação própria'; END IF;
   ELSIF campo = ANY(ARRAY['ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','MENSALIDADE_VALOR','HORA_VALOR','AGENDA_PARTICULAR']) THEN
     IF origem.id<>atual.id AND NOT EXISTS(SELECT 1 FROM "AplicacaoCondicoesAditivo" a WHERE a."versaoCondicoesId"=origem.id AND a."condicoesHash"=origem."condicoesHash" AND a."matriculaId"=atual."matriculaId") THEN RAISE EXCEPTION 'Campo herdado aguarda aplicação da origem'; END IF;
   ELSE RAISE EXCEPTION 'Condição financeira exige fluxo próprio antes da aplicação';
   END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION validar_aplicacao_condicoes_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v "VersaoCondicoesAditivo"%ROWTYPE; ultima "VersaoCondicoesAditivo"%ROWTYPE;
        p "PropostaAditivoContratual"%ROWTYPE; final "ConferenciaFinalAditivo"%ROWTYPE;
        conclusao "ConclusaoAssinaturaAditivo"%ROWTYPE; processo "ProcessoAssinaturaAditivo"%ROWTYPE;
        artefato "ArtefatoAditivoContratual"%ROWTYPE; participantes "ConferenciaParticipantesAditivo"%ROWTYPE;
        ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicação de condições de aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id = NEW."versaoCondicoesId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Versão de condições indisponível'; END IF;
  IF NEW."matriculaId" IS DISTINCT FROM v."matriculaId" OR NEW."propostaId" IS DISTINCT FROM v."propostaId"
    OR NEW."condicoesHash" IS DISTINCT FROM v."condicoesHash" OR NEW."vigenciaInicio" IS DISTINCT FROM v."vigenciaInicio" THEN
    RAISE EXCEPTION 'Aplicação não corresponde à versão formalizada';
  END IF;
  PERFORM id FROM "Matricula" WHERE id = v."matriculaId" FOR UPDATE;
  SELECT * INTO ultima FROM "VersaoCondicoesAditivo" WHERE "matriculaId" = v."matriculaId" ORDER BY versao DESC LIMIT 1 FOR UPDATE;
  IF ultima.id IS DISTINCT FROM v.id THEN RAISE EXCEPTION 'Aplique a última cadeia formalizada de condições'; END IF;
  SELECT * INTO p FROM "PropostaAditivoContratual" WHERE id = v."propostaId" FOR SHARE;
  SELECT * INTO final FROM "ConferenciaFinalAditivo" WHERE id = v."conferenciaFinalId" FOR SHARE;
  SELECT * INTO conclusao FROM "ConclusaoAssinaturaAditivo" WHERE id = final."conclusaoId" FOR SHARE;
  SELECT * INTO processo FROM "ProcessoAssinaturaAditivo" WHERE id = conclusao."processoId" FOR UPDATE;
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = processo."artefatoId" FOR SHARE;
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Aplicação exige Secretaria ou Administração ativa'; END IF;
  IF p.id IS NULL OR final.id IS NULL OR conclusao.id IS NULL OR processo.id IS NULL OR artefato.id IS NULL OR participantes.id IS NULL
    OR p."matriculaId" IS DISTINCT FROM v."matriculaId" OR processo."propostaId" IS DISTINCT FROM p.id
    OR processo.ambiente <> 'PRODUCAO' OR processo.estado <> 'ENVIADO' OR processo."referenciaExterna" IS NULL
    OR processo."referenciaExterna" IS DISTINCT FROM conclusao."referenciaExterna"
    OR conclusao."originalHash" IS DISTINCT FROM artefato."pdfHash" OR NEW."revisaoHash" IS DISTINCT FROM final."revisaoHash" THEN
    RAISE EXCEPTION 'Aplicação exige a conclusão e conferência final atuais em produção';
  END IF;
  IF final.snapshot->>'matriculaId' IS DISTINCT FROM p."matriculaId" OR final.snapshot->>'propostaId' IS DISTINCT FROM p.id
    OR final.snapshot->>'propostaHash' IS DISTINCT FROM p."entradaHash" OR final.snapshot->>'conclusaoId' IS DISTINCT FROM conclusao.id
    OR final.snapshot->>'conclusaoHash' IS DISTINCT FROM conclusao."entradaHash" OR final.snapshot->>'processoId' IS DISTINCT FROM processo.id
    OR final.snapshot->>'ambiente' IS DISTINCT FROM 'PRODUCAO' THEN RAISE EXCEPTION 'Conferência final não corresponde à aplicação'; END IF;
  PERFORM conferir_campos_aplicacao_direta_231(v.id);
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = p."matriculaId" AND n.versao > p.versao)
    OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId" = p.id AND n.versao > participantes.versao) THEN
    RAISE EXCEPTION 'A proposta ou conferência de participantes foi superada';
  END IF;
  -- A cadeia documental e os hashes Node são validados pelas fontes imutáveis;
  -- JSONB::text não é usado como substituto da canonicalização recursiva Node.
  PERFORM conferir_fonte_aditivo_117(p);
  PERFORM exigir_alcadas_aditivo_117(p);
  PERFORM conferir_evidencias_conferencia_aditivo_117(p, participantes);
  NEW."aplicadaEm" := clock_timestamp() AT TIME ZONE 'UTC';
  RETURN NEW;
END;
$$;
