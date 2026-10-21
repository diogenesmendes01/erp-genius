-- Uma realização de segunda chamada pode ter versões sucessivas da mesma nota
-- original. A realização continua única; cada versão conserva o vínculo dela.
DROP INDEX "VersaoLancamentoAvaliacao_segundaChamadaRealizacaoId_key";
CREATE INDEX "VersaoLancamentoAvaliacao_segundaChamadaRealizacaoId_idx"
  ON "VersaoLancamentoAvaliacao"("segundaChamadaRealizacaoId");
