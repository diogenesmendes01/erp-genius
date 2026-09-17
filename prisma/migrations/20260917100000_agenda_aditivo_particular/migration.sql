-- Q117: a agenda é uma fotografia imutável da alteração AGENDA_PARTICULAR
-- já submetida ao fluxo de PropostaAditivoContratual. Documento, participantes,
-- assinaturas e formalização pertencem à cadeia de aditivo existente.
CREATE TABLE "PropostaAgendaAditivoParticular" (
  id TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "conclusaoFonteId" TEXT NOT NULL,
  "preparadorId" TEXT NOT NULL,
  fotografia JSONB NOT NULL,
  "fotografiaHash" TEXT NOT NULL CHECK ("fotografiaHash" ~ '^[a-f0-9]{64}$'),
  pendencias JSONB NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 1 AND 200),
  "entradaHash" TEXT NOT NULL CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "PropostaAgendaAditivoParticular_pkey" PRIMARY KEY (id),
  CONSTRAINT "PropostaAgendaAditivoParticular_preparadorId_chaveIdempotencia_key" UNIQUE ("preparadorId", "chaveIdempotencia"),
  CONSTRAINT "PropostaAgendaAditivoParticular_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "PropostaAgendaAditivoParticular_conclusaoFonteId_fkey" FOREIGN KEY ("conclusaoFonteId") REFERENCES "ConclusaoAssinaturaContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "PropostaAgendaAditivoParticular_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "PropostaAgendaAditivoParticular_matriculaId_criadaEm_idx" ON "PropostaAgendaAditivoParticular"("matriculaId", "criadaEm");

ALTER TABLE "PropostaAditivoContratual" ADD COLUMN "propostaAgendaId" TEXT;
CREATE UNIQUE INDEX "PropostaAditivoContratual_propostaAgendaId_key" ON "PropostaAditivoContratual"("propostaAgendaId");
ALTER TABLE "PropostaAditivoContratual" ADD CONSTRAINT "PropostaAditivoContratual_propostaAgendaId_fkey"
  FOREIGN KEY ("propostaAgendaId") REFERENCES "PropostaAgendaAditivoParticular"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "VersaoCondicoesAditivo" ADD COLUMN "propostaAgendaId" TEXT;
CREATE UNIQUE INDEX "VersaoCondicoesAditivo_propostaAgendaId_key" ON "VersaoCondicoesAditivo"("propostaAgendaId");
ALTER TABLE "VersaoCondicoesAditivo" ADD CONSTRAINT "VersaoCondicoesAditivo_propostaAgendaId_fkey"
  FOREIGN KEY ("propostaAgendaId") REFERENCES "PropostaAgendaAditivoParticular"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- A versão existente rejeitava AGENDA_PARTICULAR enquanto não havia fluxo.
