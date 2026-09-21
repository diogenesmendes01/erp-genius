-- CreateTable
CREATE TABLE "PropostaResolucaoParticular" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "novoPrazo" TIMESTAMP(3),
    "motivo" TEXT NOT NULL,
    "tratamentoContratacao" TEXT NOT NULL,
    "estadoHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaResolucaoParticular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoResolucaoParticular" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoResolucaoParticular_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaResolucaoParticular_reservaId_versao_key" ON "PropostaResolucaoParticular"("reservaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaResolucaoParticular_preparadorId_chaveIdempotencia_key" ON "PropostaResolucaoParticular"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoResolucaoParticular_propostaId_key" ON "DecisaoResolucaoParticular"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaResolucaoParticular" ADD CONSTRAINT "PropostaResolucaoParticular_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaAgendaParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaResolucaoParticular" ADD CONSTRAINT "PropostaResolucaoParticular_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoResolucaoParticular" ADD CONSTRAINT "DecisaoResolucaoParticular_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaResolucaoParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoResolucaoParticular" ADD CONSTRAINT "DecisaoResolucaoParticular_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaResolucaoParticular" ADD CONSTRAINT resolucao_particular_tipo CHECK ((tipo='PRORROGAR' AND "novoPrazo" IS NOT NULL) OR (tipo='LIBERAR' AND "novoPrazo" IS NULL));
CREATE TRIGGER proposta_resolucao_particular_preservada BEFORE UPDATE OR DELETE ON "PropostaResolucaoParticular" FOR EACH ROW EXECUTE FUNCTION preservar_janela_admissao();
CREATE FUNCTION conferir_decisao_resolucao_particular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão da reserva deve permanecer preservada'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaResolucaoParticular" WHERE id=NEW."propostaId" AND "preparadorId"=NEW."decisorId") THEN RAISE EXCEPTION 'Outra pessoa deve decidir a resolução'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_resolucao_particular_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoResolucaoParticular" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_resolucao_particular();
