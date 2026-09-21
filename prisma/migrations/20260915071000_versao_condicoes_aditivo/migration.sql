-- Q117: formaliza condições aprovadas do aditivo, sem alterar cobranças.
CREATE TABLE "VersaoCondicoesAditivo" (
  id TEXT PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "conferenciaFinalId" TEXT NOT NULL UNIQUE REFERENCES "ConferenciaFinalAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "autorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  versao INTEGER NOT NULL CHECK (versao > 0),
  "anteriorId" TEXT UNIQUE REFERENCES "VersaoCondicoesAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  condicoes JSONB NOT NULL CHECK (jsonb_typeof(condicoes) = 'object'),
  "condicoesHash" TEXT NOT NULL CHECK ("condicoesHash" ~ '^[a-f0-9]{64}$'),
  "vigenciaInicio" TIMESTAMP(3) NOT NULL,
  "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "VersaoCondicoesAditivo_matriculaId_versao_key" UNIQUE ("matriculaId", versao)
);

CREATE FUNCTION validar_versao_condicoes_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE final "ConferenciaFinalAditivo"%ROWTYPE; conclusao "ConclusaoAssinaturaAditivo"%ROWTYPE;
        pe "ProcessoAssinaturaAditivo"%ROWTYPE; proposta "PropostaAditivoContratual"%ROWTYPE;
        artefato "ArtefatoAditivoContratual"%ROWTYPE; participantes "ConferenciaParticipantesAditivo"%ROWTYPE;
        anterior "VersaoCondicoesAditivo"%ROWTYPE; ator "Usuario"%ROWTYPE; alteracoes JSONB; mudancas JSONB; esperadas JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Versão de condições de aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO final FROM "ConferenciaFinalAditivo" WHERE id = NEW."conferenciaFinalId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conferência final de aditivo inexistente'; END IF;
  SELECT * INTO conclusao FROM "ConclusaoAssinaturaAditivo" WHERE id = final."conclusaoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conclusão de aditivo inexistente'; END IF;
  SELECT * INTO pe FROM "ProcessoAssinaturaAditivo" WHERE id = conclusao."processoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo de aditivo inexistente'; END IF;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = pe."propostaId" FOR SHARE;
  IF NOT FOUND OR proposta."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR NEW."propostaId" IS DISTINCT FROM proposta.id THEN
    RAISE EXCEPTION 'Versão de condições não corresponde à proposta e matrícula';
  END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM id FROM "ProcessoAssinaturaAditivo" WHERE id = pe.id FOR UPDATE;
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = pe."artefatoId" FOR SHARE;
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
  IF pe.ambiente <> 'PRODUCAO' OR final.snapshot->>'ambiente' <> 'PRODUCAO' THEN RAISE EXCEPTION 'Condições reais exigem assinatura em produção'; END IF;
  IF pe.estado <> 'ENVIADO' OR pe."referenciaExterna" IS NULL OR pe."referenciaExterna" IS DISTINCT FROM conclusao."referenciaExterna" THEN
    RAISE EXCEPTION 'Condições exigem processo enviado com referência atual';
  END IF;
  IF NEW."vigenciaInicio" IS DISTINCT FROM proposta."vigenciaInicio" THEN RAISE EXCEPTION 'Vigência não corresponde à proposta formalizada'; END IF;
  IF final.snapshot->>'matriculaId' IS DISTINCT FROM proposta."matriculaId"
    OR final.snapshot->>'propostaId' IS DISTINCT FROM proposta.id
    OR final.snapshot->>'propostaHash' IS DISTINCT FROM proposta."entradaHash"
    OR final.snapshot->>'conclusaoId' IS DISTINCT FROM conclusao.id
    OR final.snapshot->>'conclusaoHash' IS DISTINCT FROM conclusao."entradaHash"
    OR final.snapshot->>'processoId' IS DISTINCT FROM pe.id
    OR artefato."propostaId" IS DISTINCT FROM proposta.id OR participantes."propostaId" IS DISTINCT FROM proposta.id THEN
    RAISE EXCEPTION 'Conferência final não corresponde à origem formalizada';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao)
    OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId" = proposta.id AND n.versao > participantes.versao) THEN
    RAISE EXCEPTION 'A proposta ou conferência de participantes foi superada';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  PERFORM exigir_alcadas_aditivo_117(proposta);
  PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, participantes);
  SELECT * INTO anterior FROM "VersaoCondicoesAditivo" WHERE "matriculaId" = proposta."matriculaId" ORDER BY versao DESC LIMIT 1 FOR UPDATE;
  IF anterior.id IS NULL THEN
    IF NEW.versao <> 1 OR NEW."anteriorId" IS NOT NULL THEN RAISE EXCEPTION 'Primeira versão de condições é inválida'; END IF;
  ELSIF NEW.versao <> anterior.versao + 1 OR NEW."anteriorId" IS DISTINCT FROM anterior.id OR NEW."vigenciaInicio" <= anterior."vigenciaInicio" THEN
    RAISE EXCEPTION 'Versão de condições não sucede a versão atual';
  END IF;
  alteracoes := proposta.snapshot->'entrada'->'alteracoes';
  IF jsonb_typeof(alteracoes) IS DISTINCT FROM 'array' OR jsonb_array_length(alteracoes) = 0
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(alteracoes) item WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'origem') IS DISTINCT FROM 'string' OR btrim(item->>'origem') = ''
      OR jsonb_typeof(item->'valorEstruturado') IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'valorEstruturado'->'tipo') IS DISTINCT FROM 'string'
      OR item->>'origem' LIKE 'ADITIVO_%' OR item->>'origem' = 'AGENDA_PARTICULAR'
      OR (item->>'origem' IN ('ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_ENDERECO') AND item->'valorEstruturado'->>'tipo' <> 'TEXT')
      OR (item->>'origem' IN ('ALUNO_EMAIL','PAGADOR_EMAIL') AND item->'valorEstruturado'->>'tipo' <> 'EMAIL')
      OR (item->>'origem' IN ('TAXA_VALOR','MENSALIDADE_VALOR','HORA_VALOR','ADIANTAMENTO_VALOR') AND item->'valorEstruturado'->>'tipo' <> 'DINHEIRO')
      OR (item->>'origem' IN ('TAXA_VENCIMENTO','PRIMEIRA_MENSALIDADE_VENCIMENTO','COBERTURA_INICIO','COBERTURA_FIM','ADIANTAMENTO_VENCIMENTO') AND item->'valorEstruturado'->>'tipo' <> 'DATA')
      OR (item->>'origem' = 'ADIANTAMENTO_MINUTOS' AND item->'valorEstruturado'->>'tipo' <> 'MINUTOS')
      OR (item->>'origem' = 'MOEDA' AND item->'valorEstruturado'->>'tipo' <> 'MOEDA')
      OR (item->>'origem' = 'REGIME' AND item->'valorEstruturado'->>'tipo' <> 'REGIME')
      OR item->>'origem' NOT IN ('ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','TAXA_VALOR','MENSALIDADE_VALOR','HORA_VALOR','ADIANTAMENTO_VALOR','TAXA_VENCIMENTO','PRIMEIRA_MENSALIDADE_VENCIMENTO','COBERTURA_INICIO','COBERTURA_FIM','ADIANTAMENTO_VENCIMENTO','ADIANTAMENTO_MINUTOS','MOEDA','REGIME'))
    OR (SELECT count(DISTINCT item->>'origem') FROM jsonb_array_elements(alteracoes) item) <> jsonb_array_length(alteracoes) THEN
    RAISE EXCEPTION 'Alterações estruturadas não formam condições publicáveis';
  END IF;
  SELECT jsonb_object_agg(item->>'origem', item->'valorEstruturado') INTO mudancas FROM jsonb_array_elements(alteracoes) item;
  esperadas := COALESCE(anterior.condicoes, '{}'::jsonb) || COALESCE(mudancas, '{}'::jsonb);
  IF NEW.condicoes IS DISTINCT FROM esperadas THEN RAISE EXCEPTION 'Condições não correspondem à cadeia formalizada'; END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Formalização exige Secretaria ou Administração ativa';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_versao_condicoes_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "VersaoCondicoesAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_versao_condicoes_aditivo_117();