-- Mantém seus gates de fonte/formalização e passa a exigir o vínculo desta 201.
CREATE OR REPLACE FUNCTION validar_versao_condicoes_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE; final "ConferenciaFinalAditivo"%ROWTYPE;
        conclusao "ConclusaoAssinaturaAditivo"%ROWTYPE; processo "ProcessoAssinaturaAditivo"%ROWTYPE;
        artefato "ArtefatoAditivoContratual"%ROWTYPE; participantes "ConferenciaParticipantesAditivo"%ROWTYPE;
        anterior "VersaoCondicoesAditivo"%ROWTYPE; ator "Usuario"%ROWTYPE; alteracoes JSONB; mudancas JSONB; esperadas JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Versão de condições de aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO final FROM "ConferenciaFinalAditivo" WHERE id=NEW."conferenciaFinalId" FOR SHARE;
  SELECT * INTO conclusao FROM "ConclusaoAssinaturaAditivo" WHERE id=final."conclusaoId" FOR SHARE;
  SELECT * INTO processo FROM "ProcessoAssinaturaAditivo" WHERE id=conclusao."processoId" FOR SHARE;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id=processo."propostaId" FOR SHARE;
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id=processo."artefatoId" FOR SHARE;
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id=artefato."conferenciaId" FOR SHARE;
  IF proposta.id IS NULL OR final.id IS NULL OR conclusao.id IS NULL OR processo.id IS NULL OR artefato.id IS NULL OR participantes.id IS NULL
    OR NEW."matriculaId" IS DISTINCT FROM proposta."matriculaId" OR NEW."propostaId" IS DISTINCT FROM proposta.id
    OR NEW."vigenciaInicio" IS DISTINCT FROM proposta."vigenciaInicio" OR processo.ambiente <> 'PRODUCAO' OR processo.estado <> 'ENVIADO'
    OR processo."referenciaExterna" IS NULL OR processo."referenciaExterna" IS DISTINCT FROM conclusao."referenciaExterna"
    OR final.snapshot->>'propostaHash' IS DISTINCT FROM proposta."entradaHash" OR artefato."propostaId" IS DISTINCT FROM proposta.id
    OR participantes."propostaId" IS DISTINCT FROM proposta.id THEN RAISE EXCEPTION 'Versão de condições não corresponde à formalização atual'; END IF;
  PERFORM id FROM "Matricula" WHERE id=proposta."matriculaId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId"=proposta."matriculaId" AND n.versao>proposta.versao)
    OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId"=proposta.id AND n.versao>participantes.versao) THEN RAISE EXCEPTION 'A proposta ou conferência foi superada'; END IF;
  PERFORM conferir_fonte_aditivo_117(proposta); PERFORM exigir_alcadas_aditivo_117(proposta); PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, participantes);
  SELECT * INTO anterior FROM "VersaoCondicoesAditivo" WHERE "matriculaId"=proposta."matriculaId" ORDER BY versao DESC LIMIT 1 FOR UPDATE;
  IF anterior.id IS NULL THEN IF NEW.versao<>1 OR NEW."anteriorId" IS NOT NULL THEN RAISE EXCEPTION 'Primeira versão de condições é inválida'; END IF;
  ELSIF NEW.versao<>anterior.versao+1 OR NEW."anteriorId" IS DISTINCT FROM anterior.id OR NEW."vigenciaInicio"<=anterior."vigenciaInicio" THEN RAISE EXCEPTION 'Versão de condições não sucede a versão atual'; END IF;
  alteracoes:=proposta.snapshot->'entrada'->'alteracoes';
  IF jsonb_typeof(alteracoes) IS DISTINCT FROM 'array' OR jsonb_array_length(alteracoes)=0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(alteracoes) item WHERE jsonb_typeof(item)<>'object' OR item->>'origem' LIKE 'ADITIVO_%' OR jsonb_typeof(item->'valorEstruturado')<>'object' OR (item->>'origem'='AGENDA_PARTICULAR' AND (item->'valorEstruturado'->>'tipo'<>'AGENDA' OR item->'valorEstruturado'->>'propostaAgendaId' IS NULL))) THEN RAISE EXCEPTION 'Alterações estruturadas não formam condições publicáveis'; END IF;
  SELECT jsonb_object_agg(item->>'origem',item->'valorEstruturado') INTO mudancas FROM jsonb_array_elements(alteracoes) item;
  esperadas:=COALESCE(anterior.condicoes,'{}'::jsonb)||COALESCE(mudancas,'{}'::jsonb);
  IF NEW.condicoes IS DISTINCT FROM esperadas THEN RAISE EXCEPTION 'Condições não correspondem à cadeia formalizada'; END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id=NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Formalização exige Secretaria ou Administração ativa'; END IF;
  RETURN NEW;
END;
$$;

