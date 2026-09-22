-- Origem contratual histórica: contrato legado assinado fora do sistema vira fonte de aditivos por
-- PDF assinado + transcrição das condições + conferência dupla (preparador ≠ decisor, que declara os hashes
-- conferidos). Uma matrícula tem exatamente uma fonte: conclusão assinada OU origem histórica aprovada.
-- Aditivos sobre a origem histórica não alteram taxa, primeira mensalidade nem adiantamento.

-- AlterTable
ALTER TABLE "PropostaAditivoContratual" ADD COLUMN     "origemHistoricaId" TEXT,
ALTER COLUMN "conclusaoOriginalId" DROP NOT NULL;
-- AlterTable
ALTER TABLE "PropostaAgendaAditivoParticular" ADD COLUMN     "origemHistoricaId" TEXT,
ALTER COLUMN "conclusaoFonteId" DROP NOT NULL;
-- CreateTable
CREATE TABLE "PropostaOrigemContratualHistorica" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "assinadoEm" TIMESTAMP(3) NOT NULL,
    "pdfAssinado" BYTEA NOT NULL,
    "pdfHash" TEXT NOT NULL,
    "transcricao" JSONB NOT NULL,
    "transcricaoHash" TEXT NOT NULL,
    "projecao" JSONB NOT NULL,
    "projecaoHash" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropostaOrigemContratualHistorica_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "DecisaoOrigemContratualHistorica" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "pdfHashConferido" TEXT NOT NULL,
    "transcricaoHashConferido" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisaoOrigemContratualHistorica_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PropostaOrigemContratualHistorica_matriculaId_criadaEm_idx" ON "PropostaOrigemContratualHistorica"("matriculaId", "criadaEm");
-- CreateIndex
CREATE UNIQUE INDEX "PropostaOrigemContratualHistorica_preparadorId_chaveIdempot_key" ON "PropostaOrigemContratualHistorica"("preparadorId", "chaveIdempotencia");
-- CreateIndex
CREATE UNIQUE INDEX "DecisaoOrigemContratualHistorica_propostaId_key" ON "DecisaoOrigemContratualHistorica"("propostaId");
-- AddForeignKey
ALTER TABLE "PropostaOrigemContratualHistorica" ADD CONSTRAINT "PropostaOrigemContratualHistorica_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
-- AddForeignKey
ALTER TABLE "PropostaOrigemContratualHistorica" ADD CONSTRAINT "PropostaOrigemContratualHistorica_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
-- AddForeignKey
ALTER TABLE "DecisaoOrigemContratualHistorica" ADD CONSTRAINT "DecisaoOrigemContratualHistorica_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaOrigemContratualHistorica"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
-- AddForeignKey
ALTER TABLE "DecisaoOrigemContratualHistorica" ADD CONSTRAINT "DecisaoOrigemContratualHistorica_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
-- AddForeignKey
ALTER TABLE "PropostaAditivoContratual" ADD CONSTRAINT "PropostaAditivoContratual_origemHistoricaId_fkey" FOREIGN KEY ("origemHistoricaId") REFERENCES "PropostaOrigemContratualHistorica"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
-- AddForeignKey
ALTER TABLE "PropostaAgendaAditivoParticular" ADD CONSTRAINT "PropostaAgendaAditivoParticular_origemHistoricaId_fkey" FOREIGN KEY ("origemHistoricaId") REFERENCES "PropostaOrigemContratualHistorica"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


ALTER TABLE "PropostaAditivoContratual" ADD CONSTRAINT "PropostaAditivoContratual_fonte_unica"
  CHECK (num_nonnulls("conclusaoOriginalId", "origemHistoricaId") = 1);
ALTER TABLE "PropostaAgendaAditivoParticular" ADD CONSTRAINT "PropostaAgendaAditivoParticular_fonte_unica"
  CHECK (num_nonnulls("conclusaoFonteId", "origemHistoricaId") = 1);

