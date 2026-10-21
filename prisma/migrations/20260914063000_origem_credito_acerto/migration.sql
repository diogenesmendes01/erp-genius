CREATE TABLE "OrigemCreditoAcerto" (
 id TEXT PRIMARY KEY,
 "decisaoId" TEXT NOT NULL REFERENCES "DecisaoAcertoEncerramento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "origemTipo" TEXT NOT NULL CHECK("origemTipo" IN ('COBRANCA','COMPRA_HORAS')),
 "origemId" TEXT NOT NULL, valor DECIMAL(12,2) NOT NULL CHECK(valor > 0), moeda TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OrigemCreditoAcerto_origemTipo_origemId_key" ON "OrigemCreditoAcerto"("origemTipo","origemId");
ALTER TABLE "CreditoMatricula" ALTER COLUMN "origemLiberacaoId" DROP NOT NULL;
ALTER TABLE "CreditoMatricula" ADD COLUMN "origemAcertoId" TEXT REFERENCES "OrigemCreditoAcerto"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "CreditoMatricula_origemAcertoId_key" ON "CreditoMatricula"("origemAcertoId");
ALTER TABLE "CreditoMatricula" ADD CHECK(num_nonnulls("origemAcertoId","origemLiberacaoId") = 1);
DROP TRIGGER conferir_credito_horas ON "CreditoMatricula";
CREATE TRIGGER conferir_credito_horas BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW WHEN (NEW."origemLiberacaoId" IS NOT NULL) EXECUTE FUNCTION conferir_credito_horas();
CREATE TRIGGER origem_credito_acerto_preservada BEFORE UPDATE OR DELETE ON "OrigemCreditoAcerto" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_origem_credito_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d "DecisaoAcertoEncerramento"; r "RascunhoAcertoEncerramento"; encontrado BOOLEAN;
BEGIN
 SELECT * INTO d FROM "DecisaoAcertoEncerramento" WHERE id=NEW."decisaoId" FOR SHARE;
 SELECT * INTO r FROM "RascunhoAcertoEncerramento" WHERE id=d."rascunhoId" FOR SHARE;
 IF NOT d.aprovada THEN RAISE EXCEPTION 'Crédito exige acerto aprovado'; END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(r.snapshot->'contratos') c,
 jsonb_array_elements(c->'lancamentos'->'plano'->'creditos') cr
 WHERE c->'lancamentos'->'plano'->>'matriculaId'=NEW."matriculaId"
 AND c->'lancamentos'->'plano'->>'moeda'=NEW.moeda
 AND cr->>'origemTipo'=NEW."origemTipo" AND cr->>'origemId'=NEW."origemId" AND (cr->>'valor')::numeric=NEW.valor) INTO encontrado;
 IF NOT encontrado THEN RAISE EXCEPTION 'Origem ou valor não corresponde ao acerto aprovado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER origem_credito_acerto_conferida BEFORE INSERT ON "OrigemCreditoAcerto" FOR EACH ROW EXECUTE FUNCTION conferir_origem_credito_acerto();
CREATE FUNCTION conferir_credito_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "OrigemCreditoAcerto";
BEGIN
 SELECT * INTO o FROM "OrigemCreditoAcerto" WHERE id=NEW."origemAcertoId" FOR SHARE;
 IF NEW."matriculaId" IS DISTINCT FROM o."matriculaId" OR NEW.moeda IS DISTINCT FROM o.moeda OR NEW."valorInicial" IS DISTINCT FROM o.valor THEN RAISE EXCEPTION 'Crédito diverge da origem do acerto'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER credito_acerto_conferido BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW WHEN (NEW."origemAcertoId" IS NOT NULL) EXECUTE FUNCTION conferir_credito_acerto();
