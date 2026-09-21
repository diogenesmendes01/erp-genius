-- AlterTable
ALTER TABLE "PreparacaoComercialMatricula" ADD COLUMN     "reservaParticularId" TEXT,
ALTER COLUMN "reservaId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PreparacaoComercialMatricula_reservaParticularId_key" ON "PreparacaoComercialMatricula"("reservaParticularId");

-- AddForeignKey
ALTER TABLE "PreparacaoComercialMatricula" ADD CONSTRAINT "PreparacaoComercialMatricula_reservaParticularId_fkey" FOREIGN KEY ("reservaParticularId") REFERENCES "ReservaAgendaParticular"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PreparacaoComercialMatricula" ADD CONSTRAINT "preparacao_uma_reserva" CHECK (("reservaId" IS NOT NULL)::int + ("reservaParticularId" IS NOT NULL)::int = 1);
CREATE OR REPLACE FUNCTION preservar_preparacao_comercial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Preparação comercial é histórica e imutável'; END IF;
  IF NEW."reservaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ReservaVagaMatricula" r WHERE r.id = NEW."reservaId" AND r."matriculaId" = NEW."matriculaId") THEN RAISE EXCEPTION 'Reserva pertence a outra matrícula'; END IF;
  IF NEW."reservaParticularId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ReservaAgendaParticular" r WHERE r.id = NEW."reservaParticularId" AND r."matriculaId" = NEW."matriculaId") THEN RAISE EXCEPTION 'Reserva particular pertence a outra matrícula'; END IF;
  RETURN NEW;
END $$;
