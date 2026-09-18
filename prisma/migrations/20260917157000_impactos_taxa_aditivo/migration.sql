CREATE TYPE "StatusConjuntoImpactosTaxaAditivo" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'COMPLETO', 'OBSOLETO');
CREATE TYPE "DecisaoImpactoTaxaAditivo" AS ENUM ('AFETADA', 'PRESERVADA');

CREATE TABLE "ConjuntoImpactosTaxaAditivo" (
  "id" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "propostaAditivoId" TEXT NOT NULL,
  "conferenciaFinalId" TEXT NOT NULL,
  "versaoCondicoesId" TEXT NOT NULL,
  "preparadorId" TEXT NOT NULL,
  "status" "StatusConjuntoImpactosTaxaAditivo" NOT NULL DEFAULT 'PENDENTE',
  "fotografia" JSONB NOT NULL,
  "fotografiaHash" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConjuntoImpactosTaxaAditivo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConjuntoImpactosTaxaAditivo_propostaAditivoId_fkey" FOREIGN KEY ("propostaAditivoId") REFERENCES "PropostaAditivoContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "ConjuntoImpactosTaxaAditivo_conferenciaFinalId_fkey" FOREIGN KEY ("conferenciaFinalId") REFERENCES "ConferenciaFinalAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "ConjuntoImpactosTaxaAditivo_versaoCondicoesId_fkey" FOREIGN KEY ("versaoCondicoesId") REFERENCES "VersaoCondicoesAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "ConjuntoImpactosTaxaAditivo_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "ConjuntoImpactosTaxaAditivo_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ConjuntoImpactosTaxaAditivo_propostaAditivoId_fotografiaHash_key" ON "ConjuntoImpactosTaxaAditivo"("propostaAditivoId", "fotografiaHash");
CREATE UNIQUE INDEX "ConjuntoImpactosTaxaAditivo_preparadorId_chaveIdempotencia_key" ON "ConjuntoImpactosTaxaAditivo"("preparadorId", "chaveIdempotencia");
CREATE INDEX "ConjuntoImpactosTaxaAditivo_matriculaId_criadaEm_idx" ON "ConjuntoImpactosTaxaAditivo"("matriculaId", "criadaEm");

CREATE TABLE "DecisaoConjuntoImpactosTaxaAditivo" (
  "id" TEXT NOT NULL, "conjuntoId" TEXT NOT NULL, "decisorId" TEXT NOT NULL, "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL, "fotografiaHash" TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoConjuntoImpactosTaxaAditivo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisaoConjuntoImpactosTaxaAditivo_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "ConjuntoImpactosTaxaAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "DecisaoConjuntoImpactosTaxaAditivo_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "DecisaoConjuntoImpactosTaxaAditivo_conjuntoId_key" ON "DecisaoConjuntoImpactosTaxaAditivo"("conjuntoId");
CREATE UNIQUE INDEX "DecisaoConjuntoImpactosTaxaAditivo_decisorId_chaveIdempotencia_key" ON "DecisaoConjuntoImpactosTaxaAditivo"("decisorId", "chaveIdempotencia");

CREATE TABLE "ImpactoTaxaAditivo" (
  "id" TEXT NOT NULL, "conjuntoId" TEXT NOT NULL, "cobrancaId" TEXT NOT NULL,
  "decisao" "DecisaoImpactoTaxaAditivo" NOT NULL, "justificativa" TEXT NOT NULL,
  "fotografia" JSONB NOT NULL, "fotografiaHash" TEXT NOT NULL, "propostaAcertoId" TEXT, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImpactoTaxaAditivo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImpactoTaxaAditivo_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "ConjuntoImpactosTaxaAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "ImpactoTaxaAditivo_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "ImpactoTaxaAditivo_propostaAcertoId_fkey" FOREIGN KEY ("propostaAcertoId") REFERENCES "PropostaAcertoTaxaAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ImpactoTaxaAditivo_conjuntoId_cobrancaId_key" ON "ImpactoTaxaAditivo"("conjuntoId", "cobrancaId");
CREATE UNIQUE INDEX "ImpactoTaxaAditivo_propostaAcertoId_key" ON "ImpactoTaxaAditivo"("propostaAcertoId");
CREATE INDEX "ImpactoTaxaAditivo_cobrancaId_idx" ON "ImpactoTaxaAditivo"("cobrancaId");

CREATE FUNCTION proteger_conjunto_impactos_taxa_232() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conjunto "ConjuntoImpactosTaxaAditivo"%ROWTYPE; total_taxas integer; total_linhas integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Impactos de taxa preservados são imutáveis'; END IF;
  SELECT * INTO conjunto FROM "ConjuntoImpactosTaxaAditivo" WHERE id=NEW."conjuntoId" FOR SHARE;
  IF conjunto.id IS NULL OR conjunto.status <> 'PENDENTE' THEN RAISE EXCEPTION 'O conjunto de impactos não aceita novas linhas'; END IF;
  IF length(btrim(NEW.justificativa)) < 5 THEN RAISE EXCEPTION 'Toda cobrança preservada ou afetada exige justificativa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Cobranca" c WHERE c.id=NEW."cobrancaId" AND c."matriculaId"=conjunto."matriculaId" AND c.tipo='MATRICULA') THEN RAISE EXCEPTION 'A linha não pertence a uma taxa existente da matrícula'; END IF;
  SELECT count(*) INTO total_taxas FROM "Cobranca" WHERE "matriculaId"=conjunto."matriculaId" AND tipo='MATRICULA';
  SELECT count(*) + 1 INTO total_linhas FROM "ImpactoTaxaAditivo" WHERE "conjuntoId"=conjunto.id;
  IF total_linhas > total_taxas THEN RAISE EXCEPTION 'O conjunto contém taxa fora da fotografia'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ImpactoTaxaAditivo_proteger" BEFORE INSERT OR UPDATE OR DELETE ON "ImpactoTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION proteger_conjunto_impactos_taxa_232();
