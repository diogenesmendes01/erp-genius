-- Mantém o limite de motivo da decisão alinhado ao formulário e à action.
ALTER TABLE "DecisaoResolucaoRevisaoProgressao"
  DROP CONSTRAINT "DecisaoResolucaoRevisaoProgressao_motivo_tamanho_check",
  ADD CONSTRAINT "DecisaoResolucaoRevisaoProgressao_motivo_tamanho_check"
    CHECK (length(btrim("motivo")) BETWEEN 5 AND 3000);
