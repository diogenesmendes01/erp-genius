CREATE TABLE "ConsumoHorasCompradas" (
 id TEXT PRIMARY KEY,
 "reservaId" TEXT NOT NULL UNIQUE REFERENCES "ReservaHorasCompradas"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "autorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 motivo TEXT NOT NULL CHECK (length(trim(motivo)) >= 5), "estadoDiario" TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION preservar_consumo_horas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Consumo preservado; correção exige ajuste próprio'; END $$;
CREATE TRIGGER preservar_consumo_horas BEFORE UPDATE OR DELETE ON "ConsumoHorasCompradas" FOR EACH ROW EXECUTE FUNCTION preservar_consumo_horas();
