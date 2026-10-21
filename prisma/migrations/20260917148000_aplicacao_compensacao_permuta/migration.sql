-- P02/223: compensação de serviço não é recebimento nem uso de crédito.
BEGIN;
ALTER TABLE "Cobranca" ADD COLUMN "valorCompensadoPermuta" DECIMAL(12,2) NOT NULL DEFAULT 0;
CREATE TABLE "AplicacaoCompensacaoPermuta" (
 id TEXT PRIMARY KEY, "destinoId" TEXT NOT NULL UNIQUE REFERENCES "DestinoPropostaCompensacaoPermuta"(id) ON DELETE RESTRICT,
 "decisaoId" TEXT NOT NULL REFERENCES "DecisaoCompensacaoPermuta"(id) ON DELETE RESTRICT,
 "cobrancaId" TEXT NOT NULL REFERENCES "Cobranca"(id) ON DELETE RESTRICT,
 valor DECIMAL(12,2) NOT NULL CHECK (valor>0), "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "AplicacaoCompensacaoPermuta"("cobrancaId");
CREATE INDEX ON "AplicacaoCompensacaoPermuta"("decisaoId");
CREATE FUNCTION validar_aplicacao_permuta_223() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destino "DestinoPropostaCompensacaoPermuta"%ROWTYPE; decisao "DecisaoCompensacaoPermuta"%ROWTYPE; cobranca "Cobranca"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação de permuta é imutável'; END IF;
 SELECT * INTO destino FROM "DestinoPropostaCompensacaoPermuta" WHERE id=NEW."destinoId" FOR SHARE;
 SELECT * INTO decisao FROM "DecisaoCompensacaoPermuta" WHERE id=NEW."decisaoId" FOR SHARE;
 SELECT * INTO cobranca FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
 IF destino.id IS NULL OR decisao.id IS NULL OR NOT decisao.aprovada OR decisao."propostaId" IS DISTINCT FROM destino."propostaId" OR NEW."cobrancaId" IS DISTINCT FROM destino."cobrancaId" OR NEW.valor IS DISTINCT FROM destino.valor OR cobranca.tipo<>'MENSALIDADE' OR cobranca.status NOT IN ('PENDENTE','ATRASADO') OR cobranca.saldo IS NULL OR NEW.valor>cobranca.saldo THEN RAISE EXCEPTION 'Aplicação exige destino aprovado e saldo disponível'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" WHERE id=decisao."decisorId" AND ativo AND ('ADMINISTRADOR'=ANY(papeis) OR ('FINANCEIRO'=ANY(papeis) AND 'financeiro.aprovar_acertos'=ANY(permissoes)))) THEN RAISE EXCEPTION 'Executor financeiro não autorizado'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "PropostaCompensacaoPermuta" p CROSS JOIN LATERAL jsonb_array_elements(p.snapshot->'destinos') f WHERE p.id=destino."propostaId" AND f->>'cobrancaId'=cobranca.id AND (f->>'versao')::integer=cobranca.versao AND (f->>'saldo')::numeric=cobranca.saldo) THEN RAISE EXCEPTION 'Aplicação de proposta obsoleta'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaCompensacaoPermuta" p JOIN "ConfirmacaoServicoPermuta" c ON c.id=p."confirmacaoId" JOIN "AcordoPermutaCobranca" e ON e."acordoId"=c."acordoId" AND e."cobrancaId"=NEW."cobrancaId" WHERE p.id=destino."propostaId" AND NEW.valor+coalesce((SELECT sum(ap.valor) FROM "AplicacaoCompensacaoPermuta" ap JOIN "DestinoPropostaCompensacaoPermuta" dp ON dp.id=ap."destinoId" JOIN "PropostaCompensacaoPermuta" pp ON pp.id=dp."propostaId" JOIN "ConfirmacaoServicoPermuta" cp ON cp.id=pp."confirmacaoId" WHERE cp."acordoId"=c."acordoId" AND ap."cobrancaId"=NEW."cobrancaId"),0)>e."valorMaximo") THEN RAISE EXCEPTION 'Limite cumulativo da cobrança excedido'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar_aplicacao_permuta BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION validar_aplicacao_permuta_223();
CREATE FUNCTION projetar_aplicacao_permuta_223() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total numeric; restante numeric;
BEGIN
 SELECT coalesce(sum(valor),0) INTO total FROM "AplicacaoCompensacaoPermuta" WHERE "cobrancaId"=NEW."cobrancaId";
 SELECT greatest(0,"valorNegociado"-coalesce("valorRecebido",0)-"valorLiquidadoCredito"-total) INTO restante FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
 UPDATE "Cobranca" SET "valorCompensadoPermuta"=total,saldo=restante,versao=versao+1,status=CASE WHEN restante=0 THEN 'PAGO'::"StatusCobranca" WHEN vencimento<CURRENT_TIMESTAMP THEN 'ATRASADO'::"StatusCobranca" ELSE 'PENDENTE'::"StatusCobranca" END,"pagoEm"=CASE WHEN restante=0 THEN NEW."aplicadaEm" ELSE NULL END WHERE id=NEW."cobrancaId";
 RETURN NEW;
