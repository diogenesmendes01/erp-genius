-- CreateTable
CREATE TABLE "JanelaAdmissaoTurma" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "limiteEntrada" DATE NOT NULL,
    "fusoAdmissao" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JanelaAdmissaoTurma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoJanelaAdmissao" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoJanelaAdmissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JanelaAdmissaoTurma_turmaId_versao_key" ON "JanelaAdmissaoTurma"("turmaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "JanelaAdmissaoTurma_preparadorId_chaveIdempotencia_key" ON "JanelaAdmissaoTurma"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoJanelaAdmissao_propostaId_key" ON "DecisaoJanelaAdmissao"("propostaId");

-- AddForeignKey
ALTER TABLE "JanelaAdmissaoTurma" ADD CONSTRAINT "JanelaAdmissaoTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "JanelaAdmissaoTurma" ADD CONSTRAINT "JanelaAdmissaoTurma_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoJanelaAdmissao" ADD CONSTRAINT "DecisaoJanelaAdmissao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "JanelaAdmissaoTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoJanelaAdmissao" ADD CONSTRAINT "DecisaoJanelaAdmissao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_janela_admissao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Versão da janela de admissão deve permanecer preservada';
END $$;
CREATE TRIGGER janela_admissao_preservada BEFORE UPDATE OR DELETE ON "JanelaAdmissaoTurma" FOR EACH ROW EXECUTE FUNCTION preservar_janela_admissao();
CREATE FUNCTION conferir_decisao_janela_admissao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão da janela deve permanecer preservada'; END IF;
 IF EXISTS (SELECT 1 FROM "JanelaAdmissaoTurma" WHERE id=NEW."propostaId" AND "preparadorId"=NEW."decisorId") THEN RAISE EXCEPTION 'Outra pessoa deve decidir a janela de admissão'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_janela_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoJanelaAdmissao" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_janela_admissao();
