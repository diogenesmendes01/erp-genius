-- CreateTable
CREATE TABLE "RascunhoFechamentoHoras" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFimExclusivo" TIMESTAMP(3) NOT NULL,
    "versao" INTEGER NOT NULL,
    "entrada" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RascunhoFechamentoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RascunhoFechamentoHoras_preparadorId_chaveIdempotencia_key" ON "RascunhoFechamentoHoras"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "rascunho_fechamento_horas_periodo_versao" ON "RascunhoFechamentoHoras"("matriculaId", "periodoInicio", "periodoFimExclusivo", "versao");

-- AddForeignKey
ALTER TABLE "RascunhoFechamentoHoras" ADD CONSTRAINT "RascunhoFechamentoHoras_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RascunhoFechamentoHoras" ADD CONSTRAINT "RascunhoFechamentoHoras_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RascunhoFechamentoHoras" ADD CONSTRAINT "RascunhoFechamentoHoras_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE FUNCTION validar_rascunho_fechamento_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m "Matricula"%ROWTYPE; u "Usuario"%ROWTYPE; anterior integer;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Versões do fechamento são preservadas.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO m FROM "Matricula" WHERE id=NEW."matriculaId" FOR UPDATE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
 IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparador financeiro sem permissão.'; END IF;
 IF m."contratoOk" IS DISTINCT FROM true OR m."confirmacaoContratoEm" IS NULL OR m."contratoDocumentoId" IS DISTINCT FROM NEW."documentoId" THEN RAISE EXCEPTION 'Contrato confirmado incompatível.'; END IF;
 PERFORM id FROM "Documento" WHERE id=NEW."documentoId" FOR SHARE;
 IF NOT EXISTS (SELECT 1 FROM "Documento" WHERE id=NEW."documentoId" AND categoria='CONTRATO' AND NOT arquivado AND ("matriculaId"=m.id OR "leadId"=m."leadId")) THEN RAISE EXCEPTION 'Documento indisponível.'; END IF;
 SELECT COALESCE(MAX(versao),0) INTO anterior FROM "RascunhoFechamentoHoras" WHERE "matriculaId"=m.id AND "periodoInicio"=NEW."periodoInicio" AND "periodoFimExclusivo"=NEW."periodoFimExclusivo";
 IF NEW.versao<>anterior+1 OR NEW."periodoFimExclusivo"<=NEW."periodoInicio" OR NEW."periodoFimExclusivo"-NEW."periodoInicio">interval '32 days' THEN RAISE EXCEPTION 'Versão ou período mensal incompatível.'; END IF;
 IF NEW.entrada->>'matriculaId' IS DISTINCT FROM m.id OR NEW.entrada->>'alunoId' IS DISTINCT FROM m."alunoId" OR NEW.entrada->>'documentoId' IS DISTINCT FROM NEW."documentoId"
  OR NEW.snapshot#>>'{apuracao,matriculaId}' IS DISTINCT FROM m.id OR NEW.snapshot#>>'{apuracao,moeda}' IS DISTINCT FROM m.moeda
  OR ((NEW.snapshot#>>'{periodo,inicioInstante}')::timestamptz AT TIME ZONE 'UTC') IS DISTINCT FROM NEW."periodoInicio"
  OR ((NEW.snapshot#>>'{periodo,fimExclusivo}')::timestamptz AT TIME ZONE 'UTC') IS DISTINCT FROM NEW."periodoFimExclusivo"
  OR COALESCE(length(trim(NEW.entrada#>>'{periodo,clausula}')),0)<5 OR length(trim(NEW.motivo))<5 THEN RAISE EXCEPTION 'Memória do período incompatível.'; END IF;
 NEW."criadoEm" := clock_timestamp() AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER validar_rascunho_fechamento_horas BEFORE INSERT OR UPDATE OR DELETE ON "RascunhoFechamentoHoras" FOR EACH ROW EXECUTE FUNCTION validar_rascunho_fechamento_horas();
