-- CreateTable
CREATE TABLE "ConferenciaOcorrenciaHoras" (
    "id" TEXT NOT NULL,
    "encontroId" TEXT NOT NULL,
    "ocorrenciaId" TEXT NOT NULL,
    "condicoesId" TEXT NOT NULL,
    "conferenteId" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "desfecho" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "estadoPrevia" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "conferidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenciaOcorrenciaHoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaOcorrenciaHoras_encontroId_key" ON "ConferenciaOcorrenciaHoras"("encontroId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaOcorrenciaHoras_ocorrenciaId_key" ON "ConferenciaOcorrenciaHoras"("ocorrenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaOcorrenciaHoras_conferenteId_chaveIdempotencia_key" ON "ConferenciaOcorrenciaHoras"("conferenteId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "ConferenciaOcorrenciaHoras" ADD CONSTRAINT "ConferenciaOcorrenciaHoras_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConferenciaOcorrenciaHoras" ADD CONSTRAINT "ConferenciaOcorrenciaHoras_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "OcorrenciaParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConferenciaOcorrenciaHoras" ADD CONSTRAINT "ConferenciaOcorrenciaHoras_condicoesId_fkey" FOREIGN KEY ("condicoesId") REFERENCES "CondicoesHorasMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConferenciaOcorrenciaHoras" ADD CONSTRAINT "ConferenciaOcorrenciaHoras_conferenteId_fkey" FOREIGN KEY ("conferenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE FUNCTION validar_conferencia_ocorrencia_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "OcorrenciaParticular"%ROWTYPE; c "CondicoesHorasMatricula"%ROWTYPE;
 e "EncontroAgenda"%ROWTYPE; m "Matricula"%ROWTYPE; u "Usuario"%ROWTYPE; resultado text; minutos numeric; valor numeric;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferências financeiras são preservadas.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR UPDATE;
 SELECT * INTO o FROM "OcorrenciaParticular" WHERE id=NEW."ocorrenciaId";
 SELECT * INTO c FROM "CondicoesHorasMatricula" WHERE id=NEW."condicoesId";
 SELECT * INTO m FROM "Matricula" WHERE id=o."matriculaId" FOR UPDATE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."conferenteId" FOR SHARE;
 IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Conferente financeiro sem permissão.'; END IF;
 IF o."encontroId" IS DISTINCT FROM e.id OR e."matriculaId" IS DISTINCT FROM o."matriculaId" OR c."matriculaId" IS DISTINCT FROM o."matriculaId" OR c.status IS DISTINCT FROM 'APROVADA'
  OR e.inicio IS DISTINCT FROM o.inicio OR e.fim IS DISTINCT FROM o.fim OR e."turmaId" IS NOT NULL
  OR EXISTS (SELECT 1 FROM "OcorrenciaParticular" WHERE "encontroId"=e.id AND versao>o.versao)
  OR EXISTS (SELECT 1 FROM "ReservaHorasCompradas" WHERE "encontroId"=e.id) THEN RAISE EXCEPTION 'Origens da conferência divergentes ou horas antecipadas pendentes.'; END IF;
 IF m."contratoOk" IS DISTINCT FROM true OR m."confirmacaoContratoEm" IS NULL OR m."contratoDocumentoId" IS DISTINCT FROM c."documentoId" OR NEW.moeda IS DISTINCT FROM m.moeda OR c.regras->>'moeda' IS DISTINCT FROM NEW.moeda THEN RAISE EXCEPTION 'Contrato e moeda incompatíveis.'; END IF;
 PERFORM id FROM "Documento" WHERE id=c."documentoId" FOR SHARE;
 IF NOT EXISTS (SELECT 1 FROM "Documento" WHERE id=c."documentoId" AND categoria='CONTRATO' AND NOT arquivado AND ("matriculaId"=m.id OR "leadId"=m."leadId")) THEN RAISE EXCEPTION 'Documento indisponível.'; END IF;
 IF (c.regras->>'vigenteDesde')::timestamptz > o.inicio AT TIME ZONE 'UTC' OR EXISTS (
  SELECT 1 FROM "CondicoesHorasMatricula" x WHERE x."matriculaId"=m.id AND x.id<>c.id AND x.status IN ('PENDENTE','APROVADA')
   AND (x.regras->>'vigenteDesde')::timestamptz < o.fim AT TIME ZONE 'UTC'
   AND (x.status='PENDENTE' OR (x.regras->>'vigenteDesde')::timestamptz > (c.regras->>'vigenteDesde')::timestamptz
    OR ((x.regras->>'vigenteDesde')::timestamptz=(c.regras->>'vigenteDesde')::timestamptz AND x.versao>c.versao))
 ) THEN RAISE EXCEPTION 'Confira a vigência contratual.'; END IF;
 IF o.tipo IN ('CANCELAMENTO_ALUNO','CANCELAMENTO_ESCOLA') THEN
  IF e.status <> 'CANCELADO' OR NOT EXISTS (SELECT 1 FROM "DecisaoCancelamentoParticular" d JOIN "PropostaCancelamentoParticular" p ON p.id=d."propostaId" WHERE p."encontroId"=e.id AND d.aprovada AND p.origem=CASE WHEN o.tipo='CANCELAMENTO_ALUNO' THEN 'ALUNO' ELSE 'ESCOLA' END) THEN RAISE EXCEPTION 'Cancelamento incompatível.'; END IF;
 ELSE
  IF e.status NOT IN ('PREVISTO','MINISTRADO') THEN RAISE EXCEPTION 'Estado incompatível com a ocorrência.'; END IF;
 END IF;
 resultado := CASE o.tipo WHEN 'REALIZADA' THEN 'REALIZADA' WHEN 'FALTA_ALUNO' THEN 'FALTA_COBRAVEL'
  WHEN 'CANCELAMENTO_ESCOLA' THEN 'CANCELAMENTO_ESCOLA' ELSE
   CASE WHEN o."comunicadoEm" <= o.inicio - make_interval(mins => (c.regras->>'antecedenciaCancelamentoMinutos')::integer) THEN 'CANCELAMENTO_NO_PRAZO' ELSE 'CANCELAMENTO_TARDIO' END END;
 minutos := extract(epoch FROM (o.fim-o.inicio))/60;
 valor := CASE WHEN resultado IN ('REALIZADA','FALTA_COBRAVEL','CANCELAMENTO_TARDIO') THEN round((c.regras->>'valorHora')::numeric * minutos/60,2) ELSE 0 END;
 IF minutos<=0 OR minutos<>trunc(minutos) OR NEW.minutos<>minutos OR NEW.valor<>valor OR NEW.desfecho<>resultado OR length(trim(NEW.motivo))<5 THEN RAISE EXCEPTION 'Cálculo financeiro divergente.'; END IF;
 IF NEW.snapshot->'regras' IS DISTINCT FROM c.regras OR NEW.snapshot->>'ocorrenciaId' IS DISTINCT FROM o.id OR NEW.snapshot->>'condicoesId' IS DISTINCT FROM c.id OR NEW.snapshot->>'matriculaId' IS DISTINCT FROM m.id
  OR (NEW.snapshot->>'valorApurado')::numeric IS DISTINCT FROM valor THEN RAISE EXCEPTION 'Memória financeira divergente.'; END IF;
 NEW."conferidaEm" := clock_timestamp() AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER validar_conferencia_ocorrencia_horas BEFORE INSERT OR UPDATE OR DELETE ON "ConferenciaOcorrenciaHoras" FOR EACH ROW EXECUTE FUNCTION validar_conferencia_ocorrencia_horas();

CREATE FUNCTION proteger_ocorrencia_conferida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 IF EXISTS (SELECT 1 FROM "ConferenciaOcorrenciaHoras" WHERE "encontroId"=NEW."encontroId") THEN RAISE EXCEPTION 'Encontro conferido exige revisão dos efeitos financeiros.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proteger_ocorrencia_conferida BEFORE INSERT ON "OcorrenciaParticular" FOR EACH ROW EXECUTE FUNCTION proteger_ocorrencia_conferida();
CREATE TRIGGER proteger_reserva_ocorrencia_conferida BEFORE INSERT ON "ReservaHorasCompradas" FOR EACH ROW EXECUTE FUNCTION proteger_ocorrencia_conferida();

CREATE FUNCTION proteger_agenda_ocorrencia_conferida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.inicio IS DISTINCT FROM OLD.inicio OR NEW.fim IS DISTINCT FROM OLD.fim OR NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId"
  OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='PREVISTO' AND NEW.status='MINISTRADO')))
  AND EXISTS (SELECT 1 FROM "ConferenciaOcorrenciaHoras" WHERE "encontroId"=OLD.id) THEN RAISE EXCEPTION 'Agenda conferida exige revisão dos efeitos financeiros.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proteger_agenda_ocorrencia_conferida BEFORE UPDATE ON "EncontroAgenda" FOR EACH ROW EXECUTE FUNCTION proteger_agenda_ocorrencia_conferida();