-- Proposta: administrador ativo; PDF íntegro; matrícula sem conclusão assinada nem origem aprovada; projeção coerente.
CREATE FUNCTION guardar_origem_contratual_historica() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Origem contratual histórica é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula inexistente'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."preparadorId" FOR SHARE;
  IF NOT FOUND OR NOT u.ativo OR NOT (u.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Secretaria ou Administração ativa'; END IF;
  IF encode(sha256(NEW."pdfAssinado"), 'hex') IS DISTINCT FROM NEW."pdfHash" OR substring(NEW."pdfAssinado" FROM 1 FOR 5) <> decode('255044462d', 'hex') THEN
    RAISE EXCEPTION 'PDF assinado inválido ou hash divergente';
  END IF;
  IF jsonb_typeof(NEW.transcricao) IS DISTINCT FROM 'object' OR jsonb_typeof(NEW.projecao) IS DISTINCT FROM 'object'
    OR NEW.projecao->'condicoes'->'aulas'->>'regime' NOT IN ('MENSALIDADE','HORA_PARTICULAR')
    OR NEW.projecao->'condicoes'->>'moeda' IS DISTINCT FROM NEW.transcricao->>'moeda'
    OR jsonb_typeof(NEW.projecao->'documento'->'campos') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Transcrição ou projeção da origem histórica incompleta';
  END IF;
  IF EXISTS (SELECT 1 FROM "ConclusaoAssinaturaContratual" c JOIN "ProcessoAssinaturaContratual" p ON p.id = c."processoId" WHERE p."matriculaId" = NEW."matriculaId") THEN
    RAISE EXCEPTION 'A matrícula já possui contrato assinado no sistema';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaOrigemContratualHistorica" o JOIN "DecisaoOrigemContratualHistorica" d ON d."propostaId" = o.id AND d.aprovada WHERE o."matriculaId" = NEW."matriculaId") THEN
    RAISE EXCEPTION 'A matrícula já possui origem contratual histórica aprovada';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaOrigemContratualHistorica" o LEFT JOIN "DecisaoOrigemContratualHistorica" d ON d."propostaId" = o.id WHERE o."matriculaId" = NEW."matriculaId" AND d.id IS NULL) THEN
    RAISE EXCEPTION 'Já existe origem contratual histórica aguardando conferência';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guardar_origem_contratual_historica BEFORE INSERT OR UPDATE OR DELETE ON "PropostaOrigemContratualHistorica" FOR EACH ROW EXECUTE FUNCTION guardar_origem_contratual_historica();

-- Conferência dupla: outro administrador declara os hashes que conferiu no PDF e na transcrição.
CREATE FUNCTION guardar_decisao_origem_contratual_historica() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; o "PropostaOrigemContratualHistorica"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão da origem contratual histórica é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO o FROM "PropostaOrigemContratualHistorica" WHERE id = NEW."propostaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Origem contratual histórica inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = o."matriculaId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF NOT FOUND OR NOT u.ativo OR NOT ('ADMINISTRADOR'::"Papel" = ANY(u.papeis)) OR NEW."decisorId" = o."preparadorId" THEN RAISE EXCEPTION 'Conferência exige outro administrador ativo'; END IF;
  IF NEW."pdfHashConferido" IS DISTINCT FROM o."pdfHash" OR NEW."transcricaoHashConferido" IS DISTINCT FROM o."transcricaoHash" THEN
    RAISE EXCEPTION 'Os hashes conferidos divergem da origem preservada';
  END IF;
  IF NEW.aprovada THEN
    IF EXISTS (SELECT 1 FROM "ConclusaoAssinaturaContratual" c JOIN "ProcessoAssinaturaContratual" p ON p.id = c."processoId" WHERE p."matriculaId" = o."matriculaId") THEN
      RAISE EXCEPTION 'A matrícula já possui contrato assinado no sistema';
    END IF;
    IF EXISTS (SELECT 1 FROM "PropostaOrigemContratualHistorica" o2 JOIN "DecisaoOrigemContratualHistorica" d2 ON d2."propostaId" = o2.id AND d2.aprovada WHERE o2."matriculaId" = o."matriculaId") THEN
      RAISE EXCEPTION 'A matrícula já possui origem contratual histórica aprovada';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guardar_decisao_origem_contratual_historica BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoOrigemContratualHistorica" FOR EACH ROW EXECUTE FUNCTION guardar_decisao_origem_contratual_historica();

-- Contrato assinado no sistema depois de uma origem histórica aprovada criaria duas fontes.
CREATE FUNCTION recusar_conclusao_com_origem_historica() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProcessoAssinaturaContratual" p JOIN "PropostaOrigemContratualHistorica" o ON o."matriculaId" = p."matriculaId"
    JOIN "DecisaoOrigemContratualHistorica" d ON d."propostaId" = o.id AND d.aprovada WHERE p.id = NEW."processoId") THEN
    RAISE EXCEPTION 'A matrícula já possui origem contratual histórica aprovada';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER recusar_conclusao_com_origem_historica BEFORE INSERT ON "ConclusaoAssinaturaContratual" FOR EACH ROW EXECUTE FUNCTION recusar_conclusao_com_origem_historica();

