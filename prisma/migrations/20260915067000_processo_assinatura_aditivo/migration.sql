-- Q117: processo interno de envio do aditivo. O transporte é externo a estes fatos.
CREATE TABLE "ProcessoAssinaturaAditivo" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "artefatoId" TEXT NOT NULL UNIQUE REFERENCES "ArtefatoAditivoContratual"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "conferenciaId" TEXT NOT NULL UNIQUE REFERENCES "ConferenciaAssinaturaAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "preparadorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  fornecedor TEXT NOT NULL CHECK (fornecedor IN ('ZAPSIGN', 'CLICKSIGN', 'DOCUSIGN')),
  ambiente TEXT NOT NULL CHECK (ambiente IN ('SANDBOX', 'PRODUCAO')),
  estado "EstadoEnvioAssinatura" NOT NULL DEFAULT 'PREPARADO',
  "tentativaAtual" INTEGER NOT NULL DEFAULT 0 CHECK ("tentativaAtual" >= 0),
  "referenciaExterna" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "ProcessoAssinaturaAditivo_fornecedor_ambiente_referencia_key" UNIQUE (fornecedor, ambiente, "referenciaExterna")
);
CREATE TABLE "TentativaEnvioAditivo" (
  id TEXT PRIMARY KEY,
  "processoId" TEXT NOT NULL REFERENCES "ProcessoAssinaturaAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  numero INTEGER NOT NULL CHECK (numero > 0),
  "revisaoHash" TEXT NOT NULL CHECK ("revisaoHash" ~ '^[a-f0-9]{64}$'),
  "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "TentativaEnvioAditivo_processoId_numero_key" UNIQUE ("processoId", numero)
);
CREATE TABLE "ObservacaoEnvioAditivo" (
  id TEXT PRIMARY KEY,
  "tentativaId" TEXT NOT NULL REFERENCES "TentativaEnvioAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  chave TEXT NOT NULL CHECK (length(btrim(chave)) BETWEEN 8 AND 200 AND chave = btrim(chave)),
  resultado TEXT NOT NULL CHECK (resultado IN ('INCERTO', 'REGISTRADO', 'NAO_CRIADO')),
  "referenciaExterna" TEXT,
  "evidenciaHash" TEXT NOT NULL CHECK ("evidenciaHash" ~ '^[a-f0-9]{64}$'),
  "observadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "ObservacaoEnvioAditivo_tentativaId_chave_key" UNIQUE ("tentativaId", chave),
  CONSTRAINT "ObservacaoEnvioAditivo_resultado_referencia_check" CHECK ((resultado = 'REGISTRADO') = ("referenciaExterna" IS NOT NULL))
);

