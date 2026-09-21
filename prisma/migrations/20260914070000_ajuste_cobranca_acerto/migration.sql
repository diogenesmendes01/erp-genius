CREATE TABLE "AjusteCobrancaAcerto" (
 id TEXT PRIMARY KEY,
 "decisaoId" TEXT NOT NULL REFERENCES "DecisaoAcertoEncerramento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "cobrancaId" TEXT NOT NULL UNIQUE REFERENCES "Cobranca"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "executorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "versaoAnterior" INTEGER NOT NULL, "valorAnterior" DECIMAL(12,2) NOT NULL,
 "valorNovo" DECIMAL(12,2) NOT NULL CHECK("valorNovo">=0), "creditoApurado" DECIMAL(12,2) NOT NULL CHECK("creditoApurado">=0),
 moeda TEXT NOT NULL, origem JSONB NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER ajuste_acerto_preservado BEFORE UPDATE OR DELETE ON "AjusteCobrancaAcerto" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_ajuste_cobranca_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "Cobranca"; d "DecisaoAcertoEncerramento"; r "RascunhoAcertoEncerramento"; u "Usuario"; conferido BOOLEAN;
BEGIN
 SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
 SELECT * INTO d FROM "DecisaoAcertoEncerramento" WHERE id=NEW."decisaoId" FOR SHARE;
 SELECT * INTO r FROM "RascunhoAcertoEncerramento" WHERE id=d."rascunhoId" FOR SHARE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 IF NOT d.aprovada OR NOT u.ativo OR NOT ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Ajuste exige acerto aprovado e executor financeiro'; END IF;
 IF NEW."versaoAnterior"<>c.versao OR NEW."valorAnterior"<>c."valorNegociado" OR NEW.moeda<>c.moeda THEN RAISE EXCEPTION 'Cobrança mudou antes do ajuste'; END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(r.snapshot->'contratos') contrato, jsonb_array_elements(contrato->'lancamentos'->'plano'->'ajustes') a
 WHERE contrato->'lancamentos'->'plano'->>'matriculaId'=c."matriculaId" AND a->>'cobrancaId'=c.id AND (a->>'valorDevido')::numeric=NEW."valorNovo" AND (a->>'credito')::numeric=NEW."creditoApurado") INTO conferido;
 IF NOT conferido OR NEW."creditoApurado"<>greatest(0,coalesce(c."valorRecebido",0)+c."valorLiquidadoCredito"-NEW."valorNovo") THEN RAISE EXCEPTION 'Ajuste diverge do plano aprovado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ajuste_acerto_conferido BEFORE INSERT ON "AjusteCobrancaAcerto" FOR EACH ROW EXECUTE FUNCTION conferir_ajuste_cobranca_acerto();
CREATE FUNCTION aplicar_ajuste_cobranca_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE saldo_novo NUMERIC;
BEGIN
 SELECT greatest(0,NEW."valorNovo"-coalesce("valorRecebido",0)-"valorLiquidadoCredito") INTO saldo_novo FROM "Cobranca" WHERE id=NEW."cobrancaId";
 UPDATE "Cobranca" SET "valorNegociado"=NEW."valorNovo", saldo=saldo_novo, versao=versao+1,
 status=CASE WHEN saldo_novo=0 THEN 'PAGO'::"StatusCobranca" WHEN vencimento<CURRENT_TIMESTAMP THEN 'ATRASADO'::"StatusCobranca" ELSE 'PENDENTE'::"StatusCobranca" END,
 "pagoEm"=CASE WHEN saldo_novo=0 THEN coalesce("pagoEm",NEW."criadoEm") ELSE NULL END
 WHERE id=NEW."cobrancaId";
 RETURN NEW;
END $$;
CREATE TRIGGER ajuste_acerto_aplicado AFTER INSERT ON "AjusteCobrancaAcerto" FOR EACH ROW EXECUTE FUNCTION aplicar_ajuste_cobranca_acerto();