-- Este fato só aponta para a aplicação formalizada existente; não cria uma
-- segunda conclusão documental nem uma segunda decisão de alçada.
CREATE TABLE "AplicacaoAgendaAditivoParticular" (
  id TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "aplicacaoCondicoesId" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "aplicadorId" TEXT NOT NULL,
  "fotografiaHash" TEXT NOT NULL CHECK ("fotografiaHash" ~ '^[a-f0-9]{64}$'),
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 1 AND 200),
  "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "AplicacaoAgendaAditivoParticular_pkey" PRIMARY KEY (id),
  CONSTRAINT "AplicacaoAgendaAditivoParticular_propostaId_key" UNIQUE ("propostaId"),
  CONSTRAINT "AplicacaoAgendaAditivoParticular_aplicacaoCondicoesId_key" UNIQUE ("aplicacaoCondicoesId"),
  CONSTRAINT "AplicacaoAgendaAditivoParticular_aplicadorId_chaveIdempotencia_key" UNIQUE ("aplicadorId", "chaveIdempotencia"),
  CONSTRAINT "AplicacaoAgendaAditivoParticular_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaAgendaAditivoParticular"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AplicacaoAgendaAditivoParticular_aplicacaoCondicoesId_fkey" FOREIGN KEY ("aplicacaoCondicoesId") REFERENCES "AplicacaoCondicoesAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AplicacaoAgendaAditivoParticular_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "AplicacaoAgendaAditivoParticular_aplicadorId_fkey" FOREIGN KEY ("aplicadorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "AplicacaoAgendaAditivoParticular_matriculaId_aplicadaEm_idx" ON "AplicacaoAgendaAditivoParticular"("matriculaId", "aplicadaEm");

CREATE FUNCTION validar_proposta_agenda_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE;
        conclusao "ConclusaoAssinaturaContratual"%ROWTYPE;
        processo "ProcessoAssinaturaContratual"%ROWTYPE;
        ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta de agenda do aditivo é imutável'; END IF;
  -- Ordem comum dos guardas Q117: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" AND status = 'ATIVA' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula da proposta de agenda não está ativa'; END IF;
  SELECT * INTO conclusao FROM "ConclusaoAssinaturaContratual" WHERE id = NEW."conclusaoFonteId" FOR SHARE;
  SELECT * INTO processo FROM "ProcessoAssinaturaContratual" WHERE id = conclusao."processoId" FOR UPDATE;
  IF conclusao.id IS NULL OR processo.id IS NULL OR processo."matriculaId" IS DISTINCT FROM NEW."matriculaId"
    OR processo.ambiente <> 'PRODUCAO' OR processo.estado <> 'ENVIADO'
    OR processo."referenciaExterna" IS NULL OR processo."referenciaExterna" IS DISTINCT FROM conclusao."referenciaExterna"
    OR NOT EXISTS (SELECT 1 FROM "AceiteOriginalContratual" a WHERE a."matriculaId" = NEW."matriculaId" AND a."conclusaoId" = conclusao.id) THEN
    RAISE EXCEPTION 'Fonte original aceita em produção é obrigatória para a agenda';
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."preparadorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA', 'ADMINISTRADOR', 'GERENTE_PEDAGOGICO']::"Papel"[]) THEN
    RAISE EXCEPTION 'Proposta de agenda exige perfil acadêmico ou administrativo ativo';
  END IF;
  IF jsonb_typeof(NEW.fotografia) IS DISTINCT FROM 'object' OR jsonb_typeof(NEW.pendencias) IS DISTINCT FROM 'array'
    OR NEW.fotografia->>'matriculaId' IS DISTINCT FROM NEW."matriculaId"
    OR NEW.fotografia->>'preparadorId' IS DISTINCT FROM NEW."preparadorId"
    OR NEW.fotografia->>'fonteContratualId' IS DISTINCT FROM NEW."conclusaoFonteId"
    OR NEW.fotografia->>'fonteContratualHash' IS DISTINCT FROM conclusao."entradaHash"
    OR jsonb_typeof(NEW.fotografia->'encontros') IS DISTINCT FROM 'array'
    OR jsonb_array_length(NEW.fotografia->'encontros') = 0
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.fotografia->'encontros') e WHERE jsonb_typeof(e) IS DISTINCT FROM 'object'
      OR e->>'encontroId' IS NULL OR e->>'professorAnteriorId' IS NULL OR e->>'professorNovoId' IS NULL
      OR e->>'inicioAnterior' IS NULL OR e->>'fimAnterior' IS NULL OR e->>'inicioNovo' IS NULL OR e->>'fimNovo' IS NULL) THEN
    RAISE EXCEPTION 'Fotografia de agenda não corresponde à fonte ou aos encontros';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_proposta_agenda_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "PropostaAgendaAditivoParticular"
