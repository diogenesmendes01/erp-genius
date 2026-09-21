-- CreateTable
CREATE TABLE "PreparacaoComercialMatricula" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "regime" "TipoCobranca" NOT NULL,
    "taxaProposta" DECIMAL(12,2) NOT NULL,
    "valorServicoProposto" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "referencias" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreparacaoComercialMatricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreparacaoComercialMatricula_matriculaId_key" ON "PreparacaoComercialMatricula"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "PreparacaoComercialMatricula_reservaId_key" ON "PreparacaoComercialMatricula"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "PreparacaoComercialMatricula_preparadorId_chaveIdempotencia_key" ON "PreparacaoComercialMatricula"("preparadorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "PreparacaoComercialMatricula" ADD CONSTRAINT "PreparacaoComercialMatricula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PreparacaoComercialMatricula" ADD CONSTRAINT "PreparacaoComercialMatricula_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaVagaMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PreparacaoComercialMatricula" ADD CONSTRAINT "PreparacaoComercialMatricula_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


ALTER TABLE "PreparacaoComercialMatricula" ADD CONSTRAINT "preparacao_regime_valores" CHECK ("regime" IN ('MENSALIDADE', 'HORA_PARTICULAR') AND "taxaProposta" >= 0 AND "valorServicoProposto" >= 0);
CREATE FUNCTION preservar_preparacao_comercial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Preparação comercial é histórica e imutável'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "ReservaVagaMatricula" r WHERE r.id = NEW."reservaId" AND r."matriculaId" = NEW."matriculaId") THEN
    RAISE EXCEPTION 'Reserva pertence a outra matrícula';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_preparacao_comercial BEFORE INSERT OR UPDATE OR DELETE ON "PreparacaoComercialMatricula" FOR EACH ROW EXECUTE FUNCTION preservar_preparacao_comercial();
