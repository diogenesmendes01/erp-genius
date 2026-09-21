CREATE TABLE "ReservaHorasCompradas" (
 id TEXT PRIMARY KEY, "compraId" TEXT NOT NULL REFERENCES "CompraHorasAntecipadas"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "encontroId" TEXT NOT NULL UNIQUE REFERENCES "EncontroAgenda"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "autorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 minutos INTEGER NOT NULL CHECK (minutos > 0), inicio TIMESTAMP(3) NOT NULL, fim TIMESTAMP(3) NOT NULL,
 motivo TEXT NOT NULL CHECK (length(trim(motivo)) >= 5), "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("autorId", "chaveIdempotencia")
);
CREATE INDEX "ReservaHorasCompradas_compraId_idx" ON "ReservaHorasCompradas"("compraId");
CREATE FUNCTION proteger_reserva_horas_compradas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE compra "CompraHorasAntecipadas"; encontro "EncontroAgenda"; reservado BIGINT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Reserva de horas preservada; alteração exige fluxo próprio'; END IF;
 SELECT * INTO compra FROM "CompraHorasAntecipadas" WHERE id = NEW."compraId" FOR UPDATE;
 SELECT * INTO encontro FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR SHARE;
 IF compra.id IS NULL OR encontro.id IS NULL OR encontro."matriculaId" IS DISTINCT FROM compra."matriculaId" OR encontro.status <> 'PREVISTO' OR encontro.inicio <= CURRENT_TIMESTAMP OR NEW.inicio IS DISTINCT FROM encontro.inicio OR NEW.fim IS DISTINCT FROM encontro.fim OR EXTRACT(EPOCH FROM (NEW.fim - NEW.inicio)) <> NEW.minutos * 60 THEN
  RAISE EXCEPTION 'Reserva incompatível com o encontro e a compra';
 END IF;
 SELECT coalesce(sum(minutos),0) INTO reservado FROM "ReservaHorasCompradas" WHERE "compraId" = compra.id;
 IF reservado + NEW.minutos > compra."minutosComprados" THEN RAISE EXCEPTION 'Saldo de horas insuficiente'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proteger_reserva_horas_compradas BEFORE INSERT OR UPDATE OR DELETE ON "ReservaHorasCompradas" FOR EACH ROW EXECUTE FUNCTION proteger_reserva_horas_compradas();
