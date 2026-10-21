-- CreateTable
CREATE TABLE "IndisponibilidadeDocente" (
    "id" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "fusoOrigem" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndisponibilidadeDocente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoIndisponibilidadeDocente" (
    "id" TEXT NOT NULL,
    "indisponibilidadeId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "encontrosAfetados" JSONB NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoIndisponibilidadeDocente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndisponibilidadeDocente_professorId_inicio_fim_idx" ON "IndisponibilidadeDocente"("professorId", "inicio", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "ausencia_docente_chave_key" ON "IndisponibilidadeDocente"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoIndisponibilidadeDocente_indisponibilidadeId_key" ON "DecisaoIndisponibilidadeDocente"("indisponibilidadeId");

-- AddForeignKey
ALTER TABLE "IndisponibilidadeDocente" ADD CONSTRAINT "IndisponibilidadeDocente_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "IndisponibilidadeDocente" ADD CONSTRAINT "IndisponibilidadeDocente_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoIndisponibilidadeDocente" ADD CONSTRAINT "DecisaoIndisponibilidadeDocente_indisponibilidadeId_fkey" FOREIGN KEY ("indisponibilidadeId") REFERENCES "IndisponibilidadeDocente"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoIndisponibilidadeDocente" ADD CONSTRAINT "DecisaoIndisponibilidadeDocente_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "IndisponibilidadeDocente" ADD CONSTRAINT ausencia_intervalo_valido CHECK (fim > inicio), ADD CONSTRAINT ausencia_motivo_valido CHECK (length(trim(motivo)) >= 5);
CREATE FUNCTION preservar_ausencia_docente() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Solicitação de indisponibilidade deve permanecer preservada';
END $$;
CREATE TRIGGER ausencia_docente_preservada BEFORE UPDATE OR DELETE ON "IndisponibilidadeDocente" FOR EACH ROW EXECUTE FUNCTION preservar_ausencia_docente();
CREATE FUNCTION conferir_decisao_ausencia() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de indisponibilidade deve permanecer preservada'; END IF;
 IF EXISTS (SELECT 1 FROM "IndisponibilidadeDocente" WHERE id = NEW."indisponibilidadeId" AND ("preparadorId" = NEW."decisorId" OR "professorId" = NEW."decisorId")) THEN
 RAISE EXCEPTION 'Outra pessoa deve decidir a indisponibilidade';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_ausencia_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoIndisponibilidadeDocente" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_ausencia();
