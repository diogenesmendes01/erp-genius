-- CreateTable
CREATE TABLE "PropostaLiberacaoHoras" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "cancelamentoId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "evidenciaEscolhaRemarcacao" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaLiberacaoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoLiberacaoHoras" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoLiberacaoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaLiberacaoHoras_reservaId_idx" ON "PropostaLiberacaoHoras"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaLiberacaoHoras_preparadorId_chaveIdempotencia_key" ON "PropostaLiberacaoHoras"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoLiberacaoHoras_propostaId_key" ON "DecisaoLiberacaoHoras"("propostaId");

-- CreateIndex
CREATE INDEX "DecisaoLiberacaoHoras_reservaId_idx" ON "DecisaoLiberacaoHoras"("reservaId");

-- AddForeignKey
ALTER TABLE "PropostaLiberacaoHoras" ADD CONSTRAINT "PropostaLiberacaoHoras_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaHorasCompradas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaLiberacaoHoras" ADD CONSTRAINT "PropostaLiberacaoHoras_cancelamentoId_fkey" FOREIGN KEY ("cancelamentoId") REFERENCES "DecisaoCancelamentoParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaLiberacaoHoras" ADD CONSTRAINT "PropostaLiberacaoHoras_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoLiberacaoHoras" ADD CONSTRAINT "DecisaoLiberacaoHoras_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaLiberacaoHoras"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoLiberacaoHoras" ADD CONSTRAINT "DecisaoLiberacaoHoras_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaHorasCompradas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoLiberacaoHoras" ADD CONSTRAINT "DecisaoLiberacaoHoras_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX liberacao_horas_aprovada_unica ON "DecisaoLiberacaoHoras"("reservaId") WHERE aprovada;
ALTER TABLE "PropostaLiberacaoHoras" ADD CHECK (length(btrim("evidenciaEscolhaRemarcacao")) >= 5 AND length(btrim(motivo)) >= 5);
ALTER TABLE "DecisaoLiberacaoHoras" ADD CHECK (length(btrim(motivo)) >= 5);
CREATE TRIGGER preservar_proposta_liberacao BEFORE UPDATE OR DELETE ON "PropostaLiberacaoHoras" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE TRIGGER preservar_decisao_liberacao BEFORE UPDATE OR DELETE ON "DecisaoLiberacaoHoras" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_liberacao_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaLiberacaoHoras"; autorizado boolean; encontro_id text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT * INTO p FROM "PropostaLiberacaoHoras" WHERE id = NEW."propostaId" FOR SHARE;
 SELECT ativo AND ('ADMINISTRADOR' = ANY(papeis) OR ('FINANCEIRO' = ANY(papeis) AND 'financeiro.aprovar_acertos' = ANY(permissoes))) INTO autorizado FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
 IF autorizado IS DISTINCT FROM true OR p."preparadorId" = NEW."decisorId" OR p."reservaId" IS DISTINCT FROM NEW."reservaId" THEN RAISE EXCEPTION 'Liberação exige aprovação financeira independente e reserva correspondente'; END IF;
 IF NEW.aprovada THEN
  SELECT "encontroId" INTO encontro_id FROM "ReservaHorasCompradas" WHERE id = NEW."reservaId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" WHERE "reservaId" = NEW."reservaId") OR NOT EXISTS (
   SELECT 1 FROM "DecisaoCancelamentoParticular" d JOIN "PropostaCancelamentoParticular" pc ON pc.id = d."propostaId" JOIN "EncontroAgenda" e ON e.id = pc."encontroId"
   WHERE d.id = p."cancelamentoId" AND d.aprovada AND e.id = encontro_id AND e.status = 'CANCELADO'
  ) THEN RAISE EXCEPTION 'Confira cancelamento aprovado e ausência de consumo'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_liberacao_horas BEFORE INSERT ON "DecisaoLiberacaoHoras" FOR EACH ROW EXECUTE FUNCTION conferir_liberacao_horas();
CREATE FUNCTION impedir_consumo_horas_liberadas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 IF EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" WHERE "reservaId" = NEW."reservaId" AND aprovada) THEN RAISE EXCEPTION 'Reserva liberada não pode ser consumida'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER impedir_consumo_horas_liberadas BEFORE INSERT ON "ConsumoHorasCompradas" FOR EACH ROW EXECUTE FUNCTION impedir_consumo_horas_liberadas();
CREATE OR REPLACE FUNCTION proteger_reserva_horas_compradas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE compra "CompraHorasAntecipadas"; encontro "EncontroAgenda"; reservado BIGINT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Reserva de horas preservada; alteração exige fluxo próprio'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT * INTO compra FROM "CompraHorasAntecipadas" WHERE id = NEW."compraId" FOR UPDATE;
 SELECT * INTO encontro FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR SHARE;
 IF compra.id IS NULL OR encontro.id IS NULL OR encontro."matriculaId" IS DISTINCT FROM compra."matriculaId" OR encontro.status <> 'PREVISTO' OR encontro.inicio <= CURRENT_TIMESTAMP OR NEW.inicio IS DISTINCT FROM encontro.inicio OR NEW.fim IS DISTINCT FROM encontro.fim OR EXTRACT(EPOCH FROM (NEW.fim - NEW.inicio)) <> NEW.minutos * 60 THEN RAISE EXCEPTION 'Reserva incompatível com o encontro e a compra'; END IF;
 SELECT coalesce(sum(r.minutos),0) INTO reservado FROM "ReservaHorasCompradas" r WHERE r."compraId" = compra.id AND NOT EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" d WHERE d."reservaId" = r.id AND d.aprovada);
 IF reservado + NEW.minutos > compra."minutosComprados" THEN RAISE EXCEPTION 'Saldo de horas insuficiente'; END IF;
 RETURN NEW;
END $$;
