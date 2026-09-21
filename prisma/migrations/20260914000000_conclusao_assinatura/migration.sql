-- CreateTable
CREATE TABLE "ConclusaoAssinaturaContratual" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "referenciaExterna" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "pdfAssinado" BYTEA NOT NULL,
    "pdfHash" TEXT NOT NULL,
    "evidencias" BYTEA NOT NULL,
    "evidenciasHash" TEXT NOT NULL,
    "assinaturas" JSONB NOT NULL,
    "concluidaEm" TIMESTAMP(3) NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConclusaoAssinaturaContratual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConclusaoAssinaturaContratual_processoId_key" ON "ConclusaoAssinaturaContratual"("processoId");

-- AddForeignKey
ALTER TABLE "ConclusaoAssinaturaContratual" ADD CONSTRAINT "ConclusaoAssinaturaContratual_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoAssinaturaContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_conclusao_assinatura() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "ProcessoAssinaturaContratual"%ROWTYPE; a "ArtefatoContratual"%ROWTYPE; pessoas JSONB; enviada TIMESTAMP;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conclusão de assinatura é imutável'; END IF;
 SELECT * INTO p FROM "ProcessoAssinaturaContratual" WHERE id = NEW."processoId" FOR UPDATE;
 SELECT * INTO a FROM "ArtefatoContratual" WHERE id = p."artefatoId";
 IF p.id IS NULL OR p.estado <> 'ENVIADO' OR p."referenciaExterna" IS DISTINCT FROM NEW."referenciaExterna" OR a."pdfHash" <> NEW."originalHash" THEN RAISE EXCEPTION 'Conclusão incompatível com processo e original'; END IF;
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
CREATE TRIGGER preservar_conclusao_assinatura BEFORE INSERT OR UPDATE OR DELETE ON "ConclusaoAssinaturaContratual" FOR EACH ROW EXECUTE FUNCTION preservar_conclusao_assinatura();