-- Ajudantes comuns aos guards Q117: bloquear a fonte (processo ou origem) e ler a prévia (snapshot da prévia ou projeção histórica).
CREATE FUNCTION bloquear_fonte_aditivo_117(p "PropostaAditivoContratual") RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p."origemHistoricaId" IS NOT NULL THEN
    PERFORM id FROM "PropostaOrigemContratualHistorica" WHERE id = p."origemHistoricaId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Origem contratual histórica indisponível'; END IF;
  ELSE
    PERFORM "processoId" FROM "ConclusaoAssinaturaContratual" WHERE id = p."conclusaoOriginalId" FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conclusão original indisponível'; END IF;
    PERFORM id FROM "ProcessoAssinaturaContratual" WHERE id = (SELECT "processoId" FROM "ConclusaoAssinaturaContratual" WHERE id = p."conclusaoOriginalId") FOR UPDATE;
  END IF;
END;
$$;
CREATE FUNCTION previa_fonte_aditivo_117(p "PropostaAditivoContratual") RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p."origemHistoricaId" IS NOT NULL
    THEN (SELECT o.projecao FROM "PropostaOrigemContratualHistorica" o WHERE o.id = p."origemHistoricaId")
    ELSE (SELECT pv.snapshot FROM "ConclusaoAssinaturaContratual" c JOIN "ProcessoAssinaturaContratual" pr ON pr.id = c."processoId"
          JOIN "ArtefatoContratual" a ON a.id = pr."artefatoId" JOIN "PreviaDocumentoContratual" pv ON pv.id = a."previaId" WHERE c.id = p."conclusaoOriginalId") END
$$;

CREATE OR REPLACE FUNCTION conferir_fonte_aditivo_117(p "PropostaAditivoContratual")
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE c "ConclusaoAssinaturaContratual"%ROWTYPE; processo "ProcessoAssinaturaContratual"%ROWTYPE; origem "PropostaOrigemContratualHistorica"%ROWTYPE;
        artefato "ArtefatoContratual"%ROWTYPE; modelo "VersaoModeloContratual"%ROWTYPE; publicacao "DecisaoModeloContratual"%ROWTYPE;
        ultima "VersaoCondicoesAditivo"%ROWTYPE; cadeia JSONB;
