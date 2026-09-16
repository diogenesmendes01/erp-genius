ALTER TYPE "TipoCobranca" ADD VALUE 'MULTA_ENCERRAMENTO';
ALTER TABLE "Cobranca" ADD COLUMN "acertoMultaDecisaoId" TEXT REFERENCES "DecisaoAcertoEncerramento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "Cobranca_acertoMultaDecisaoId_matriculaId_key" ON "Cobranca"("acertoMultaDecisaoId","matriculaId");
ALTER TABLE "Cobranca" ADD CHECK ((tipo::text='MULTA_ENCERRAMENTO')=("acertoMultaDecisaoId" IS NOT NULL));
CREATE FUNCTION conferir_multa_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p JSONB;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD."acertoMultaDecisaoId" IS NOT NULL THEN RAISE EXCEPTION 'Preserve a multa e sua origem'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD."acertoMultaDecisaoId" IS DISTINCT FROM NEW."acertoMultaDecisaoId" OR
   (OLD."acertoMultaDecisaoId" IS NOT NULL AND (OLD."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR OLD.tipo IS DISTINCT FROM NEW.tipo OR OLD.moeda IS DISTINCT FROM NEW.moeda OR OLD."valorOriginal" IS DISTINCT FROM NEW."valorOriginal"))
  THEN RAISE EXCEPTION 'Preserve a origem da multa'; END IF;
  RETURN NEW;
 END IF;
 IF NEW."acertoMultaDecisaoId" IS NULL THEN RETURN NEW; END IF;
 SELECT c->'lancamentos'->'plano' INTO p FROM "DecisaoAcertoEncerramento" d JOIN "RascunhoAcertoEncerramento" r ON r.id=d."rascunhoId", jsonb_array_elements(r.snapshot->'contratos') c
 WHERE d.id=NEW."acertoMultaDecisaoId" AND d.aprovada AND c->'lancamentos'->'plano'->>'matriculaId'=NEW."matriculaId";
 IF p IS NULL OR NEW.moeda IS DISTINCT FROM p->>'moeda'
 OR NEW."valorOriginal" IS DISTINCT FROM (p->'multa'->>'valorContratual')::numeric
 OR NEW."valorNegociado" IS DISTINCT FROM (p->'multa'->>'valorProposto')::numeric
 OR NEW."valorNegociado"<=0 OR NEW.saldo IS DISTINCT FROM NEW."valorNegociado"
 OR NEW.vencimento IS DISTINCT FROM (p->'multa'->>'vencimento')::date::timestamp
 OR NEW."valorRecebido" IS NOT NULL OR NEW."valorLiquidadoCredito"<>0 OR NEW."pagoEm" IS NOT NULL OR NEW.status::text<>'PENDENTE'
 THEN RAISE EXCEPTION 'Multa diverge do acerto aprovado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_multa_acerto BEFORE INSERT OR UPDATE OR DELETE ON "Cobranca" FOR EACH ROW EXECUTE FUNCTION conferir_multa_acerto();
