-- CreateEnum
CREATE TYPE "StatusReservaVaga" AS ENUM ('ATIVA', 'MANTIDA_PENDENCIA', 'EXPIRADA', 'UTILIZADA', 'LIBERADA');

-- CreateTable
CREATE TABLE "ReservaVagaMatricula" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "janelaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "status" "StatusReservaVaga" NOT NULL DEFAULT 'ATIVA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,

    CONSTRAINT "ReservaVagaMatricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservaVagaMatricula_turmaId_status_idx" ON "ReservaVagaMatricula"("turmaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReservaVagaMatricula_preparadorId_chaveIdempotencia_key" ON "ReservaVagaMatricula"("preparadorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "ReservaVagaMatricula" ADD CONSTRAINT "ReservaVagaMatricula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReservaVagaMatricula" ADD CONSTRAINT "ReservaVagaMatricula_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReservaVagaMatricula" ADD CONSTRAINT "ReservaVagaMatricula_janelaId_fkey" FOREIGN KEY ("janelaId") REFERENCES "JanelaAdmissaoTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReservaVagaMatricula" ADD CONSTRAINT "ReservaVagaMatricula_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX reserva_matricula_vigente_key ON "ReservaVagaMatricula"("matriculaId") WHERE status IN ('ATIVA','MANTIDA_PENDENCIA');
ALTER TABLE "ReservaVagaMatricula" ADD CONSTRAINT reserva_prazo_valido CHECK ("expiraEm" > "criadaEm");
CREATE FUNCTION preservar_reserva_vaga_origem() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Histórico da reserva deve permanecer preservado'; END IF;
 IF ROW(OLD."matriculaId",OLD."turmaId",OLD."janelaId",OLD."preparadorId",OLD."criadaEm",OLD."motivo",OLD."chaveIdempotencia",OLD."entradaHash") IS DISTINCT FROM ROW(NEW."matriculaId",NEW."turmaId",NEW."janelaId",NEW."preparadorId",NEW."criadaEm",NEW."motivo",NEW."chaveIdempotencia",NEW."entradaHash") THEN RAISE EXCEPTION 'Origem da reserva não pode ser reescrita'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reserva_vaga_origem BEFORE UPDATE OR DELETE ON "ReservaVagaMatricula" FOR EACH ROW EXECUTE FUNCTION preservar_reserva_vaga_origem();