BEGIN
  -- Ordem global: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  SELECT * INTO modelo FROM "VersaoModeloContratual" WHERE id = p."modeloId" FOR SHARE;
  SELECT * INTO publicacao FROM "DecisaoModeloContratual" WHERE "modeloId" = p."modeloId" AND aprovada FOR SHARE;
  IF NOT FOUND OR modelo.conteudo->>'finalidade' <> 'ADITIVO' THEN RAISE EXCEPTION 'Aditivo exige modelo ADITIVO aprovado'; END IF;
  IF p.snapshot->'base'->>'modeloHash' IS DISTINCT FROM modelo."conteudoHash"
    OR p.snapshot->'base'->>'publicacaoId' IS DISTINCT FROM publicacao.id THEN
    RAISE EXCEPTION 'Base preservada não corresponde ao modelo ou à publicação';
  END IF;
  IF p."origemHistoricaId" IS NOT NULL THEN
    -- Contrato legado: a fonte é a origem histórica aprovada (PDF + transcrição conferidos), sem conclusão no sistema.
    SELECT * INTO origem FROM "PropostaOrigemContratualHistorica" WHERE id = p."origemHistoricaId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Origem contratual histórica indisponível'; END IF;
    IF origem."matriculaId" IS DISTINCT FROM p."matriculaId"
      OR NOT EXISTS (SELECT 1 FROM "DecisaoOrigemContratualHistorica" d WHERE d."propostaId" = origem.id AND d.aprovada) THEN
      RAISE EXCEPTION 'Aditivo exige origem contratual histórica aprovada na mesma matrícula';
    END IF;
    IF p.snapshot->'base'->>'tipo' IS DISTINCT FROM 'ORIGEM_HISTORICA'
      OR p.snapshot->'base'->>'origemHistoricaId' IS DISTINCT FROM origem.id
      OR p.snapshot->'base'->>'origemHash' IS DISTINCT FROM origem."entradaHash"
      OR p.snapshot->'base'->>'pdfAssinadoHash' IS DISTINCT FROM origem."pdfHash"
      OR p.snapshot->'base'->>'transcricaoHash' IS DISTINCT FROM origem."transcricaoHash"
      OR p.snapshot->'base'->>'projecaoHash' IS DISTINCT FROM origem."projecaoHash" THEN
      RAISE EXCEPTION 'Base preservada não corresponde à origem contratual histórica';
    END IF;
    IF EXISTS (SELECT 1 FROM "ConclusaoAssinaturaContratual" outra JOIN "ProcessoAssinaturaContratual" op ON op.id = outra."processoId" WHERE op."matriculaId" = p."matriculaId")
      OR EXISTS (SELECT 1 FROM "PropostaOrigemContratualHistorica" o2 JOIN "DecisaoOrigemContratualHistorica" d2 ON d2."propostaId" = o2.id AND d2.aprovada WHERE o2."matriculaId" = p."matriculaId" AND o2.id <> origem.id) THEN
      RAISE EXCEPTION 'Há mais de uma fonte contratual nesta matrícula';
    END IF;
  ELSE
    SELECT * INTO c FROM "ConclusaoAssinaturaContratual" WHERE id = p."conclusaoOriginalId" FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conclusão original indisponível'; END IF;
    SELECT * INTO processo FROM "ProcessoAssinaturaContratual" WHERE id = c."processoId" FOR UPDATE;
    SELECT * INTO artefato FROM "ArtefatoContratual" WHERE id = processo."artefatoId" FOR SHARE;
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
      OR p.snapshot->'base'->>'artefatoOriginalId' IS DISTINCT FROM artefato.id THEN
      RAISE EXCEPTION 'Base preservada não corresponde à conclusão, original, modelo ou publicação';
    END IF;
    IF EXISTS (SELECT 1 FROM "ConclusaoAssinaturaContratual" outra JOIN "ProcessoAssinaturaContratual" op ON op.id = outra."processoId"
      WHERE op."matriculaId" = p."matriculaId" AND outra.id <> c.id)
      OR EXISTS (SELECT 1 FROM "PropostaOrigemContratualHistorica" o2 JOIN "DecisaoOrigemContratualHistorica" d2 ON d2."propostaId" = o2.id AND d2.aprovada WHERE o2."matriculaId" = p."matriculaId") THEN
      RAISE EXCEPTION 'Há mais de um original assinado nesta matrícula';
    END IF;
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

