-- CreateTable
CREATE TABLE "VersaoRegraAvaliacao" (
    "id" TEXT NOT NULL,
    "nivelId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "conteudo" JSONB NOT NULL,
    "conteudoHash" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersaoRegraAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoRegraAvaliacao" (
    "id" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoRegraAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VersaoRegraAvaliacao_nivelId_versao_key" ON "VersaoRegraAvaliacao"("nivelId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoRegraAvaliacao_preparadorId_chaveIdempotencia_key" ON "VersaoRegraAvaliacao"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoRegraAvaliacao_regraId_key" ON "DecisaoRegraAvaliacao"("regraId");

-- AddForeignKey
ALTER TABLE "VersaoRegraAvaliacao" ADD CONSTRAINT "VersaoRegraAvaliacao_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "Nivel"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VersaoRegraAvaliacao" ADD CONSTRAINT "VersaoRegraAvaliacao_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRegraAvaliacao" ADD CONSTRAINT "DecisaoRegraAvaliacao_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRegraAvaliacao" ADD CONSTRAINT "DecisaoRegraAvaliacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "VersaoRegraAvaliacao" ADD CONSTRAINT "regra_avaliacao_versao_positiva" CHECK (versao > 0);
ALTER TABLE "VersaoRegraAvaliacao" ADD CONSTRAINT "regra_avaliacao_hash_formato" CHECK ("conteudoHash" ~ '^[a-f0-9]{64}$' AND "entradaHash" ~ '^[a-f0-9]{64}$');
CREATE FUNCTION preservar_regra_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 autor TEXT;
 nivel TEXT;
 preparador TEXT;
 versao_regra INTEGER;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Regras e decisões de avaliação são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'VersaoRegraAvaliacao' THEN
  autor := NEW."preparadorId";
  nivel := NEW."nivelId";
 ELSE
  autor := NEW."decisorId";
  SELECT "nivelId", "preparadorId", versao INTO nivel, preparador, versao_regra FROM "VersaoRegraAvaliacao" WHERE id = NEW."regraId";
  IF preparador = autor THEN RAISE EXCEPTION 'Avaliação exige decisão independente'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('regra-avaliacao-nivel:' || nivel, 0));
 PERFORM id FROM "Usuario" WHERE id = autor AND ativo AND
   (papeis && ARRAY['GERENTE_PEDAGOGICO', 'ADMINISTRADOR']::"Papel"[]) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Regra exige gestão pedagógica ou administração ativa'; END IF;
 IF TG_TABLE_NAME = 'VersaoRegraAvaliacao' THEN
  IF NEW.versao <> (SELECT COALESCE(MAX(versao), 0) + 1 FROM "VersaoRegraAvaliacao" WHERE "nivelId" = nivel) THEN
   RAISE EXCEPTION 'Versão de avaliação desatualizada';
  END IF;
 ELSIF NEW.aprovada AND versao_regra <> (SELECT MAX(versao) FROM "VersaoRegraAvaliacao" WHERE "nivelId" = nivel) THEN
  RAISE EXCEPTION 'Existe proposta de avaliação mais recente';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_versao_regra_avaliacao BEFORE INSERT OR UPDATE OR DELETE ON "VersaoRegraAvaliacao" FOR EACH ROW EXECUTE FUNCTION preservar_regra_avaliacao();
CREATE TRIGGER preservar_decisao_regra_avaliacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoRegraAvaliacao" FOR EACH ROW EXECUTE FUNCTION preservar_regra_avaliacao();
-- Propostas e decisões são registros históricos imutáveis.