END $$;
CREATE TRIGGER projetar_aplicacao_permuta AFTER INSERT ON "AplicacaoCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION projetar_aplicacao_permuta_223();
CREATE FUNCTION aplicar_decisao_permuta_223() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destino record;
BEGIN
 IF NEW.aprovada THEN
  FOR destino IN SELECT * FROM "DestinoPropostaCompensacaoPermuta" WHERE "propostaId"=NEW."propostaId" ORDER BY "cobrancaId" LOOP
   INSERT INTO "AplicacaoCompensacaoPermuta" (id,"destinoId","decisaoId","cobrancaId",valor,"aplicadaEm") VALUES ('permuta:'||destino.id,destino.id,NEW.id,destino."cobrancaId",destino.valor,NEW."decididaEm");
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_decisao_permuta AFTER INSERT ON "DecisaoCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION aplicar_decisao_permuta_223();
CREATE OR REPLACE FUNCTION "proteger_saldo_credito_cobranca"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total_permuta numeric; total_credito numeric; total_recebido numeric; credito_taxa numeric; saldo_esperado numeric;
BEGIN
  SELECT coalesce(sum(p.valor), 0) INTO total_credito FROM "PropostaUsoCredito" p JOIN "DecisaoUsoCredito" d ON d."propostaId" = p.id AND d.aprovada WHERE p."cobrancaId" = NEW.id;
  SELECT coalesce(sum(dest.valor), 0) INTO total_recebido FROM "DestinacaoRecebimento" dest WHERE dest."cobrancaId" = NEW.id;
  SELECT coalesce(sum(o.valor), 0) INTO credito_taxa FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId" = NEW.id;
  SELECT coalesce(sum(valor),0) INTO total_permuta FROM "AplicacaoCompensacaoPermuta" WHERE "cobrancaId"=NEW.id;
  saldo_esperado := greatest(0, NEW."valorNegociado" - total_recebido - total_credito - total_permuta + credito_taxa);
  IF NEW."valorCompensadoPermuta" IS DISTINCT FROM total_permuta OR NEW."valorLiquidadoCredito" IS DISTINCT FROM total_credito OR coalesce(NEW."valorRecebido", 0) IS DISTINCT FROM total_recebido OR (NEW.saldo IS NOT NULL AND NEW.saldo IS DISTINCT FROM saldo_esperado) OR (NEW.status = 'PAGO' AND saldo_esperado <> 0) THEN RAISE EXCEPTION 'Cobrança deve refletir somente destinações e créditos aprovados.'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "conferir_decisao_uso_credito"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaUsoCredito"; credito "CreditoMatricula"; c "Cobranca"; autorizado boolean; credito_taxa numeric;
BEGIN
 SELECT * INTO p FROM "PropostaUsoCredito" WHERE id = NEW."propostaId" FOR SHARE;
 SELECT ativo AND ('ADMINISTRADOR' = ANY(papeis) OR ('FINANCEIRO' = ANY(papeis) AND 'financeiro.aprovar_acertos' = ANY(permissoes))) INTO autorizado FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
 IF autorizado IS DISTINCT FROM true OR p."preparadorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Utilização exige aprovação financeira independente'; END IF;
 IF NEW.aprovada THEN
  SELECT * INTO credito FROM "CreditoMatricula" WHERE id = p."creditoId" FOR UPDATE;
  SELECT * INTO c FROM "Cobranca" WHERE id = p."cobrancaId" FOR UPDATE;
  SELECT coalesce(sum(o.valor),0) INTO credito_taxa FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId" = c.id;
  IF EXISTS(SELECT 1 FROM "PropostaUsoCredito" WHERE "creditoId"=credito.id AND versao>p.versao) OR saldo_credito_disponivel_207(credito.id)<p.valor OR credito."matriculaId" IS DISTINCT FROM c."matriculaId" OR credito.moeda IS DISTINCT FROM c.moeda OR c.status NOT IN ('PENDENTE','ATRASADO') OR p.valor>c."valorNegociado"-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito"-c."valorCompensadoPermuta"+credito_taxa OR c."suspensaPorItemPausaId" IS NOT NULL OR c."canceladaPorPausaId" IS NOT NULL OR EXISTS(SELECT 1 FROM "PagamentoInformado" WHERE "cobrancaId"=c.id AND status='A_CONFERIR') THEN RAISE EXCEPTION 'Utilização incompatível com versão, saldo, matrícula ou cobrança'; END IF;
  IF (p.snapshot->>'cobrancaVersao')::integer IS DISTINCT FROM c.versao OR (p.snapshot->>'valorCredito')::numeric IS DISTINCT FROM saldo_credito_disponivel_207(credito.id) THEN RAISE EXCEPTION 'Confira novamente a proposta de crédito'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "aplicar_uso_credito"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaUsoCredito"; c "Cobranca"; novo_total numeric; credito_taxa numeric; restante numeric;
BEGIN
 IF NEW.aprovada THEN
  SELECT * INTO p FROM "PropostaUsoCredito" WHERE id = NEW."propostaId";
  SELECT * INTO c FROM "Cobranca" WHERE id = p."cobrancaId" FOR UPDATE;
  SELECT coalesce(sum(pp.valor),0) INTO novo_total FROM "PropostaUsoCredito" pp JOIN "DecisaoUsoCredito" dd ON dd."propostaId" = pp.id AND dd.aprovada WHERE pp."cobrancaId" = c.id;
  SELECT coalesce(sum(o.valor),0) INTO credito_taxa FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId" = c.id;
  restante := greatest(0, c."valorNegociado" - coalesce(c."valorRecebido",0) - novo_total - c."valorCompensadoPermuta" + credito_taxa);
  UPDATE "Cobranca" SET "valorLiquidadoCredito" = novo_total, saldo = restante, versao = versao + 1,
   status = CASE WHEN restante = 0 THEN 'PAGO'::"StatusCobranca" WHEN vencimento < CURRENT_TIMESTAMP THEN 'ATRASADO'::"StatusCobranca" ELSE 'PENDENTE'::"StatusCobranca" END,
   "pagoEm" = CASE WHEN restante = 0 THEN NEW."decididaEm" ELSE NULL END WHERE id = c.id;
 END IF;
 RETURN NEW;
END $$;


COMMIT;
