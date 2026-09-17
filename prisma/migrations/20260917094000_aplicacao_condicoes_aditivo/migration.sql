-- Q117: formalização e aplicação são fatos distintos. Não há backfill: uma
-- versão antiga só entra em vigor mediante aplicação explícita e revalidada.
CREATE TABLE "AplicacaoCondicoesAditivo" (
  id TEXT NOT NULL,
  "versaoCondicoesId" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "revisaoHash" TEXT NOT NULL CHECK ("revisaoHash" ~ '^[a-f0-9]{64}$'),
  "condicoesHash" TEXT NOT NULL CHECK ("condicoesHash" ~ '^[a-f0-9]{64}$'),
  "vigenciaInicio" TIMESTAMP(3) NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 1 AND 200),
  "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "AplicacaoCondicoesAditivo_pkey" PRIMARY KEY (id),
  CONSTRAINT "AplicacaoCondicoesAditivo_versaoCondicoesId_key" UNIQUE ("versaoCondicoesId"),
  CONSTRAINT "AplicacaoCondicoesAditivo_propostaId_key" UNIQUE ("propostaId"),
  CONSTRAINT "AplicacaoCondicoesAditivo_autorId_chaveIdempotencia_key" UNIQUE ("autorId", "chaveIdempotencia"),
  CONSTRAINT "AplicacaoCondicoesAditivo_versaoCondicoesId_fkey" FOREIGN KEY ("versaoCondicoesId") REFERENCES "VersaoCondicoesAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AplicacaoCondicoesAditivo_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AplicacaoCondicoesAditivo_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AplicacaoCondicoesAditivo_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "AplicacaoCondicoesAditivo_matriculaId_vigenciaInicio_idx" ON "AplicacaoCondicoesAditivo"("matriculaId", "vigenciaInicio");

CREATE FUNCTION validar_aplicacao_condicoes_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF v.condicoes ?| ARRAY['TAXA_VALOR','TAXA_VENCIMENTO','PRIMEIRA_MENSALIDADE_VENCIMENTO','COBERTURA_INICIO','COBERTURA_FIM','ADIANTAMENTO_VALOR','ADIANTAMENTO_MINUTOS','ADIANTAMENTO_VENCIMENTO','MOEDA','REGIME'] THEN
    RAISE EXCEPTION 'Condição financeira exige fluxo próprio antes da aplicação';
  END IF;
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
CREATE TRIGGER validar_aplicacao_condicoes_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoCondicoesAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_aplicacao_condicoes_aditivo_117();

-- Apenas conferências novas recebem o gate. Histórico financeiro e fechamentos
-- existentes não são modificados nem reprecificados por esta migração.
CREATE FUNCTION exigir_aplicacao_condicoes_horas_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE encontro "EncontroAgenda"%ROWTYPE; vigente "VersaoCondicoesAditivo"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO encontro FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR UPDATE;
  SELECT * INTO vigente FROM "VersaoCondicoesAditivo" WHERE "matriculaId" = encontro."matriculaId" AND "vigenciaInicio" <= encontro.inicio ORDER BY "vigenciaInicio" DESC, versao DESC LIMIT 1 FOR SHARE;
  IF vigente.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "AplicacaoCondicoesAditivo" a WHERE a."versaoCondicoesId" = vigente.id AND a."matriculaId" = encontro."matriculaId" AND a."condicoesHash" = vigente."condicoesHash" AND a."vigenciaInicio" = vigente."vigenciaInicio") THEN
    RAISE EXCEPTION 'Condições formalizadas vigentes aguardam aplicação explícita';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "VersaoCondicoesAditivo" futura
    WHERE futura."matriculaId" = encontro."matriculaId" AND futura."vigenciaInicio" > encontro.inicio AND futura."vigenciaInicio" < encontro.fim
      AND (futura.condicoes->'HORA_VALOR' IS DISTINCT FROM vigente.condicoes->'HORA_VALOR'
        OR futura.condicoes->'MOEDA' IS DISTINCT FROM vigente.condicoes->'MOEDA'
        OR futura.condicoes->'REGIME' IS DISTINCT FROM vigente.condicoes->'REGIME')
      AND NOT EXISTS (SELECT 1 FROM "AplicacaoCondicoesAditivo" a WHERE a."versaoCondicoesId" = futura.id AND a."condicoesHash" = futura."condicoesHash" AND a."vigenciaInicio" = futura."vigenciaInicio")
  ) THEN RAISE EXCEPTION 'Condições formalizadas pendentes de aplicação durante o encontro'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER exigir_aplicacao_condicoes_horas_117 BEFORE INSERT ON "ConferenciaOcorrenciaHoras"
FOR EACH ROW EXECUTE FUNCTION exigir_aplicacao_condicoes_horas_117();
