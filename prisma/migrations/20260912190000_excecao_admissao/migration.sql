-- CreateTable
CREATE TABLE "PropostaExcecaoAdmissao" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "parecerViabilidade" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "estadoHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaExcecaoAdmissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoExcecaoAdmissao" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoExcecaoAdmissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaExcecaoAdmissao_reservaId_criadaEm_idx" ON "PropostaExcecaoAdmissao"("reservaId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaExcecaoAdmissao_preparadorId_chaveIdempotencia_key" ON "PropostaExcecaoAdmissao"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoExcecaoAdmissao_propostaId_key" ON "DecisaoExcecaoAdmissao"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaExcecaoAdmissao" ADD CONSTRAINT "PropostaExcecaoAdmissao_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaVagaMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaExcecaoAdmissao" ADD CONSTRAINT "PropostaExcecaoAdmissao_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoExcecaoAdmissao" ADD CONSTRAINT "DecisaoExcecaoAdmissao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaExcecaoAdmissao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoExcecaoAdmissao" ADD CONSTRAINT "DecisaoExcecaoAdmissao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_excecao_admissao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Registro de exceção de admissão é imutável';
END;
$$;
CREATE TRIGGER preservar_proposta_excecao_admissao BEFORE UPDATE OR DELETE ON "PropostaExcecaoAdmissao" FOR EACH ROW EXECUTE FUNCTION preservar_excecao_admissao();
CREATE TRIGGER preservar_decisao_excecao_admissao BEFORE UPDATE OR DELETE ON "DecisaoExcecaoAdmissao" FOR EACH ROW EXECUTE FUNCTION preservar_excecao_admissao();
CREATE FUNCTION validar_decisor_excecao_admissao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "PropostaExcecaoAdmissao" p WHERE p.id = NEW."propostaId" AND p."preparadorId" = NEW."decisorId") THEN RAISE EXCEPTION 'Outra pessoa deve decidir a exceção'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."decisorId" AND u.ativo AND (u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[])) THEN RAISE EXCEPTION 'Decisor sem permissão pedagógica'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validar_decisor_excecao_admissao BEFORE INSERT ON "DecisaoExcecaoAdmissao" FOR EACH ROW EXECUTE FUNCTION validar_decisor_excecao_admissao();