CREATE FUNCTION validar_processo_assinatura_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaAditivoContratual"%ROWTYPE; artefato "ArtefatoAditivoContratual"%ROWTYPE;
        participantes "ConferenciaParticipantesAditivo"%ROWTYPE; conferencia "ConferenciaAssinaturaAditivo"%ROWTYPE;
        ator "Usuario"%ROWTYPE; observacao "ObservacaoEnvioAditivo"%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
    SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = NEW."propostaId" FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de aditivo inexistente'; END IF;
    PERFORM id FROM "Matricula" WHERE id = proposta."matriculaId" FOR UPDATE;
    SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = NEW."artefatoId" FOR SHARE;
    SELECT * INTO conferencia FROM "ConferenciaAssinaturaAditivo" WHERE id = NEW."conferenciaId" FOR SHARE;
    IF NOT FOUND OR artefato."propostaId" IS DISTINCT FROM proposta.id OR conferencia."artefatoId" IS DISTINCT FROM artefato.id THEN
      RAISE EXCEPTION 'Original ou conferência não corresponde à proposta de aditivo';
    END IF;
    SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
    IF NOT FOUND OR participantes."propostaId" IS DISTINCT FROM proposta.id
      OR conferencia.snapshot->>'propostaHash' IS DISTINCT FROM proposta."entradaHash"
      OR conferencia.snapshot->>'conferenciaId' IS DISTINCT FROM participantes.id
      OR conferencia.snapshot->>'conferenciaHash' IS DISTINCT FROM participantes."revisaoHash"
      OR conferencia.snapshot->>'artefatoId' IS DISTINCT FROM artefato.id
      OR conferencia.snapshot->>'pdfHash' IS DISTINCT FROM artefato."pdfHash"
      OR conferencia.snapshot->>'baseHash' IS DISTINCT FROM artefato."baseHash"
      OR conferencia.snapshot->>'versaoProposta' IS DISTINCT FROM proposta.versao::TEXT
      OR conferencia.snapshot->>'conferenciaVersao' IS DISTINCT FROM participantes.versao::TEXT
      OR conferencia.snapshot->>'ambiente' IS DISTINCT FROM proposta.snapshot->'base'->>'ambiente'
      OR conferencia."revisaoHash" !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'Conferência do original não corresponde à revisão atual';
    END IF;
    IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao)
      OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId" = proposta.id AND n.versao > participantes.versao) THEN
      RAISE EXCEPTION 'A proposta ou conferência de participantes foi superada';
    END IF;
    PERFORM conferir_fonte_aditivo_117(proposta);
    PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, participantes);
    PERFORM exigir_alcadas_aditivo_117(proposta);
    IF NEW.ambiente IS DISTINCT FROM conferencia.snapshot->>'ambiente' THEN RAISE EXCEPTION 'Ambiente não corresponde ao original conferido'; END IF;
    IF NEW.estado <> 'PREPARADO' OR NEW."tentativaAtual" <> 0 OR NEW."referenciaExterna" IS NOT NULL THEN RAISE EXCEPTION 'Processo de aditivo deve iniciar preparado e sem referência externa'; END IF;
    SELECT * INTO ator FROM "Usuario" WHERE id = NEW."preparadorId" FOR SHARE;
    IF NOT FOUND OR NOT ator.ativo OR NOT (ator.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Secretaria ou Administração ativa'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Processo de assinatura de aditivo é imutável'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW."propostaId" IS DISTINCT FROM OLD."propostaId" OR NEW."artefatoId" IS DISTINCT FROM OLD."artefatoId"
    OR NEW."conferenciaId" IS DISTINCT FROM OLD."conferenciaId" OR NEW."preparadorId" IS DISTINCT FROM OLD."preparadorId"
    OR NEW.fornecedor IS DISTINCT FROM OLD.fornecedor OR NEW.ambiente IS DISTINCT FROM OLD.ambiente OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" THEN
    RAISE EXCEPTION 'Identidade do processo de assinatura de aditivo é imutável';
  END IF;
  PERFORM id FROM "Matricula" WHERE id = (SELECT "matriculaId" FROM "PropostaAditivoContratual" WHERE id = OLD."propostaId") FOR UPDATE;
  PERFORM id FROM "ProcessoAssinaturaAditivo" WHERE id = OLD.id FOR UPDATE;
  IF NEW.estado = 'CANCELADO' THEN RAISE EXCEPTION 'Cancelamento de processo de aditivo ainda exige fato próprio'; END IF;
  IF OLD.estado = 'PREPARADO' AND NEW.estado = 'ENVIANDO' AND NEW."referenciaExterna" IS NULL
    AND NEW."tentativaAtual" = OLD."tentativaAtual" + 1
    AND EXISTS (SELECT 1 FROM "TentativaEnvioAditivo" t WHERE t."processoId" = OLD.id AND t.numero = NEW."tentativaAtual") THEN
    RETURN NEW;
  END IF;
  SELECT o.* INTO observacao FROM "ObservacaoEnvioAditivo" o JOIN "TentativaEnvioAditivo" t ON t.id = o."tentativaId"
    WHERE t."processoId" = OLD.id AND t.numero = OLD."tentativaAtual" ORDER BY o."observadaEm" DESC, o.id DESC LIMIT 1;
  IF OLD.estado = 'ENVIANDO' AND NEW."tentativaAtual" = OLD."tentativaAtual"
    AND ((observacao.resultado = 'REGISTRADO' AND NEW.estado = 'ENVIADO' AND NEW."referenciaExterna" = observacao."referenciaExterna")
      OR (observacao.resultado = 'INCERTO' AND NEW.estado = 'ENVIO_INCERTO' AND NEW."referenciaExterna" IS NULL)
      OR (observacao.resultado = 'NAO_CRIADO' AND NEW.estado = 'PREPARADO' AND NEW."referenciaExterna" IS NULL)) THEN
    RETURN NEW;
  END IF;
  IF OLD.estado = 'ENVIO_INCERTO' AND NEW."tentativaAtual" = OLD."tentativaAtual"
    AND ((observacao.resultado = 'REGISTRADO' AND NEW.estado = 'ENVIADO' AND NEW."referenciaExterna" = observacao."referenciaExterna")
      OR (observacao.resultado = 'NAO_CRIADO' AND NEW.estado = 'PREPARADO' AND NEW."referenciaExterna" IS NULL)
      OR (observacao.resultado = 'INCERTO' AND NEW.estado = 'ENVIO_INCERTO' AND NEW."referenciaExterna" IS NULL)) THEN
    RETURN NEW;
  END IF;
  IF OLD.estado = 'ENVIADO' AND NEW.estado = 'ENVIADO' AND NEW."tentativaAtual" = OLD."tentativaAtual"
    AND observacao.resultado = 'REGISTRADO' AND NEW."referenciaExterna" = OLD."referenciaExterna"
    AND NEW."referenciaExterna" = observacao."referenciaExterna" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Transição do processo exige fato de tentativa ou observação correspondente';
END;
$$;
CREATE TRIGGER validar_processo_assinatura_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "ProcessoAssinaturaAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_processo_assinatura_aditivo_117();

CREATE FUNCTION validar_tentativa_envio_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE processo "ProcessoAssinaturaAditivo"%ROWTYPE; conferencia "ConferenciaAssinaturaAditivo"%ROWTYPE;
        proposta "PropostaAditivoContratual"%ROWTYPE; artefato "ArtefatoAditivoContratual"%ROWTYPE;
        participantes "ConferenciaParticipantesAditivo"%ROWTYPE; matricula_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Tentativa de envio de aditivo é imutável'; END IF;
  SELECT p."matriculaId" INTO matricula_id FROM "ProcessoAssinaturaAditivo" processo JOIN "PropostaAditivoContratual" p ON p.id = processo."propostaId" WHERE processo.id = NEW."processoId";
  PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
  SELECT * INTO processo FROM "ProcessoAssinaturaAditivo" WHERE id = NEW."processoId" FOR UPDATE;
  IF NOT FOUND OR processo.estado <> 'PREPARADO' OR processo."referenciaExterna" IS NOT NULL OR NEW.numero <> processo."tentativaAtual" + 1 THEN
    RAISE EXCEPTION 'Tentativa exige processo preparado e número atual seguinte';
  END IF;
  SELECT * INTO conferencia FROM "ConferenciaAssinaturaAditivo" WHERE id = processo."conferenciaId" FOR SHARE;
  SELECT * INTO proposta FROM "PropostaAditivoContratual" WHERE id = processo."propostaId" FOR SHARE;
  SELECT * INTO artefato FROM "ArtefatoAditivoContratual" WHERE id = processo."artefatoId" FOR SHARE;
  SELECT * INTO participantes FROM "ConferenciaParticipantesAditivo" WHERE id = artefato."conferenciaId" FOR SHARE;
  IF NOT FOUND OR proposta.id IS NULL OR artefato."propostaId" IS DISTINCT FROM proposta.id OR conferencia."artefatoId" IS DISTINCT FROM artefato.id
    OR participantes."propostaId" IS DISTINCT FROM proposta.id OR NEW."revisaoHash" IS DISTINCT FROM conferencia."revisaoHash"
    OR conferencia.snapshot->>'propostaHash' IS DISTINCT FROM proposta."entradaHash"
    OR conferencia.snapshot->>'conferenciaId' IS DISTINCT FROM participantes.id
    OR conferencia.snapshot->>'conferenciaHash' IS DISTINCT FROM participantes."revisaoHash"
    OR conferencia.snapshot->>'artefatoId' IS DISTINCT FROM artefato.id
    OR conferencia.snapshot->>'pdfHash' IS DISTINCT FROM artefato."pdfHash"
    OR conferencia.snapshot->>'baseHash' IS DISTINCT FROM artefato."baseHash"
    OR conferencia.snapshot->>'versaoProposta' IS DISTINCT FROM proposta.versao::TEXT
    OR conferencia.snapshot->>'conferenciaVersao' IS DISTINCT FROM participantes.versao::TEXT
    OR conferencia.snapshot->>'ambiente' IS DISTINCT FROM proposta.snapshot->'base'->>'ambiente' THEN
    RAISE EXCEPTION 'Tentativa não corresponde à conferência atual';
  END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" n WHERE n."matriculaId" = proposta."matriculaId" AND n.versao > proposta.versao)
    OR EXISTS (SELECT 1 FROM "ConferenciaParticipantesAditivo" n WHERE n."propostaId" = proposta.id AND n.versao > participantes.versao) THEN
    RAISE EXCEPTION 'A proposta ou conferência de participantes foi superada';
  END IF;
  PERFORM conferir_fonte_aditivo_117(proposta);
  PERFORM conferir_evidencias_conferencia_aditivo_117(proposta, participantes);
  PERFORM exigir_alcadas_aditivo_117(proposta);
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_tentativa_envio_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "TentativaEnvioAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_tentativa_envio_aditivo_117();

CREATE FUNCTION validar_observacao_envio_aditivo_117() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE tentativa "TentativaEnvioAditivo"%ROWTYPE; processo "ProcessoAssinaturaAditivo"%ROWTYPE; matricula_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Observação de envio de aditivo é imutável'; END IF;
  SELECT * INTO tentativa FROM "TentativaEnvioAditivo" WHERE id = NEW."tentativaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa de envio inexistente'; END IF;
  SELECT p."matriculaId" INTO matricula_id FROM "ProcessoAssinaturaAditivo" processo JOIN "PropostaAditivoContratual" p ON p.id = processo."propostaId" WHERE processo.id = tentativa."processoId";
  PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
  SELECT * INTO processo FROM "ProcessoAssinaturaAditivo" WHERE id = tentativa."processoId" FOR UPDATE;
  IF processo.estado NOT IN ('ENVIANDO', 'ENVIO_INCERTO', 'ENVIADO') OR processo."tentativaAtual" <> tentativa.numero THEN RAISE EXCEPTION 'Observação não corresponde à tentativa atual em envio'; END IF;
  IF processo.estado = 'ENVIADO' AND (NEW.resultado <> 'REGISTRADO' OR NEW."referenciaExterna" IS DISTINCT FROM processo."referenciaExterna") THEN RAISE EXCEPTION 'Processo enviado só aceita confirmação da mesma referência'; END IF;
  IF (NEW.resultado = 'REGISTRADO') IS DISTINCT FROM (NEW."referenciaExterna" IS NOT NULL) THEN RAISE EXCEPTION 'Resultado não corresponde à referência externa'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_observacao_envio_aditivo_117 BEFORE INSERT OR UPDATE OR DELETE ON "ObservacaoEnvioAditivo"
FOR EACH ROW EXECUTE FUNCTION validar_observacao_envio_aditivo_117();
