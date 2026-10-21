-- CreateTable
CREATE TABLE "DecisaoFechamentoHoras" (
    "id" TEXT NOT NULL,
    "rascunhoId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "confirmaReferenciaContratual" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoFechamentoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoFechamentoHoras_rascunhoId_key" ON "DecisaoFechamentoHoras"("rascunhoId");

-- AddForeignKey
ALTER TABLE "DecisaoFechamentoHoras" ADD CONSTRAINT "DecisaoFechamentoHoras_rascunhoId_fkey" FOREIGN KEY ("rascunhoId") REFERENCES "RascunhoFechamentoHoras"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoFechamentoHoras" ADD CONSTRAINT "DecisaoFechamentoHoras_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION validar_decisao_fechamento_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RascunhoFechamentoHoras"%ROWTYPE; u "Usuario"%ROWTYPE; m "Matricula"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de fechamento é preservada.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO r FROM "RascunhoFechamentoHoras" WHERE id=NEW."rascunhoId";
 SELECT * INTO m FROM "Matricula" WHERE id=r."matriculaId" FOR UPDATE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
 IF u.ativo IS DISTINCT FROM true OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Aprovação financeira não autorizada.'; END IF;
 IF r."preparadorId"=NEW."decisorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir o fechamento.'; END IF;
 IF length(trim(NEW.motivo))<5 THEN RAISE EXCEPTION 'Justificativa obrigatória.'; END IF;
 IF NEW.aprovada THEN
  IF NOT NEW."confirmaReferenciaContratual" THEN RAISE EXCEPTION 'Confira a referência contratual.'; END IF;
  IF EXISTS (SELECT 1 FROM "RascunhoFechamentoHoras" WHERE "matriculaId"=r."matriculaId" AND "periodoInicio"=r."periodoInicio" AND "periodoFimExclusivo"=r."periodoFimExclusivo" AND versao>r.versao) THEN RAISE EXCEPTION 'Confira a versão mais recente.'; END IF;
  IF m."contratoOk" IS DISTINCT FROM true OR m."confirmacaoContratoEm" IS NULL OR m."contratoDocumentoId" IS DISTINCT FROM r."documentoId" THEN RAISE EXCEPTION 'Contrato confirmado incompatível.'; END IF;
  PERFORM id FROM "Documento" WHERE id=r."documentoId" FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM "Documento" WHERE id=r."documentoId" AND NOT arquivado AND categoria='CONTRATO' AND ("matriculaId"=m.id OR "leadId"=m."leadId")) THEN RAISE EXCEPTION 'Documento indisponível.'; END IF;
 END IF;
 NEW."decididaEm" := clock_timestamp() AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER validar_decisao_fechamento_horas BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoFechamentoHoras" FOR EACH ROW EXECUTE FUNCTION validar_decisao_fechamento_horas();
