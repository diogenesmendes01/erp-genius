CREATE TABLE "CompraHorasAntecipadas" (
 "id" TEXT PRIMARY KEY,
 "matriculaId" TEXT NOT NULL REFERENCES "Matricula"("id") ON DELETE RESTRICT,
 "cobrancaId" TEXT NOT NULL UNIQUE,
 "documentoId" TEXT NOT NULL REFERENCES "Documento"("id") ON DELETE RESTRICT,
 "registradorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "minutosComprados" INTEGER NOT NULL CHECK ("minutosComprados" > 0 AND "minutosComprados" <= 5256000),
 "valorOriginal" DECIMAL(12,2) NOT NULL CHECK ("valorOriginal" >= 0),
 "descontoOriginal" DECIMAL(12,2) NOT NULL CHECK ("descontoOriginal" >= 0),
 "valorPagoAlocado" DECIMAL(12,2) NOT NULL CHECK ("valorPagoAlocado" >= 0),
 "moeda" TEXT NOT NULL,
 "evidenciaCondicoes" TEXT NOT NULL CHECK (length(trim("evidenciaCondicoes")) >= 5),
 "snapshot" JSONB NOT NULL,
 "chaveIdempotencia" TEXT NOT NULL,
 "entradaHash" TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("cobrancaId", "matriculaId") REFERENCES "Cobranca"("id", "matriculaId") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CHECK ("valorOriginal" - "descontoOriginal" = "valorPagoAlocado")
);
CREATE UNIQUE INDEX "compra_horas_chave_key" ON "CompraHorasAntecipadas"("registradorId", "chaveIdempotencia");
CREATE INDEX "CompraHorasAntecipadas_matriculaId_idx" ON "CompraHorasAntecipadas"("matriculaId");
CREATE FUNCTION preservar_compra_horas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Compra de horas deve preservar as condições e recebimentos originais';
END $$;
CREATE TRIGGER compra_horas_preservada BEFORE UPDATE OR DELETE ON "CompraHorasAntecipadas"
 FOR EACH ROW EXECUTE FUNCTION preservar_compra_horas();