CREATE OR REPLACE FUNCTION validar_proposta_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE ator "Usuario"%ROWTYPE; ultima INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta de aditivo contratual é imutável'; END IF;
  IF NOT (NEW.snapshot ?& ARRAY['matriculaId','conclusaoOriginalId','modeloId','versao','preparadaPorId','vigenciaInicio','motivo','baseHash','alteracoesHash','base','alteracoes','documento','entrada'])
    OR jsonb_typeof(NEW.snapshot->'base') <> 'object' OR jsonb_typeof(NEW.snapshot->'alteracoes') <> 'array'
    OR jsonb_array_length(NEW.snapshot->'alteracoes') = 0 OR jsonb_typeof(NEW.snapshot->'documento') <> 'object'
    OR jsonb_typeof(NEW.snapshot->'entrada') <> 'object'
    OR NEW.snapshot->>'matriculaId' IS DISTINCT FROM NEW."matriculaId"
    OR NEW.snapshot->>'conclusaoOriginalId' IS DISTINCT FROM NEW."conclusaoOriginalId"
    OR NEW.snapshot->>'origemHistoricaId' IS DISTINCT FROM NEW."origemHistoricaId"
    OR NEW.snapshot->>'modeloId' IS DISTINCT FROM NEW."modeloId"
    OR NEW.snapshot->>'versao' IS DISTINCT FROM NEW.versao::text
    OR NEW.snapshot->>'preparadaPorId' IS DISTINCT FROM NEW."preparadaPorId"
    OR NEW.snapshot->>'motivo' IS DISTINCT FROM NEW.motivo
    OR NEW.snapshot->>'baseHash' IS DISTINCT FROM NEW."baseHash"
    OR NEW.snapshot->>'alteracoesHash' IS DISTINCT FROM NEW."alteracoesHash"
    OR NEW.snapshot->>'vigenciaInicio' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$'
    OR (NEW.snapshot->>'vigenciaInicio')::timestamptz <> NEW."vigenciaInicio" AT TIME ZONE 'UTC' THEN
    RAISE EXCEPTION 'Snapshot do aditivo não corresponde à proposta';
  END IF;
  -- Contrato legado: taxa, vencimento da primeira mensalidade e adiantamento são fatos de entrada já vividos.
  IF NEW."origemHistoricaId" IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'alteracoes') a
    WHERE a->>'campo' IN ('TAXA_VALOR','TAXA_VENCIMENTO','PRIMEIRA_MENSALIDADE_VENCIMENTO','ADIANTAMENTO_VALOR','ADIANTAMENTO_MINUTOS','ADIANTAMENTO_VENCIMENTO')) THEN
    RAISE EXCEPTION 'Contrato de origem histórica não admite aditivo de taxa, primeira mensalidade ou adiantamento';
  END IF;
  PERFORM conferir_fonte_aditivo_117(NEW);
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."preparadaPorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Secretaria ou Administração ativa'; END IF;
  SELECT COALESCE(MAX(versao), 0) INTO ultima FROM "PropostaAditivoContratual" WHERE "matriculaId" = NEW."matriculaId";
  IF NEW.versao <> ultima + 1 THEN RAISE EXCEPTION 'Versão da proposta de aditivo mudou'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_decisao_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de aditivo contratual é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM bloquear_fonte_aditivo_117(proposta);
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT ('ADMINISTRADOR'::"Papel" = ANY(ator.papeis)) OR NEW."decisorId" = proposta."preparadaPorId" THEN RAISE EXCEPTION 'Decisão exige outro administrador ativo'; END IF;
  IF NEW."propostaHash" IS DISTINCT FROM proposta."entradaHash" THEN RAISE EXCEPTION 'Decisão não corresponde à proposta exata'; END IF;
  IF NEW.aprovada THEN
    IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao) THEN RAISE EXCEPTION 'Existe proposta de aditivo mais recente'; END IF;
    PERFORM conferir_fonte_aditivo_117(proposta);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_artefato_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE; conferencia "ConferenciaParticipantesAditivo"%ROWTYPE;
        decisao "DecisaoAditivoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Original de aditivo contratual é imutável'; END IF;
  -- Ordem global: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM bloquear_fonte_aditivo_117(proposta);
  SELECT * INTO conferencia FROM "ConferenciaParticipantesAditivo" WHERE id = NEW."conferenciaId" FOR SHARE;
  IF NOT FOUND OR conferencia."propostaId" IS DISTINCT FROM proposta.id THEN RAISE EXCEPTION 'Conferência não corresponde à proposta'; END IF;
  SELECT * INTO decisao FROM "DecisaoAditivoContratual" WHERE id = conferencia."decisaoId" FOR SHARE;
  IF NOT FOUND OR NOT decisao.aprovada OR decisao."propostaId" IS DISTINCT FROM proposta.id
    OR decisao."propostaHash" IS DISTINCT FROM proposta."entradaHash" OR conferencia."propostaHash" IS DISTINCT FROM proposta."entradaHash" THEN
    RAISE EXCEPTION 'Original exige proposta aprovada e conferência da versão exata';
  END IF;
  IF EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" nova WHERE nova."propostaId" = proposta.id AND nova.versao > conferencia.versao)
    OR EXISTS (SELECT 1 FROM "PropostaAditivoContratual" nova WHERE nova."matriculaId" = proposta."matriculaId" AND nova.versao > proposta.versao) THEN
    RAISE EXCEPTION 'A conferência ou proposta de aditivo foi superada';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, conferencia);
  IF substring(NEW.pdf FROM 1 FOR 5) <> decode('255044462d', 'hex')
    OR encode(sha256(NEW.pdf), 'hex') IS DISTINCT FROM NEW."pdfHash" THEN
    RAISE EXCEPTION 'Original de aditivo sem PDF íntegro';
  END IF;
  IF NEW."baseHash" IS DISTINCT FROM encode(sha256(convert_to(format('{"conferenciaHash":"%s","propostaHash":"%s"}', conferencia."revisaoHash", proposta."entradaHash"), 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'Hash de base não corresponde à proposta e conferência';
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Preservação exige Secretaria ou Administração ativa';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_conferencia_assinatura_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE artefato "ArtefatoAditivoContratual"%ROWTYPE; proposta "PropostaAditivoContratual"%ROWTYPE;
        participantes "ConferenciaParticipantesAditivo"%ROWTYPE; decisao "DecisaoAditivoContratual"%ROWTYPE; ator "Usuario"%ROWTYPE;
        participantes_projetados JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferência interna de aditivo é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = NEW."artefatoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original de aditivo inexistente'; END IF;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = artefato."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM bloquear_fonte_aditivo_117(proposta);
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
  SELECT * INTO decisao FROM "DecisaoAditivoContratual" WHERE id = participantes."decisaoId" FOR SHARE;
  IF NOT FOUND OR participantes."propostaId" IS DISTINCT FROM proposta.id OR NOT decisao.aprovada
    OR decisao."propostaHash" IS DISTINCT FROM proposta."entradaHash" OR participantes."propostaHash" IS DISTINCT FROM proposta."entradaHash" THEN
    RAISE EXCEPTION 'Conferência exige artefato da proposta aprovada e exata';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao)
    OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId" = proposta.id AND n.versao > participantes.versao) THEN
    RAISE EXCEPTION 'A proposta ou os participantes foram superados';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, participantes);
  IF encode(sha256(artefato.pdf), 'hex') IS DISTINCT FROM artefato."pdfHash" OR substring(artefato.pdf FROM 1 FOR 5) <> decode('255044462d', 'hex') THEN
    RAISE EXCEPTION 'Original de aditivo sem integridade';
  END IF;
  IF artefato."baseHash" IS DISTINCT FROM encode(sha256(convert_to(format('{"conferenciaHash":"%s","propostaHash":"%s"}', participantes."revisaoHash", proposta."entradaHash"), 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'Base do artefato divergente';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('papel', item->'papel', 'etapa', item->'etapa', 'identidade', item->'identidade') ORDER BY ordem), '[]'::jsonb)
    INTO participantes_projetados
    FROM jsonb_array_elements(participantes.snapshot->'participantes') WITH ORDINALITY AS p(item, ordem);
  IF NOT (NEW.snapshot ?& ARRAY['propostaId','artefatoId','conferenciaId','propostaHash','conferenciaHash','pdfHash','baseHash','decisaoId','modelo','ambiente','participantes'])
    OR NEW.snapshot->>'propostaId' IS DISTINCT FROM proposta.id OR NEW.snapshot->>'artefatoId' IS DISTINCT FROM artefato.id
    OR NEW.snapshot->>'conferenciaId' IS DISTINCT FROM participantes.id OR NEW.snapshot->>'propostaHash' IS DISTINCT FROM proposta."entradaHash"
    OR NEW.snapshot->>'conferenciaHash' IS DISTINCT FROM participantes."revisaoHash" OR NEW.snapshot->>'pdfHash' IS DISTINCT FROM artefato."pdfHash"
    OR NEW.snapshot->>'baseHash' IS DISTINCT FROM artefato."baseHash" OR NEW.snapshot->>'decisaoId' IS DISTINCT FROM decisao.id
    OR NEW.snapshot->>'versaoProposta' IS DISTINCT FROM proposta.versao::text
    OR NEW.snapshot->>'conferenciaVersao' IS DISTINCT FROM participantes.versao::text
    OR NEW.snapshot->'modelo' IS DISTINCT FROM jsonb_build_object('codigo', proposta.snapshot->'base'->'modeloCodigo', 'versao', proposta.snapshot->'base'->'modeloVersao')
    OR NEW.snapshot->>'ambiente' IS DISTINCT FROM proposta.snapshot->'base'->>'ambiente'
    OR NEW.snapshot->>'vigenciaInicio' IS DISTINCT FROM proposta.snapshot->>'vigenciaInicio'
    OR NEW.snapshot->'participantes' IS DISTINCT FROM participantes_projetados THEN
    RAISE EXCEPTION 'Snapshot da conferência interna não corresponde ao artefato';
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Conferência exige Secretaria ou Administração ativa'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_decisao_alcada_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE; decisao "DecisaoAditivoContratual"%ROWTYPE;
        ator "Usuario"%ROWTYPE; campos TEXT[];
        aplicavel BOOLEAN := FALSE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de alçada de aditivo é imutável'; END IF;
  -- Ordem global: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
  PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
  PERFORM bloquear_fonte_aditivo_117(proposta);
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

CREATE OR REPLACE FUNCTION validar_compatibilidade_aplicacao_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v "VersaoCondicoesAditivo"%ROWTYPE; p "PropostaAditivoContratual"%ROWTYPE; m "Matricula"%ROWTYPE; preparacao "PreparacaoComercialMatricula"%ROWTYPE;
        regime_original TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id = NEW."versaoCondicoesId" FOR SHARE;
  SELECT * INTO p FROM "PropostaAditivoContratual" WHERE id = v."propostaId" FOR SHARE;
  SELECT * INTO m FROM "Matricula" WHERE id = v."matriculaId" FOR UPDATE;
  SELECT * INTO preparacao FROM "PreparacaoComercialMatricula" WHERE "matriculaId" = m.id FOR SHARE;
  PERFORM bloquear_fonte_aditivo_117(p);
  regime_original := previa_fonte_aditivo_117(p)->'condicoes'->'aulas'->>'regime';
  IF regime_original IS NULL OR regime_original NOT IN ('MENSALIDADE','HORA_PARTICULAR') THEN RAISE EXCEPTION 'Regime do contrato assinado exige conferência'; END IF;
  IF preparacao.id IS NOT NULL AND preparacao.regime::text IS DISTINCT FROM regime_original THEN RAISE EXCEPTION 'Preparação comercial diverge do contrato assinado'; END IF;
  IF v.condicoes ? 'MENSALIDADE_VALOR' AND (
    jsonb_typeof(v.condicoes->'MENSALIDADE_VALOR') IS DISTINCT FROM 'object'
    OR v.condicoes->'MENSALIDADE_VALOR'->>'tipo' IS DISTINCT FROM 'DINHEIRO'
    OR v.condicoes->'MENSALIDADE_VALOR'->>'moeda' IS DISTINCT FROM m.moeda
    OR regime_original IS DISTINCT FROM 'MENSALIDADE'
  ) THEN RAISE EXCEPTION 'Valor mensal incompatível com moeda ou regime atual'; END IF;
  IF v.condicoes ? 'HORA_VALOR' AND (
    jsonb_typeof(v.condicoes->'HORA_VALOR') IS DISTINCT FROM 'object'
    OR v.condicoes->'HORA_VALOR'->>'tipo' IS DISTINCT FROM 'DINHEIRO'
    OR v.condicoes->'HORA_VALOR'->>'moeda' IS DISTINCT FROM m.moeda
    OR regime_original IS DISTINCT FROM 'HORA_PARTICULAR'
  ) THEN RAISE EXCEPTION 'Valor por hora incompatível com moeda ou regime atual'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_proposta_agenda_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE;
        conclusao "ConclusaoAssinaturaContratual"%ROWTYPE;
        processo "ProcessoAssinaturaContratual"%ROWTYPE;
        origem "PropostaOrigemContratualHistorica"%ROWTYPE;
        ator "Usuario"%ROWTYPE; fonte_hash TEXT; fonte_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta de agenda do aditivo é imutável'; END IF;
  -- Ordem comum dos guardas Q117: calendário, matrícula, processo fonte, usuário.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" AND status = 'ATIVA' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula da proposta de agenda não está ativa'; END IF;
  IF NEW."origemHistoricaId" IS NOT NULL THEN
    -- Contrato legado: a origem histórica aprovada é a fonte contratual da agenda.
    SELECT * INTO origem FROM "PropostaOrigemContratualHistorica" WHERE id = NEW."origemHistoricaId" FOR UPDATE;
    IF origem.id IS NULL OR origem."matriculaId" IS DISTINCT FROM NEW."matriculaId"
      OR NOT EXISTS (SELECT 1 FROM "DecisaoOrigemContratualHistorica" d WHERE d."propostaId" = origem.id AND d.aprovada) THEN
      RAISE EXCEPTION 'Origem contratual histórica aprovada é obrigatória para a agenda';
    END IF;
    fonte_id := origem.id; fonte_hash := origem."entradaHash";
  ELSE
    SELECT * INTO conclusao FROM "ConclusaoAssinaturaContratual" WHERE id = NEW."conclusaoFonteId" FOR SHARE;
    SELECT * INTO processo FROM "ProcessoAssinaturaContratual" WHERE id = conclusao."processoId" FOR UPDATE;
    IF conclusao.id IS NULL OR processo.id IS NULL OR processo."matriculaId" IS DISTINCT FROM NEW."matriculaId"
      OR processo.ambiente <> 'PRODUCAO' OR processo.estado <> 'ENVIADO'
      OR processo."referenciaExterna" IS NULL OR processo."referenciaExterna" IS DISTINCT FROM conclusao."referenciaExterna"
      OR NOT EXISTS (SELECT 1 FROM "AceiteOriginalContratual" a WHERE a."matriculaId" = NEW."matriculaId" AND a."conclusaoId" = conclusao.id) THEN
      RAISE EXCEPTION 'Fonte original aceita em produção é obrigatória para a agenda';
    END IF;
    fonte_id := conclusao.id; fonte_hash := conclusao."entradaHash";
  END IF;
  SELECT * INTO ator FROM "Usuario" WHERE id = NEW."preparadorId" FOR SHARE;
  IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA', 'ADMINISTRADOR', 'GERENTE_PEDAGOGICO']::"Papel"[]) THEN
    RAISE EXCEPTION 'Proposta de agenda exige perfil acadêmico ou administrativo ativo';
  END IF;
  IF jsonb_typeof(NEW.fotografia) IS DISTINCT FROM 'object' OR jsonb_typeof(NEW.pendencias) IS DISTINCT FROM 'array'
    OR NEW.fotografia->>'matriculaId' IS DISTINCT FROM NEW."matriculaId"
    OR NEW.fotografia->>'preparadorId' IS DISTINCT FROM NEW."preparadorId"
    OR NEW.fotografia->>'fonteContratualId' IS DISTINCT FROM fonte_id
    OR NEW.fotografia->>'fonteContratualHash' IS DISTINCT FROM fonte_hash
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

CREATE OR REPLACE FUNCTION vincular_agenda_proposta_aditivo_117() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE agenda "PropostaAgendaAditivoParticular"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  IF NEW."propostaAgendaId" IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO agenda FROM "PropostaAgendaAditivoParticular" WHERE id = NEW."propostaAgendaId" FOR SHARE;
  IF NOT FOUND OR agenda."matriculaId" IS DISTINCT FROM NEW."matriculaId"
    OR agenda."conclusaoFonteId" IS DISTINCT FROM NEW."conclusaoOriginalId"
    OR agenda."origemHistoricaId" IS DISTINCT FROM NEW."origemHistoricaId"
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
    OR NEW.snapshot->'base'->>'origemHistoricaId' IS DISTINCT FROM agenda."origemHistoricaId"
    OR COALESCE(NEW.snapshot->'base'->>'conclusaoHash', NEW.snapshot->'base'->>'origemHash') IS DISTINCT FROM agenda.fotografia->>'fonteContratualHash'
    OR NEW.snapshot->>'preparadaPorId' IS DISTINCT FROM NEW."preparadaPorId" THEN
    RAISE EXCEPTION 'Fonte ou autor da proposta de agenda diverge do aditivo';
  END IF;
  RETURN NEW;
END;
$$;
