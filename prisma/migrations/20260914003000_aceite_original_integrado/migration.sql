-- CreateTable
CREATE TABLE "AceiteOriginalContratual" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "conclusaoId" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "revisaoHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AceiteOriginalContratual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AceiteOriginalContratual_matriculaId_key" ON "AceiteOriginalContratual"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "AceiteOriginalContratual_conclusaoId_key" ON "AceiteOriginalContratual"("conclusaoId");

-- CreateIndex
CREATE UNIQUE INDEX "AceiteOriginalContratual_documentoId_key" ON "AceiteOriginalContratual"("documentoId");

-- CreateIndex
CREATE UNIQUE INDEX "AceiteOriginalContratual_autorId_chaveIdempotencia_key" ON "AceiteOriginalContratual"("autorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "AceiteOriginalContratual" ADD CONSTRAINT "AceiteOriginalContratual_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AceiteOriginalContratual" ADD CONSTRAINT "AceiteOriginalContratual_conclusaoId_fkey" FOREIGN KEY ("conclusaoId") REFERENCES "ConclusaoAssinaturaContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AceiteOriginalContratual" ADD CONSTRAINT "AceiteOriginalContratual_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AceiteOriginalContratual" ADD CONSTRAINT "AceiteOriginalContratual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_aceite_original() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m "Matricula"%ROWTYPE; p "ProcessoAssinaturaContratual"%ROWTYPE; c "ConclusaoAssinaturaContratual"%ROWTYPE; d "Documento"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aceite do original é imutável'; END IF;
 SELECT * INTO m FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
 SELECT * INTO c FROM "ConclusaoAssinaturaContratual" WHERE id = NEW."conclusaoId";
 SELECT * INTO p FROM "ProcessoAssinaturaContratual" WHERE id = c."processoId" FOR UPDATE;
 IF m.id IS NULL OR m."secretariaAssumiuEm" IS NULL OR m.status NOT IN ('RASCUNHO','AGUARDANDO') OR m."contratoOk" THEN RAISE EXCEPTION 'Matrícula não está disponível para aceite inicial'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Secretaria ou Administração ativa exigida'; END IF;
 IF c.id IS NULL OR p."matriculaId" IS DISTINCT FROM m.id OR p.ambiente IS DISTINCT FROM 'PRODUCAO' OR p.estado <> 'ENVIADO' THEN RAISE EXCEPTION 'Aceite exige conclusão de produção da matrícula'; END IF;
 IF NEW.snapshot->>'conclusaoHash' IS DISTINCT FROM c."entradaHash" OR NEW.snapshot->>'originalHash' IS DISTINCT FROM c."originalHash" OR NEW.snapshot->>'artefatoId' IS DISTINCT FROM p."artefatoId" THEN RAISE EXCEPTION 'Memória do aceite incompatível'; END IF;
 SELECT * INTO d FROM "Documento" WHERE id = NEW."documentoId" FOR UPDATE;
 IF d.id IS NULL OR d."matriculaId" IS DISTINCT FROM m.id OR d."leadId" IS NOT NULL OR d.categoria <> 'CONTRATO' OR d.arquivado OR d.url IS DISTINCT FROM ('/api/matriculas/' || m.id || '/assinaturas/' || c.id || '/pdf') THEN RAISE EXCEPTION 'Documento não corresponde à conclusão do original'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_aceite_original BEFORE INSERT OR UPDATE OR DELETE ON "AceiteOriginalContratual" FOR EACH ROW EXECUTE FUNCTION preservar_aceite_original();

CREATE FUNCTION proteger_documento_original_aceito() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "AceiteOriginalContratual" WHERE "documentoId" = OLD.id) AND (NEW.id, NEW."matriculaId", NEW."leadId", NEW.categoria, NEW.url, NEW.arquivado) IS DISTINCT FROM (OLD.id, OLD."matriculaId", OLD."leadId", OLD.categoria, OLD.url, OLD.arquivado) THEN RAISE EXCEPTION 'Documento do original aceito é preservado'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_documento_original_aceito BEFORE UPDATE ON "Documento" FOR EACH ROW EXECUTE FUNCTION proteger_documento_original_aceito();