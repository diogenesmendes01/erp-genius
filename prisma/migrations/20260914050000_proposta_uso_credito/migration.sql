-- CreateTable
CREATE TABLE "PropostaUsoCredito" (
    "id" TEXT NOT NULL,
    "creditoId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "concordancia" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaUsoCredito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaUsoCredito_cobrancaId_idx" ON "PropostaUsoCredito"("cobrancaId");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaUsoCredito_creditoId_versao_key" ON "PropostaUsoCredito"("creditoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaUsoCredito_preparadorId_chaveIdempotencia_key" ON "PropostaUsoCredito"("preparadorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "PropostaUsoCredito" ADD CONSTRAINT "PropostaUsoCredito_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "CreditoMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaUsoCredito" ADD CONSTRAINT "PropostaUsoCredito_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaUsoCredito" ADD CONSTRAINT "PropostaUsoCredito_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaUsoCredito" ADD CHECK (valor > 0 AND versao > 0 AND length(btrim(concordancia)) >= 5 AND length(btrim(motivo)) >= 5);
CREATE TRIGGER preservar_proposta_uso_credito BEFORE UPDATE OR DELETE ON "PropostaUsoCredito" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_proposta_uso_credito() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE credito "CreditoMatricula"; cobranca "Cobranca"; autorizado boolean;
BEGIN
 SELECT ativo AND papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[] INTO autorizado FROM "Usuario" WHERE id = NEW."preparadorId" FOR SHARE;
 SELECT * INTO credito FROM "CreditoMatricula" WHERE id = NEW."creditoId" FOR SHARE;
 SELECT * INTO cobranca FROM "Cobranca" WHERE id = NEW."cobrancaId" FOR SHARE;
 IF autorizado IS DISTINCT FROM true OR credito."matriculaId" IS DISTINCT FROM cobranca."matriculaId" OR credito.moeda IS DISTINCT FROM cobranca.moeda OR NEW.valor > credito."valorInicial" OR NEW.valor > greatest(0, cobranca."valorNegociado" - coalesce(cobranca."valorRecebido",0)) OR cobranca.status NOT IN ('PENDENTE','ATRASADO') OR cobranca."suspensaPorItemPausaId" IS NOT NULL OR cobranca."canceladaPorPausaId" IS NOT NULL THEN RAISE EXCEPTION 'Proposta de crédito incompatível com autor, matrícula, moeda ou saldo'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_proposta_uso_credito BEFORE INSERT ON "PropostaUsoCredito" FOR EACH ROW EXECUTE FUNCTION conferir_proposta_uso_credito();
