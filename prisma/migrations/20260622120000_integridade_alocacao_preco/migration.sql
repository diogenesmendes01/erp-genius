-- Integridade de dados (issue #1): índices únicos PARCIAIS.
-- Prisma não modela "UNIQUE ... WHERE" em @@unique, então as constraints vivem aqui.

-- No máximo UMA alocação ATIVA por aluno (histórico ativa=false permanece livre).
CREATE UNIQUE INDEX "AlocacaoTurma_alunoId_ativa_key"
  ON "AlocacaoTurma" ("alunoId")
  WHERE "ativa";

-- Índices de apoio (consultas por aluno/turma).
CREATE INDEX "AlocacaoTurma_alunoId_idx" ON "AlocacaoTurma" ("alunoId");
CREATE INDEX "AlocacaoTurma_turmaId_idx" ON "AlocacaoTurma" ("turmaId");

-- No máximo UM preço ATIVO por país + produto + modalidade + tipoCobrança
-- (o histórico desativado por supersede permanece livre).
CREATE UNIQUE INDEX "PrecoReferencia_ativo_unico_key"
  ON "PrecoReferencia" ("paisId", "produtoId", "modalidadeId", "tipoCobranca")
  WHERE "ativo";
