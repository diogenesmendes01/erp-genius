-- CreateTable
CREATE TABLE "PropostaResolucaoReserva" (
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

    CONSTRAINT "PropostaResolucaoReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoResolucaoReserva" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoResolucaoReserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaResolucaoReserva_reservaId_versao_key" ON "PropostaResolucaoReserva"("reservaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaResolucaoReserva_preparadorId_chaveIdempotencia_key" ON "PropostaResolucaoReserva"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoResolucaoReserva_propostaId_key" ON "DecisaoResolucaoReserva"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaResolucaoReserva" ADD CONSTRAINT "PropostaResolucaoReserva_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaVagaMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaResolucaoReserva" ADD CONSTRAINT "PropostaResolucaoReserva_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoResolucaoReserva" ADD CONSTRAINT "DecisaoResolucaoReserva_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaResolucaoReserva"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoResolucaoReserva" ADD CONSTRAINT "DecisaoResolucaoReserva_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaResolucaoReserva" ADD CONSTRAINT resolucao_reserva_tipo CHECK ((tipo='PRORROGAR' AND "novoPrazo" IS NOT NULL) OR (tipo='LIBERAR' AND "novoPrazo" IS NULL));
CREATE TRIGGER proposta_resolucao_reserva_preservada BEFORE UPDATE OR DELETE ON "PropostaResolucaoReserva" FOR EACH ROW EXECUTE FUNCTION preservar_janela_admissao();
CREATE FUNCTION conferir_decisao_resolucao_reserva() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão da reserva deve permanecer preservada'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaResolucaoReserva" WHERE id=NEW."propostaId" AND "preparadorId"=NEW."decisorId") THEN RAISE EXCEPTION 'Outra pessoa deve decidir a resolução'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_resolucao_reserva_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoResolucaoReserva" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_resolucao_reserva();
