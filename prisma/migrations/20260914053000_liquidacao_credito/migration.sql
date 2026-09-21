-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN     "valorLiquidadoCredito" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DecisaoUsoCredito" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoUsoCredito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoUsoCredito_propostaId_key" ON "DecisaoUsoCredito"("propostaId");

-- AddForeignKey
ALTER TABLE "DecisaoUsoCredito" ADD CONSTRAINT "DecisaoUsoCredito_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaUsoCredito"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoUsoCredito" ADD CONSTRAINT "DecisaoUsoCredito_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "DecisaoUsoCredito" ADD CHECK (length(btrim(motivo)) >= 5);
CREATE TRIGGER preservar_decisao_uso_credito BEFORE UPDATE OR DELETE ON "DecisaoUsoCredito" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_decisao_uso_credito() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaUsoCredito"; credito "CreditoMatricula"; c "Cobranca"; autorizado boolean; utilizado numeric;
BEGIN
 SELECT * INTO p FROM "PropostaUsoCredito" WHERE id = NEW."propostaId" FOR SHARE;
 SELECT ativo AND ('ADMINISTRADOR' = ANY(papeis) OR ('FINANCEIRO' = ANY(papeis) AND 'financeiro.aprovar_acertos' = ANY(permissoes))) INTO autorizado FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
 IF autorizado IS DISTINCT FROM true OR p."preparadorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Utilização exige aprovação financeira independente'; END IF;
 IF NEW.aprovada THEN
  SELECT * INTO credito FROM "CreditoMatricula" WHERE id = p."creditoId" FOR UPDATE;
  SELECT * INTO c FROM "Cobranca" WHERE id = p."cobrancaId" FOR UPDATE;
  SELECT coalesce(sum(pp.valor),0) INTO utilizado FROM "PropostaUsoCredito" pp JOIN "DecisaoUsoCredito" dd ON dd."propostaId" = pp.id AND dd.aprovada WHERE pp."creditoId" = credito.id;
  IF EXISTS(SELECT 1 FROM "PropostaUsoCredito" WHERE "creditoId" = credito.id AND versao > p.versao) OR credito."matriculaId" IS DISTINCT FROM c."matriculaId" OR credito.moeda IS DISTINCT FROM c.moeda OR c.status NOT IN ('PENDENTE','ATRASADO') OR p.valor > credito."valorInicial" - utilizado OR p.valor > c."valorNegociado" - coalesce(c."valorRecebido",0) - c."valorLiquidadoCredito" OR c."suspensaPorItemPausaId" IS NOT NULL OR c."canceladaPorPausaId" IS NOT NULL OR EXISTS(SELECT 1 FROM "PagamentoInformado" WHERE "cobrancaId" = c.id AND status = 'A_CONFERIR') THEN RAISE EXCEPTION 'Utilização incompatível com versão, saldo, matrícula ou cobrança'; END IF;
  IF (p.snapshot->>'cobrancaVersao')::integer IS DISTINCT FROM c.versao OR (p.snapshot->>'valorCredito')::numeric IS DISTINCT FROM credito."valorInicial" - utilizado THEN RAISE EXCEPTION 'Confira novamente a proposta de crédito'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_decisao_uso_credito BEFORE INSERT ON "DecisaoUsoCredito" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_uso_credito();
CREATE FUNCTION proteger_saldo_credito_cobranca() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total numeric;
BEGIN
 SELECT coalesce(sum(p.valor),0) INTO total FROM "PropostaUsoCredito" p JOIN "DecisaoUsoCredito" d ON d."propostaId" = p.id AND d.aprovada WHERE p."cobrancaId" = NEW.id;
 IF NEW."valorLiquidadoCredito" IS DISTINCT FROM total OR (total > 0 AND NEW.saldo IS DISTINCT FROM greatest(0, NEW."valorNegociado" - coalesce(NEW."valorRecebido",0) - total)) THEN RAISE EXCEPTION 'Saldo da cobrança deve preservar utilizações de crédito aprovadas'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proteger_saldo_credito_cobranca BEFORE INSERT OR UPDATE ON "Cobranca" FOR EACH ROW EXECUTE FUNCTION proteger_saldo_credito_cobranca();
CREATE FUNCTION aplicar_uso_credito() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaUsoCredito"; c "Cobranca"; novo_total numeric; restante numeric;
BEGIN
 IF NEW.aprovada THEN
  SELECT * INTO p FROM "PropostaUsoCredito" WHERE id = NEW."propostaId";
  SELECT * INTO c FROM "Cobranca" WHERE id = p."cobrancaId" FOR UPDATE;
  SELECT coalesce(sum(pp.valor),0) INTO novo_total FROM "PropostaUsoCredito" pp JOIN "DecisaoUsoCredito" dd ON dd."propostaId" = pp.id AND dd.aprovada WHERE pp."cobrancaId" = c.id;
  restante := greatest(0, c."valorNegociado" - coalesce(c."valorRecebido",0) - novo_total);
  UPDATE "Cobranca" SET "valorLiquidadoCredito" = novo_total, saldo = restante, versao = versao + 1,
   status = CASE WHEN restante = 0 THEN 'PAGO'::"StatusCobranca" WHEN vencimento < CURRENT_TIMESTAMP THEN 'ATRASADO'::"StatusCobranca" ELSE 'PENDENTE'::"StatusCobranca" END,
   "pagoEm" = CASE WHEN restante = 0 THEN NEW."decididaEm" ELSE NULL END WHERE id = c.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_uso_credito AFTER INSERT ON "DecisaoUsoCredito" FOR EACH ROW EXECUTE FUNCTION aplicar_uso_credito();
