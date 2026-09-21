CREATE FUNCTION conferir_validade_acerto_vinculado_237() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoTaxaAditivo"%ROWTYPE;
BEGIN
  IF NEW."propostaAcertoId" IS NOT NULL THEN
    SELECT * INTO p FROM "PropostaAcertoTaxaAditivo" WHERE id=NEW."propostaAcertoId" FOR SHARE;
    IF p.status NOT IN ('PENDENTE','APROVADA','APLICADA') THEN RAISE EXCEPTION 'Acerto vinculado não está vigente'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "ImpactoTaxaAditivo_validade_acerto_237" BEFORE INSERT OR UPDATE ON "ImpactoTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION conferir_validade_acerto_vinculado_237();

CREATE FUNCTION conferir_acertos_na_aprovacao_237() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.aprovada AND EXISTS (SELECT 1 FROM "ImpactoTaxaAditivo" i JOIN "PropostaAcertoTaxaAditivo" p ON p.id=i."propostaAcertoId" WHERE i."conjuntoId"=NEW."conjuntoId" AND i.decisao='AFETADA' AND p.status NOT IN ('PENDENTE','APROVADA','APLICADA')) THEN RAISE EXCEPTION 'Acerto vinculado não está vigente para aprovação'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "DecisaoConjuntoImpactosTaxaAditivo_validade_acerto_237" BEFORE INSERT ON "DecisaoConjuntoImpactosTaxaAditivo" FOR EACH ROW EXECUTE FUNCTION conferir_acertos_na_aprovacao_237();

CREATE OR REPLACE FUNCTION proteger_conjunto_impactos_taxa_232() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; decisao "DecisaoConjuntoImpactosTaxaAditivo"%ROWTYPE; acerto_inviavel boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'PENDENTE' THEN RAISE EXCEPTION 'Conjunto de impactos inicia pendente'; END IF;
    SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
    IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Conjunto exige Financeiro ativo'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" v WHERE v.id=NEW."versaoCondicoesId" AND v."matriculaId"=NEW."matriculaId" AND v."propostaId"=NEW."propostaAditivoId" AND v."conferenciaFinalId"=NEW."conferenciaFinalId") THEN RAISE EXCEPTION 'Conjunto não corresponde à versão formalizada'; END IF;
    IF jsonb_typeof(NEW.fotografia->'cobrancas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Fotografia do conjunto exige a lista fechada de taxas'; END IF;
    IF EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=NEW."matriculaId" AND c.tipo='MATRICULA' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.fotografia->'cobrancas') f WHERE f->>'id'=c.id)) OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.fotografia->'cobrancas') f WHERE NOT EXISTS (SELECT 1 FROM "Cobranca" c WHERE c.id=f->>'id' AND c."matriculaId"=NEW."matriculaId" AND c.tipo='MATRICULA')) THEN RAISE EXCEPTION 'Fotografia do conjunto diverge das taxas existentes'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Conjunto de impactos é imutável'; END IF;
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Fotografia do conjunto é imutável'; END IF;
  SELECT * INTO decisao FROM "DecisaoConjuntoImpactosTaxaAditivo" WHERE "conjuntoId"=NEW.id FOR SHARE;
  IF OLD.status='PENDENTE' AND NEW.status='APROVADO' THEN IF decisao.id IS NULL OR NOT decisao.aprovada OR decisao."fotografiaHash"<>NEW."fotografiaHash" THEN RAISE EXCEPTION 'Aprovação exige decisão independente correspondente'; END IF; PERFORM conferir_linhas_conjunto_impactos_taxa_232(NEW.id); RETURN NEW; END IF;
  IF OLD.status='PENDENTE' AND NEW.status='REJEITADO' THEN IF decisao.id IS NULL OR decisao.aprovada OR decisao."fotografiaHash"<>NEW."fotografiaHash" THEN RAISE EXCEPTION 'Rejeição exige decisão independente correspondente'; END IF; RETURN NEW; END IF;
  IF OLD.status='PENDENTE' AND NEW.status='OBSOLETO' THEN RETURN NEW; END IF;
  IF OLD.status='APROVADO' AND NEW.status='OBSOLETO' THEN
    SELECT EXISTS (SELECT 1 FROM "ImpactoTaxaAditivo" i JOIN "PropostaAcertoTaxaAditivo" p ON p.id=i."propostaAcertoId" WHERE i."conjuntoId"=NEW.id AND i.decisao='AFETADA' AND p.status NOT IN ('PENDENTE','APROVADA','APLICADA')) INTO acerto_inviavel;
    IF acerto_inviavel THEN RETURN NEW; END IF;
    BEGIN PERFORM conferir_linhas_conjunto_impactos_taxa_232(NEW.id); EXCEPTION WHEN SQLSTATE 'Q2321' THEN RETURN NEW; END;
    RAISE EXCEPTION 'Conjunto aprovado ainda íntegro não pode ser obsoleto';
  END IF;
  IF OLD.status='APROVADO' AND NEW.status='COMPLETO' THEN PERFORM conferir_conjunto_impactos_taxa_232(NEW.id); RETURN NEW; END IF;
  RAISE EXCEPTION 'Transição de estado do conjunto inválida';
END;
$$;
