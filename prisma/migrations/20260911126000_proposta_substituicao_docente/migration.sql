-- CreateTable
CREATE TABLE "PropostaSubstituicaoDocente" (
    "id" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "substitutoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaSubstituicaoDocente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemSubstituicaoDocente" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "encontroId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ItemSubstituicaoDocente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "substituicao_docente_chave_key" ON "PropostaSubstituicaoDocente"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "ItemSubstituicaoDocente_propostaId_encontroId_key" ON "ItemSubstituicaoDocente"("propostaId", "encontroId");

-- AddForeignKey
ALTER TABLE "PropostaSubstituicaoDocente" ADD CONSTRAINT "PropostaSubstituicaoDocente_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaSubstituicaoDocente" ADD CONSTRAINT "PropostaSubstituicaoDocente_substitutoId_fkey" FOREIGN KEY ("substitutoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ItemSubstituicaoDocente" ADD CONSTRAINT "ItemSubstituicaoDocente_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaSubstituicaoDocente"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ItemSubstituicaoDocente" ADD CONSTRAINT "ItemSubstituicaoDocente_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaSubstituicaoDocente" ADD CONSTRAINT substituicao_motivo_valido CHECK (length(trim(motivo)) >= 5);
CREATE FUNCTION preservar_proposta_substituicao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Proposta e itens da substituição devem permanecer preservados';
END $$;
CREATE TRIGGER substituicao_preservada BEFORE UPDATE OR DELETE ON "PropostaSubstituicaoDocente" FOR EACH ROW EXECUTE FUNCTION preservar_proposta_substituicao();
CREATE TRIGGER item_substituicao_preservado BEFORE UPDATE OR DELETE ON "ItemSubstituicaoDocente" FOR EACH ROW EXECUTE FUNCTION preservar_proposta_substituicao();
