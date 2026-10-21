-- AlterTable
ALTER TABLE "EncontroAgenda" ADD COLUMN     "propostaGradeId" TEXT;

-- CreateTable
CREATE TABLE "DecisaoGradeTurma" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoGradeTurma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoGradeTurma_propostaId_key" ON "DecisaoGradeTurma"("propostaId");

-- AddForeignKey
ALTER TABLE "EncontroAgenda" ADD CONSTRAINT "EncontroAgenda_propostaGradeId_fkey" FOREIGN KEY ("propostaGradeId") REFERENCES "PropostaGradeTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoGradeTurma" ADD CONSTRAINT "DecisaoGradeTurma_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaGradeTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoGradeTurma" ADD CONSTRAINT "DecisaoGradeTurma_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


CREATE FUNCTION conferir_decisao_grade() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão da grade deve permanecer preservada'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaGradeTurma" WHERE id=NEW."propostaId" AND "preparadorId"=NEW."decisorId") THEN RAISE EXCEPTION 'Outra pessoa deve decidir a grade'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_grade_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoGradeTurma" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_grade();
