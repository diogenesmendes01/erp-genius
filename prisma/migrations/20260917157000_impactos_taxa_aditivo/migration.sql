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
CREATE INDEX "ImpactoTaxaAditivo_propostaAcertoId_idx" ON "ImpactoTaxaAditivo"("propostaAcertoId");
CREATE INDEX "ImpactoTaxaAditivo_cobrancaId_idx" ON "ImpactoTaxaAditivo"("cobrancaId");

CREATE FUNCTION conferir_linhas_conjunto_impactos_taxa_232(conjunto_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE conjunto "ConjuntoImpactosTaxaAditivo"%ROWTYPE; total_taxas integer; total_linhas integer;
BEGIN
  SELECT * INTO conjunto FROM "ConjuntoImpactosTaxaAditivo" WHERE id=conjunto_id FOR SHARE;
  IF conjunto.id IS NULL THEN RAISE EXCEPTION 'Conjunto de impactos indisponível'; END IF;
  SELECT count(*) INTO total_taxas FROM "Cobranca" WHERE "matriculaId"=conjunto."matriculaId" AND tipo='MATRICULA';
  SELECT count(*) INTO total_linhas FROM "ImpactoTaxaAditivo" WHERE "conjuntoId"=conjunto.id;
  IF total_linhas <> total_taxas THEN RAISE EXCEPTION 'O conjunto deve declarar todas as taxas existentes da matrícula'; END IF;
  IF EXISTS (SELECT 1 FROM "ImpactoTaxaAditivo" i JOIN "Cobranca" c ON c.id=i."cobrancaId" LEFT JOIN "PropostaAcertoTaxaAditivo" p ON p.id=i."propostaAcertoId" WHERE i."conjuntoId"=conjunto.id AND (i.fotografia->'cobranca'->>'versao' IS DISTINCT FROM c.versao::text OR i.fotografia->'cobranca'->>'valorNegociado' IS DISTINCT FROM c."valorNegociado"::text OR i.fotografia->'cobranca'->>'vencimento' IS DISTINCT FROM c.vencimento::text) AND (p.id IS NULL OR p.status<>'APLICADA')) THEN RAISE EXCEPTION 'A fotografia de taxa mudou e exige reconstrução do conjunto'; END IF;
END;
$$;

CREATE FUNCTION conferir_conjunto_impactos_taxa_232(conjunto_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE conjunto "ConjuntoImpactosTaxaAditivo"%ROWTYPE; faltam_afetadas integer;
BEGIN
  PERFORM conferir_linhas_conjunto_impactos_taxa_232(conjunto_id);
  SELECT * INTO conjunto FROM "ConjuntoImpactosTaxaAditivo" WHERE id=conjunto_id FOR SHARE;
  SELECT count(*) INTO faltam_afetadas FROM "ImpactoTaxaAditivo" i
    LEFT JOIN "PropostaAcertoTaxaAditivo" p ON p.id=i."propostaAcertoId"
    WHERE i."conjuntoId"=conjunto.id AND i.decisao='AFETADA'
      AND (p.id IS NULL OR p."matriculaId"<>conjunto."matriculaId" OR p."propostaAditivoId"<>conjunto."propostaAditivoId" OR p.status<>'APLICADA');
  IF faltam_afetadas <> 0 THEN RAISE EXCEPTION 'Toda taxa afetada exige acerto aprovado e aplicado no conjunto'; END IF;
END;
$$;

CREATE FUNCTION proteger_conjunto_impactos_taxa_232() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total_taxas integer; u "Usuario"%ROWTYPE; decisao "DecisaoConjuntoImpactosTaxaAditivo"%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDENTE' THEN RAISE EXCEPTION 'Conjunto de impactos inicia pendente'; END IF;
    SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
    IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Conjunto exige Financeiro ativo'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" v WHERE v.id=NEW."versaoCondicoesId" AND v."matriculaId"=NEW."matriculaId" AND v."propostaId"=NEW."propostaAditivoId" AND v."conferenciaFinalId"=NEW."conferenciaFinalId") THEN RAISE EXCEPTION 'Conjunto não corresponde à versão formalizada'; END IF;
    IF jsonb_typeof(NEW.fotografia->'cobrancas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Fotografia do conjunto exige a lista fechada de taxas'; END IF;
    IF EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=NEW."matriculaId" AND c.tipo='MATRICULA' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.fotografia->'cobrancas') f WHERE f->>'id'=c.id)) OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.fotografia->'cobrancas') f WHERE NOT EXISTS (SELECT 1 FROM "Cobranca" c WHERE c.id=f->>'id' AND c."matriculaId"=NEW."matriculaId" AND c.tipo='MATRICULA')) THEN RAISE EXCEPTION 'Fotografia do conjunto diverge das taxas existentes'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Conjunto de impactos é imutável'; END IF;
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Fotografia do conjunto é imutável'; END IF;
  SELECT * INTO decisao FROM "DecisaoConjuntoImpactosTaxaAditivo" WHERE "conjuntoId"=NEW.id FOR SHARE;
  IF OLD.status='PENDENTE' AND NEW.status='APROVADO' THEN IF decisao.id IS NULL OR NOT decisao.aprovada OR decisao."fotografiaHash"<>NEW."fotografiaHash" THEN RAISE EXCEPTION 'Aprovação exige decisão independente correspondente'; END IF; PERFORM conferir_linhas_conjunto_impactos_taxa_232(NEW.id); RETURN NEW; END IF;
  IF OLD.status='PENDENTE' AND NEW.status='REJEITADO' THEN IF decisao.id IS NULL OR decisao.aprovada OR decisao."fotografiaHash"<>NEW."fotografiaHash" THEN RAISE EXCEPTION 'Rejeição exige decisão independente correspondente'; END IF; RETURN NEW; END IF;
  IF OLD.status='PENDENTE' AND NEW.status='OBSOLETO' THEN RETURN NEW; END IF;
  IF OLD.status='APROVADO' AND NEW.status='OBSOLETO' THEN
    BEGIN PERFORM conferir_conjunto_impactos_taxa_232(NEW.id); RAISE EXCEPTION 'Conjunto ainda íntegro não pode ser obsoleto'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Conjunto ainda íntegro não pode ser obsoleto' THEN RAISE; END IF; RETURN NEW; END;
  END IF;
  IF OLD.status='APROVADO' AND NEW.status='COMPLETO' THEN PERFORM conferir_conjunto_impactos_taxa_232(NEW.id); RETURN NEW; END IF;
  RAISE EXCEPTION 'Transição de estado do conjunto inválida';
