-- CreateTable
CREATE TABLE "EmissaoFechamentoHoras" (
    "id" TEXT NOT NULL,
    "decisaoId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "memoria" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmissaoFechamentoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemFechamentoHoras" (
    "id" TEXT NOT NULL,
    "emissaoId" TEXT NOT NULL,
    "conferenciaId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ItemFechamentoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmissaoFechamentoHoras_decisaoId_key" ON "EmissaoFechamentoHoras"("decisaoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmissaoFechamentoHoras_cobrancaId_key" ON "EmissaoFechamentoHoras"("cobrancaId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemFechamentoHoras_conferenciaId_key" ON "ItemFechamentoHoras"("conferenciaId");

-- AddForeignKey
ALTER TABLE "EmissaoFechamentoHoras" ADD CONSTRAINT "EmissaoFechamentoHoras_decisaoId_fkey" FOREIGN KEY ("decisaoId") REFERENCES "DecisaoFechamentoHoras"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmissaoFechamentoHoras" ADD CONSTRAINT "EmissaoFechamentoHoras_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmissaoFechamentoHoras" ADD CONSTRAINT "EmissaoFechamentoHoras_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ItemFechamentoHoras" ADD CONSTRAINT "ItemFechamentoHoras_emissaoId_fkey" FOREIGN KEY ("emissaoId") REFERENCES "EmissaoFechamentoHoras"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ItemFechamentoHoras" ADD CONSTRAINT "ItemFechamentoHoras_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "ConferenciaOcorrenciaHoras"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION proteger_faturamento_horas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Origem do faturamento é preservada.';
END $$;
CREATE TRIGGER proteger_emissao_horas BEFORE UPDATE OR DELETE ON "EmissaoFechamentoHoras" FOR EACH ROW EXECUTE FUNCTION proteger_faturamento_horas();
CREATE TRIGGER proteger_item_horas BEFORE UPDATE OR DELETE ON "ItemFechamentoHoras" FOR EACH ROW EXECUTE FUNCTION proteger_faturamento_horas();
CREATE FUNCTION conferir_item_faturado_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EmissaoFechamentoHoras"%ROWTYPE; c "ConferenciaOcorrenciaHoras"%ROWTYPE; r "RascunhoFechamentoHoras"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO e FROM "EmissaoFechamentoHoras" WHERE id=NEW."emissaoId";
 SELECT * INTO c FROM "ConferenciaOcorrenciaHoras" WHERE id=NEW."conferenciaId";
 SELECT rasc.* INTO r FROM "RascunhoFechamentoHoras" rasc JOIN "DecisaoFechamentoHoras" d ON d."rascunhoId"=rasc.id WHERE d.id=e."decisaoId" AND d.aprovada;
 IF r.id IS NULL OR NEW.valor IS DISTINCT FROM c.valor OR NOT EXISTS (SELECT 1 FROM "EncontroAgenda" WHERE id=c."encontroId" AND "matriculaId"=r."matriculaId" AND inicio>=r."periodoInicio" AND inicio<r."periodoFimExclusivo") THEN RAISE EXCEPTION 'Item faturado incompatível com a decisão.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_item_faturado_horas BEFORE INSERT ON "ItemFechamentoHoras" FOR EACH ROW EXECUTE FUNCTION conferir_item_faturado_horas();