FOR EACH ROW EXECUTE FUNCTION validar_proposta_agenda_aditivo_117();

-- O aditivo é o único lugar em que a fotografia passa a ser alteração
-- contratual. A comparação usa a entrada preservada, nunca texto livre.
CREATE FUNCTION vincular_agenda_proposta_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE agenda "PropostaAgendaAditivoParticular"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  IF NEW."propostaAgendaId" IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO agenda FROM "PropostaAgendaAditivoParticular" WHERE id = NEW."propostaAgendaId" FOR SHARE;
  IF NOT FOUND OR agenda."matriculaId" IS DISTINCT FROM NEW."matriculaId"
    OR agenda."conclusaoFonteId" IS DISTINCT FROM NEW."conclusaoOriginalId"
    OR agenda.pendencias <> '[]'::jsonb THEN
    RAISE EXCEPTION 'A fotografia de agenda não corresponde ao aditivo ou possui pendências';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'entrada'->'alteracoes') item
    WHERE item->>'origem' = 'AGENDA_PARTICULAR'
      AND item->'valorEstruturado'->>'tipo' = 'AGENDA'
      AND item->'valorEstruturado'->>'propostaAgendaId' = agenda.id
      AND item->>'novo' = agenda.fotografia->>'texto'
  ) THEN RAISE EXCEPTION 'A alteração de agenda não referencia a fotografia exata'; END IF;
  IF NEW.snapshot->'base'->>'conclusaoOriginalId' IS DISTINCT FROM agenda."conclusaoFonteId"
    OR NEW.snapshot->'base'->>'conclusaoHash' IS DISTINCT FROM agenda.fotografia->>'fonteContratualHash'
    OR NEW.snapshot->>'preparadaPorId' IS DISTINCT FROM NEW."preparadaPorId" THEN
    RAISE EXCEPTION 'Fonte ou autor da proposta de agenda diverge do aditivo';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER vincular_agenda_proposta_aditivo_117 BEFORE INSERT ON "PropostaAditivoContratual"
FOR EACH ROW EXECUTE FUNCTION vincular_agenda_proposta_aditivo_117();

CREATE FUNCTION vincular_agenda_versao_condicoes_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId" FOR SHARE;
  IF proposta."propostaAgendaId" IS NULL AND NEW."propostaAgendaId" IS NOT NULL THEN
    RAISE EXCEPTION 'Versão não pode vincular fotografia ausente na proposta';
  END IF;
  IF proposta."propostaAgendaId" IS NOT NULL AND NEW."propostaAgendaId" IS DISTINCT FROM proposta."propostaAgendaId" THEN
    RAISE EXCEPTION 'Versão formalizada não corresponde à fotografia aprovada';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER vincular_agenda_versao_condicoes_117 BEFORE INSERT ON "VersaoCondicoesAditivo"
FOR EACH ROW EXECUTE FUNCTION vincular_agenda_versao_condicoes_117();

