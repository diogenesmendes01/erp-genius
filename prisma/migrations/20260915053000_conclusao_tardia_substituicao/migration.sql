-- 219: preserva conclusão tardia da fonte Q116 sem reabri-la.
CREATE FUNCTION impedir_processo_inicial_cancelado_219() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.estado='CANCELADO' THEN RAISE EXCEPTION 'Processo deve ser cancelado pela aplicação comprovada'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER impedir_processo_inicial_cancelado_219 BEFORE INSERT ON "ProcessoAssinaturaContratual" FOR EACH ROW EXECUTE FUNCTION impedir_processo_inicial_cancelado_219();
CREATE OR REPLACE FUNCTION preservar_conclusao_assinatura() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "ProcessoAssinaturaContratual"%ROWTYPE; a "ArtefatoContratual"%ROWTYPE; pessoas JSONB; enviada TIMESTAMP;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conclusão de assinatura é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM id FROM "Matricula" WHERE id=(SELECT "matriculaId" FROM "ProcessoAssinaturaContratual" WHERE id=NEW."processoId") FOR UPDATE;
 SELECT * INTO p FROM "ProcessoAssinaturaContratual" WHERE id = NEW."processoId" FOR UPDATE;
 SELECT * INTO a FROM "ArtefatoContratual" WHERE id = p."artefatoId";
 IF p.id IS NULL OR (p.estado <> 'ENVIADO' AND NOT (p.estado = 'CANCELADO' AND EXISTS (SELECT 1 FROM "AplicacaoSubstituicaoContratual" aplicada JOIN "IntencaoCancelamentoAssinatura" intencao ON intencao.id=aplicada."intencaoId" WHERE intencao."processoId"=p.id))) OR p."referenciaExterna" IS DISTINCT FROM NEW."referenciaExterna" OR a."pdfHash" <> NEW."originalHash" THEN RAISE EXCEPTION 'Conclusão incompatível com processo e original'; END IF;
 SELECT "iniciadaEm" INTO enviada FROM "TentativaEnvioAssinatura" WHERE "processoId" = p.id AND numero = p."tentativaAtual";
 IF enviada IS NULL OR NEW."concluidaEm" < enviada OR NEW."concluidaEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Data de conclusão incompatível'; END IF;
 IF octet_length(NEW."pdfAssinado") <= 5 OR octet_length(NEW."pdfAssinado") > 20971520 OR substring(NEW."pdfAssinado" from 1 for 5) <> convert_to('%PDF-', 'UTF8') OR octet_length(NEW.evidencias) = 0 OR octet_length(NEW.evidencias) > 20971520 THEN RAISE EXCEPTION 'Arquivos de conclusão inválidos'; END IF;
 IF encode(sha256(NEW."pdfAssinado"),'hex') <> NEW."pdfHash" OR encode(sha256(NEW.evidencias),'hex') <> NEW."evidenciasHash" THEN RAISE EXCEPTION 'Hashes divergentes dos arquivos'; END IF;
 SELECT snapshot->'participantes' INTO pessoas FROM "ConferenciaParticipantesContratuais" WHERE id = a."conferenciaId";
 IF jsonb_typeof(NEW.assinaturas) <> 'array' OR jsonb_array_length(NEW.assinaturas) <> jsonb_array_length(pessoas) THEN RAISE EXCEPTION 'Assinaturas obrigatórias ausentes'; END IF;
 IF (SELECT count(DISTINCT x->>'papel') FROM jsonb_array_elements(NEW.assinaturas) x) <> jsonb_array_length(pessoas) OR EXISTS (SELECT 1 FROM jsonb_array_elements(pessoas) pessoa WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.assinaturas) x WHERE x->>'papel' = pessoa->>'papel' AND x->>'etapa' = pessoa->>'etapa')) THEN RAISE EXCEPTION 'Papéis de assinatura incompatíveis'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.assinaturas) x WHERE x->>'assinadaEm' IS NULL OR (x->>'assinadaEm')::timestamptz < (enviada AT TIME ZONE 'UTC') OR (x->>'assinadaEm')::timestamptz > (NEW."concluidaEm" AT TIME ZONE 'UTC')) THEN RAISE EXCEPTION 'Data de assinatura incompatível'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.assinaturas) e CROSS JOIN jsonb_array_elements(NEW.assinaturas) c WHERE e->>'etapa' = 'ESCOLA' AND c->>'etapa' = 'CLIENTE' AND (e->>'assinadaEm')::timestamptz < (c->>'assinadaEm')::timestamptz) THEN RAISE EXCEPTION 'Escola deve assinar após clientes'; END IF;
 RETURN NEW;
END;
$$;

