-- FASE 2 (doc 03): financeiro automatizado + B2B.
-- Gateway por DRIVER: Cobranca.gatewayRef (chave do webhook de conciliação — o driver
--   SIMULADO local usa a página /pagar/[token]; GreenPay/PIX/Boleto/Cartão são drivers
--   futuros no mesmo contrato). FormaPagamento ganha PIX e BOLETO.
-- B2B: Empresa (pagador corporativo) + FaturaB2B (fatura ÚNICA por empresa×competência,
--   agrupando as mensalidades dos colaboradores) + Matricula.empresaId.
-- ConfigFinanceiro: fechamento mensal de comissões automático (nasce desligado).

ALTER TYPE "FormaPagamento" ADD VALUE IF NOT EXISTS 'PIX';
ALTER TYPE "FormaPagamento" ADD VALUE IF NOT EXISTS 'BOLETO';

CREATE TYPE "StatusFaturaB2B" AS ENUM ('ABERTA', 'FECHADA', 'PAGA', 'CANCELADA');

CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "paisId" TEXT,
    "documento" TEXT,
    "contatoNome" TEXT,
    "contatoEmail" TEXT,
    "contatoTelefone" TEXT,
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Empresa_codigo_key" ON "Empresa"("codigo");

CREATE TABLE "FaturaB2B" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "empresaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "moeda" TEXT NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "status" "StatusFaturaB2B" NOT NULL DEFAULT 'ABERTA',
    "vencimento" TIMESTAMP(3) NOT NULL,
    "pagoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FaturaB2B_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FaturaB2B_codigo_key" ON "FaturaB2B"("codigo");
CREATE UNIQUE INDEX "FaturaB2B_empresaId_competencia_key" ON "FaturaB2B"("empresaId", "competencia");
ALTER TABLE "FaturaB2B" ADD CONSTRAINT "FaturaB2B_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Matricula" ADD COLUMN "empresaId" TEXT;
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Cobranca"
  ADD COLUMN "gatewayRef" TEXT,
  ADD COLUMN "faturaB2BId" TEXT;
CREATE UNIQUE INDEX "Cobranca_gatewayRef_key" ON "Cobranca"("gatewayRef");
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_faturaB2BId_fkey"
  FOREIGN KEY ("faturaB2BId") REFERENCES "FaturaB2B"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ConfigFinanceiro" (
    "id" TEXT NOT NULL DEFAULT 'financeiro',
    "fechamentoComissaoAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConfigFinanceiro_pkey" PRIMARY KEY ("id")
);
