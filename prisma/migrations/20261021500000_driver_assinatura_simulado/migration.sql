-- Driver SIMULADO de assinatura eletrônica (port da #62, Q155 ainda aberta).
--
-- 1. "Serviço" simulado: guarda os envelopes que o driver simulado "criou". Nada daqui saiu do ERP.
CREATE TABLE "EnvelopeAssinaturaSimulado" (
  "id" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "referenciaExterna" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "pdf" BYTEA NOT NULL,
  "pdfHash" TEXT NOT NULL,
  "signatarios" JSONB NOT NULL,
  "situacao" TEXT NOT NULL DEFAULT 'EM_ASSINATURA',
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnvelopeAssinaturaSimulado_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EnvelopeAssinaturaSimulado_situacao_check" CHECK ("situacao" IN ('EM_ASSINATURA', 'ASSINADO', 'CANCELADO', 'RECUSADO')),
  CONSTRAINT "EnvelopeAssinaturaSimulado_referencia_check" CHECK ("referenciaExterna" ~ '^sim_[a-f0-9]{24}$'),
  CONSTRAINT "EnvelopeAssinaturaSimulado_pdfHash_check" CHECK ("pdfHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "EnvelopeAssinaturaSimulado_chave_key" ON "EnvelopeAssinaturaSimulado"("chave");
CREATE UNIQUE INDEX "EnvelopeAssinaturaSimulado_referenciaExterna_key" ON "EnvelopeAssinaturaSimulado"("referenciaExterna");

-- 2. Processos: fornecedor SIMULADO passa a existir, e SÓ em SANDBOX. Os guards de efeito contratual
--    real (aceite integrado, condições e aplicação de aditivo, agenda) já exigem ambiente PRODUCAO, então
--    um processo simulado nunca produz efeito contratual real.
ALTER TABLE "ProcessoAssinaturaAditivo" DROP CONSTRAINT "ProcessoAssinaturaAditivo_fornecedor_check";
ALTER TABLE "ProcessoAssinaturaAditivo" ADD CONSTRAINT "ProcessoAssinaturaAditivo_fornecedor_check"
  CHECK (fornecedor IN ('ZAPSIGN', 'CLICKSIGN', 'DOCUSIGN', 'SIMULADO'));
ALTER TABLE "ProcessoAssinaturaAditivo" ADD CONSTRAINT "ProcessoAssinaturaAditivo_simulado_sandbox_check"
  CHECK (fornecedor <> 'SIMULADO' OR ambiente = 'SANDBOX');

-- O processo do contrato nunca teve CHECK de fornecedor (só o zod). NOT VALID: vale para toda linha nova ou
-- alterada sem reler o legado do UAT/produção; a base do processo é imutável por trigger.
ALTER TABLE "ProcessoAssinaturaContratual" ADD CONSTRAINT "ProcessoAssinaturaContratual_fornecedor_check"
  CHECK (fornecedor IN ('ZAPSIGN', 'CLICKSIGN', 'DOCUSIGN', 'SIMULADO')) NOT VALID;
ALTER TABLE "ProcessoAssinaturaContratual" ADD CONSTRAINT "ProcessoAssinaturaContratual_simulado_sandbox_check"
  CHECK (fornecedor <> 'SIMULADO' OR ambiente = 'SANDBOX') NOT VALID;

-- 3. Processo SIMULADO só aceita referência do simulado: nenhum retorno de fornecedor real é gravado nele.
ALTER TABLE "ProcessoAssinaturaAditivo" ADD CONSTRAINT "ProcessoAssinaturaAditivo_referencia_simulada_check"
  CHECK ("referenciaExterna" IS NULL OR fornecedor <> 'SIMULADO' OR "referenciaExterna" ~ '^sim_[a-f0-9]{24}$');
ALTER TABLE "ProcessoAssinaturaContratual" ADD CONSTRAINT "ProcessoAssinaturaContratual_referencia_simulada_check"
  CHECK ("referenciaExterna" IS NULL OR fornecedor <> 'SIMULADO' OR "referenciaExterna" ~ '^sim_[a-f0-9]{24}$') NOT VALID;
