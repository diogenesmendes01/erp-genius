-- Proteção lógica contra preços ativos duplicados (Issue #18).
-- Garante, no nível do banco, no máximo UM preço ATIVO por combinação de
-- negócio: país + produto + modalidade + tipo de cobrança.
-- Índice único parcial (só linhas com ativo = true entram na restrição),
-- mantendo o histórico de preços inativos sem conflito.

-- CreateIndex
CREATE UNIQUE INDEX "PrecoReferencia_ativo_unico_idx"
  ON "PrecoReferencia" ("paisId", "produtoId", "modalidadeId", "tipoCobranca")
  WHERE "ativo";
