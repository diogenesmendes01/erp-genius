-- CreateTable
CREATE TABLE "ExcecaoGravacaoEncontro" (
    "id" TEXT NOT NULL,
    "encontroId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcecaoGravacaoEncontro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoExcecaoGravacao" (
    "id" TEXT NOT NULL,
    "excecaoId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoExcecaoGravacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "excecao_gravacao_chave_key" ON "ExcecaoGravacaoEncontro"("solicitanteId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoExcecaoGravacao_excecaoId_key" ON "DecisaoExcecaoGravacao"("excecaoId");

-- AddForeignKey
ALTER TABLE "ExcecaoGravacaoEncontro" ADD CONSTRAINT "ExcecaoGravacaoEncontro_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ExcecaoGravacaoEncontro" ADD CONSTRAINT "ExcecaoGravacaoEncontro_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoExcecaoGravacao" ADD CONSTRAINT "DecisaoExcecaoGravacao_excecaoId_fkey" FOREIGN KEY ("excecaoId") REFERENCES "ExcecaoGravacaoEncontro"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoExcecaoGravacao" ADD CONSTRAINT "DecisaoExcecaoGravacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_excecao_gravacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Exceção de gravação deve permanecer preservada'; END $$;
CREATE TRIGGER excecao_gravacao_preservada BEFORE UPDATE OR DELETE ON "ExcecaoGravacaoEncontro" FOR EACH ROW EXECUTE FUNCTION preservar_excecao_gravacao();
CREATE FUNCTION conferir_decisao_gravacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão deve permanecer preservada'; END IF;
 IF EXISTS (SELECT 1 FROM "ExcecaoGravacaoEncontro" WHERE id=NEW."excecaoId" AND "solicitanteId"=NEW."decisorId") THEN RAISE EXCEPTION 'Outra pessoa deve decidir a exceção'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_gravacao_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoExcecaoGravacao" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_gravacao();
