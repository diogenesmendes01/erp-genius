-- CreateEnum
CREATE TYPE "DestinoHorasCanceladas" AS ENUM ('REMARCACAO', 'CREDITO');

-- AlterTable
ALTER TABLE "PropostaLiberacaoHoras" ADD COLUMN     "calculoCredito" JSONB,
ADD COLUMN     "destino" "DestinoHorasCanceladas" NOT NULL DEFAULT 'REMARCACAO',
ADD COLUMN     "valorCredito" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "CreditoMatricula" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "origemLiberacaoId" TEXT NOT NULL,
    "valorInicial" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditoMatricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditoMatricula_origemLiberacaoId_key" ON "CreditoMatricula"("origemLiberacaoId");

-- CreateIndex
CREATE INDEX "CreditoMatricula_matriculaId_idx" ON "CreditoMatricula"("matriculaId");

-- AddForeignKey
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "CreditoMatricula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "CreditoMatricula_origemLiberacaoId_fkey" FOREIGN KEY ("origemLiberacaoId") REFERENCES "DecisaoLiberacaoHoras"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaLiberacaoHoras" ADD CHECK ((destino = 'REMARCACAO' AND "valorCredito" IS NULL AND "calculoCredito" IS NULL) OR (destino = 'CREDITO' AND "valorCredito" IS NOT NULL AND "valorCredito" >= 0 AND "calculoCredito" IS NOT NULL));
ALTER TABLE "CreditoMatricula" ADD CHECK ("valorInicial" >= 0);
CREATE TRIGGER preservar_credito_matricula BEFORE UPDATE OR DELETE ON "CreditoMatricula" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_credito_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d "DecisaoLiberacaoHoras"; p "PropostaLiberacaoHoras"; r "ReservaHorasCompradas"; c "CompraHorasAntecipadas"; minutos_anteriores bigint; valor_anterior numeric; esperado numeric;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT * INTO d FROM "DecisaoLiberacaoHoras" WHERE id = NEW."origemLiberacaoId" FOR SHARE;
 SELECT * INTO p FROM "PropostaLiberacaoHoras" WHERE id = d."propostaId" FOR SHARE;
 SELECT * INTO r FROM "ReservaHorasCompradas" WHERE id = d."reservaId" FOR SHARE;
 SELECT * INTO c FROM "CompraHorasAntecipadas" WHERE id = r."compraId" FOR UPDATE;
 IF NOT d.aprovada OR p.destino <> 'CREDITO' OR NEW."matriculaId" IS DISTINCT FROM c."matriculaId" OR NEW.moeda IS DISTINCT FROM c.moeda OR NEW."valorInicial" IS DISTINCT FROM p."valorCredito" THEN RAISE EXCEPTION 'Crédito incompatível com decisão e compra'; END IF;
 SELECT coalesce(sum(rr.minutos),0), coalesce(sum(cc."valorInicial"),0) INTO minutos_anteriores, valor_anterior FROM "CreditoMatricula" cc JOIN "DecisaoLiberacaoHoras" dd ON dd.id = cc."origemLiberacaoId" JOIN "ReservaHorasCompradas" rr ON rr.id = dd."reservaId" WHERE rr."compraId" = c.id;
 esperado := round(c."valorPagoAlocado" * (minutos_anteriores + r.minutos) / c."minutosComprados", 2) - valor_anterior;
 IF minutos_anteriores + r.minutos > c."minutosComprados" OR NEW."valorInicial" IS DISTINCT FROM esperado THEN RAISE EXCEPTION 'Crédito exige valor original e arredondamento acumulado conferidos'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_credito_horas BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW EXECUTE FUNCTION conferir_credito_horas();
CREATE FUNCTION exigir_credito_da_decisao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.aprovada AND EXISTS (SELECT 1 FROM "PropostaLiberacaoHoras" WHERE id = NEW."propostaId" AND destino = 'CREDITO') AND NOT EXISTS (SELECT 1 FROM "CreditoMatricula" WHERE "origemLiberacaoId" = NEW.id) THEN RAISE EXCEPTION 'Decisão de crédito exige registro monetário na mesma transação'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER exigir_credito_da_decisao AFTER INSERT ON "DecisaoLiberacaoHoras" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_credito_da_decisao();
CREATE OR REPLACE FUNCTION proteger_reserva_horas_compradas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE compra "CompraHorasAntecipadas"; encontro "EncontroAgenda"; reservado BIGINT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Reserva de horas preservada; alteração exige fluxo próprio'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT * INTO compra FROM "CompraHorasAntecipadas" WHERE id = NEW."compraId" FOR UPDATE;
 SELECT * INTO encontro FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR SHARE;
 IF compra.id IS NULL OR encontro.id IS NULL OR encontro."matriculaId" IS DISTINCT FROM compra."matriculaId" OR encontro.status <> 'PREVISTO' OR encontro.inicio <= CURRENT_TIMESTAMP OR NEW.inicio IS DISTINCT FROM encontro.inicio OR NEW.fim IS DISTINCT FROM encontro.fim OR EXTRACT(EPOCH FROM (NEW.fim - NEW.inicio)) <> NEW.minutos * 60 THEN RAISE EXCEPTION 'Reserva incompatível com o encontro e a compra'; END IF;
 SELECT coalesce(sum(r.minutos),0) INTO reservado FROM "ReservaHorasCompradas" r WHERE r."compraId" = compra.id AND NOT EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" d WHERE d."reservaId" = r.id AND d.aprovada AND EXISTS (SELECT 1 FROM "PropostaLiberacaoHoras" p WHERE p.id = d."propostaId" AND p.destino = 'REMARCACAO'));
 IF reservado + NEW.minutos > compra."minutosComprados" THEN RAISE EXCEPTION 'Saldo de horas insuficiente'; END IF;
 RETURN NEW;
END $$;