END;
$$;

CREATE FUNCTION proteger_decisao_conjunto_impactos_taxa_232() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conjunto "ConjuntoImpactosTaxaAditivo"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de conjunto é imutável'; END IF;
  SELECT * INTO conjunto FROM "ConjuntoImpactosTaxaAditivo" WHERE id=NEW."conjuntoId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF conjunto.id IS NULL OR conjunto.status<>'PENDENTE' OR NEW."fotografiaHash"<>conjunto."fotografiaHash" THEN RAISE EXCEPTION 'Decisão não corresponde ao conjunto pendente'; END IF;
  IF NEW."decisorId"=conjunto."preparadorId" THEN RAISE EXCEPTION 'Conjunto exige outro Financeiro para decisão'; END IF;
  IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['ADMINISTRADOR']::"Papel"[] OR (u.papeis && ARRAY['FINANCEIRO']::"Papel"[] AND u.permissoes @> ARRAY['financeiro.aprovar_acertos'])) THEN RAISE EXCEPTION 'Decisão exige Financeiro autorizado'; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION proteger_linha_impacto_taxa_232() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conjunto "ConjuntoImpactosTaxaAditivo"%ROWTYPE; p "PropostaAcertoTaxaAditivo"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Impactos de taxa preservados são imutáveis'; END IF;
  SELECT * INTO conjunto FROM "ConjuntoImpactosTaxaAditivo" WHERE id=COALESCE(NEW."conjuntoId",OLD."conjuntoId") FOR SHARE;
  IF conjunto.id IS NULL OR conjunto.status<>'PENDENTE' THEN RAISE EXCEPTION 'O conjunto não aceita alterar suas linhas'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW."conjuntoId" IS DISTINCT FROM OLD."conjuntoId" OR NEW."cobrancaId" IS DISTINCT FROM OLD."cobrancaId" OR NEW.decisao IS DISTINCT FROM OLD.decisao OR NEW.justificativa IS DISTINCT FROM OLD.justificativa OR NEW.fotografia IS DISTINCT FROM OLD.fotografia OR NEW."fotografiaHash" IS DISTINCT FROM OLD."fotografiaHash" OR OLD."propostaAcertoId" IS NOT NULL OR NEW."propostaAcertoId" IS NULL THEN RAISE EXCEPTION 'A linha preservada só pode vincular um acerto uma vez'; END IF;
  END IF;
  IF length(btrim(NEW.justificativa)) < 5 OR jsonb_typeof(NEW.fotografia) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Toda taxa exige justificativa e fotografia'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Cobranca" c WHERE c.id=NEW."cobrancaId" AND c."matriculaId"=conjunto."matriculaId" AND c.tipo='MATRICULA') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(conjunto.fotografia->'cobrancas') f WHERE f->>'id'=NEW."cobrancaId") THEN RAISE EXCEPTION 'Linha fora da fotografia fechada das taxas'; END IF;
  IF NEW.decisao='PRESERVADA' AND NEW."propostaAcertoId" IS NOT NULL THEN RAISE EXCEPTION 'Taxa preservada não pode vincular acerto'; END IF;
  IF NEW."propostaAcertoId" IS NOT NULL THEN SELECT * INTO p FROM "PropostaAcertoTaxaAditivo" WHERE id=NEW."propostaAcertoId" FOR SHARE; IF p.id IS NULL OR p."matriculaId"<>conjunto."matriculaId" OR p."propostaAditivoId"<>conjunto."propostaAditivoId" OR p."versaoCondicoesId"<>conjunto."versaoCondicoesId" OR p."cobrancaId"<>NEW."cobrancaId" THEN RAISE EXCEPTION 'Acerto não pertence ao impacto de taxa'; END IF; IF EXISTS (SELECT 1 FROM "ImpactoTaxaAditivo" outro JOIN "ConjuntoImpactosTaxaAditivo" ativo ON ativo.id=outro."conjuntoId" WHERE outro."propostaAcertoId"=NEW."propostaAcertoId" AND outro.id<>NEW.id AND ativo.status IN ('PENDENTE','APROVADO','COMPLETO')) THEN RAISE EXCEPTION 'Acerto já integra outro conjunto ativo'; END IF; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ConjuntoImpactosTaxaAditivo_proteger" BEFORE INSERT OR UPDATE OR DELETE ON "ConjuntoImpactosTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION proteger_conjunto_impactos_taxa_232();
CREATE TRIGGER "DecisaoConjuntoImpactosTaxaAditivo_proteger" BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoConjuntoImpactosTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION proteger_decisao_conjunto_impactos_taxa_232();
CREATE TRIGGER "ImpactoTaxaAditivo_proteger" BEFORE INSERT OR UPDATE OR DELETE ON "ImpactoTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION proteger_linha_impacto_taxa_232();