CREATE FUNCTION validar_aplicacao_agenda_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE agenda "PropostaAgendaAditivoParticular"%ROWTYPE;
        proposta "PropostaAditivoContratual"%ROWTYPE;
        aplicacao "AplicacaoCondicoesAditivo"%ROWTYPE;
        decisao "DecisaoAlcadaAditivo"%ROWTYPE;
        ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicação de agenda do aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO agenda FROM "PropostaAgendaAditivoParticular" WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND OR agenda."matriculaId" IS DISTINCT FROM NEW."matriculaId"
    OR agenda."fotografiaHash" IS DISTINCT FROM NEW."fotografiaHash" OR agenda.pendencias <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Aplicação não corresponde à fotografia de agenda sem pendências';
  END IF;
  PERFORM id FROM "Matricula" WHERE id = agenda."matriculaId" AND status = 'ATIVA' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula da agenda não está ativa'; END IF;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE "propostaAgendaId" = agenda.id FOR SHARE;
  SELECT * INTO aplicacao FROM "AplicacaoCondicoesAditivo" WHERE id = NEW."aplicacaoCondicoesId" FOR SHARE;
  IF proposta.id IS NULL OR aplicacao.id IS NULL OR aplicacao."propostaId" IS DISTINCT FROM proposta.id
    OR aplicacao."matriculaId" IS DISTINCT FROM agenda."matriculaId" OR aplicacao."autorId" IS DISTINCT FROM NEW."aplicadorId"
    OR NOT EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" v WHERE v.id = aplicacao."versaoCondicoesId"
      AND v."propostaId" = proposta.id AND v."propostaAgendaId" = agenda.id) THEN
    RAISE EXCEPTION 'Aplicação de condições formalizada não corresponde à agenda';
  END IF;
  SELECT * INTO decisao FROM "DecisaoAlcadaAditivo" WHERE "propostaId" = proposta.id AND alcada = 'PEDAGOGICA' FOR SHARE;
  IF decisao.id IS NULL OR NOT decisao.aprovada OR decisao."propostaHash" IS DISTINCT FROM proposta."entradaHash"
    OR decisao."decisorId" = agenda."preparadorId" OR decisao."decisorId" = proposta."preparadaPorId" THEN
    RAISE EXCEPTION 'Aplicação da agenda exige alçada pedagógica aprovada por outro preparador';
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."aplicadorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA', 'ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Aplicação da agenda exige Secretaria ou Administração ativa';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao) THEN
    RAISE EXCEPTION 'A proposta de aditivo foi superada';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(agenda.fotografia->'encontros') item
    LEFT JOIN "EncontroAgenda" e ON e.id = item->>'encontroId'
    WHERE e.id IS NULL OR e."matriculaId" IS DISTINCT FROM agenda."matriculaId"
      OR e."professorId" IS DISTINCT FROM item->>'professorNovoId'
      OR e.inicio IS DISTINCT FROM (item->>'inicioNovo')::timestamp(3)
      OR e.fim IS DISTINCT FROM (item->>'fimNovo')::timestamp(3)
      OR e."fusoOrigem" IS DISTINCT FROM item->>'fusoNovo'
  ) THEN RAISE EXCEPTION 'Os encontros não foram aplicados atomicamente conforme a fotografia aprovada'; END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  NEW."aplicadaEm" := clock_timestamp() AT TIME ZONE 'UTC';
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_aplicacao_agenda_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoAgendaAditivoParticular"
FOR EACH ROW EXECUTE FUNCTION validar_aplicacao_agenda_aditivo_117();

-- O registro de condições é inserido antes da atualização dos encontros na
-- mesma transação. A guarda deferred impede que ele seja confirmado sozinho.
CREATE FUNCTION exigir_aplicacao_agenda_correspondente_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE versao "VersaoCondicoesAditivo"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  SELECT * INTO versao FROM "VersaoCondicoesAditivo" WHERE id=NEW."versaoCondicoesId" FOR SHARE;
  IF versao."propostaAgendaId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "AplicacaoAgendaAditivoParticular" agenda
    WHERE agenda."aplicacaoCondicoesId"=NEW.id AND agenda."matriculaId"=NEW."matriculaId"
      AND agenda."aplicadorId"=NEW."autorId"
      AND agenda."propostaId"=versao."propostaAgendaId"
  ) THEN RAISE EXCEPTION 'Aplicação de condições com agenda exige aplicação atômica da agenda'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER exigir_aplicacao_agenda_correspondente_117
AFTER INSERT ON "AplicacaoCondicoesAditivo" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION exigir_aplicacao_agenda_correspondente_117();
