-- 148: conciliação humana de resultado INCERTO e decisão independente de reemissão.
CREATE TYPE "ResultadoConciliacaoEnvioPortalAluno" AS ENUM ('SEM_COMPROVACAO');

CREATE TABLE "ConciliacaoEnvioPortalAluno" (
  id TEXT NOT NULL,
  "solicitacaoId" TEXT NOT NULL,
  "secretariaId" TEXT NOT NULL,
  resultado "ResultadoConciliacaoEnvioPortalAluno" NOT NULL DEFAULT 'SEM_COMPROVACAO',
  evidencia TEXT NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConciliacaoEnvioPortalAluno_pkey" PRIMARY KEY (id),
  CONSTRAINT "ConciliacaoEnvioPortalAluno_solicitacaoId_key" UNIQUE ("solicitacaoId"),
  CONSTRAINT "ConciliacaoEnvioPortalAluno_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoEnvioPortalAluno"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ConciliacaoEnvioPortalAluno_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ConciliacaoEnvioPortalAluno_evidencia_tamanho" CHECK (char_length(btrim(evidencia)) BETWEEN 5 AND 4000),
  CONSTRAINT "ConciliacaoEnvioPortalAluno_hash_formato" CHECK ("estadoHash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "DecisaoReemissaoEnvioPortalAluno" (
  id TEXT NOT NULL,
  "conciliacaoId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "solicitacaoReemitidaId" TEXT,
  "decididaEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoReemissaoEnvioPortalAluno_pkey" PRIMARY KEY (id),
  CONSTRAINT "DecisaoReemissaoEnvioPortalAluno_conciliacaoId_key" UNIQUE ("conciliacaoId"),
  CONSTRAINT "DecisaoReemissaoEnvioPortalAluno_solicitacaoReemitidaId_key" UNIQUE ("solicitacaoReemitidaId"),
  CONSTRAINT "DecisaoReemissaoEnvioPortalAluno_conciliacaoId_fkey" FOREIGN KEY ("conciliacaoId") REFERENCES "ConciliacaoEnvioPortalAluno"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DecisaoReemissaoEnvioPortalAluno_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DecisaoReemissaoEnvioPortalAluno_solicitacaoReemitidaId_fkey" FOREIGN KEY ("solicitacaoReemitidaId") REFERENCES "SolicitacaoEnvioPortalAluno"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DecisaoReemissaoEnvioPortalAluno_motivo_tamanho" CHECK (char_length(btrim(motivo)) BETWEEN 5 AND 4000),
  CONSTRAINT "DecisaoReemissaoEnvioPortalAluno_hash_formato" CHECK ("estadoHash" ~ '^[a-f0-9]{64}$')
);

CREATE OR REPLACE FUNCTION "proteger_conciliacao_envio_portal_aluno"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Conciliação de envio é imutável';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ConciliacaoEnvioPortalAluno_imutavel" BEFORE UPDATE OR DELETE ON "ConciliacaoEnvioPortalAluno" FOR EACH ROW EXECUTE FUNCTION "proteger_conciliacao_envio_portal_aluno"();
CREATE OR REPLACE FUNCTION "proteger_decisao_reemissao_envio_portal_aluno"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."solicitacaoReemitidaId" IS DISTINCT FROM OLD."solicitacaoReemitidaId"
    AND OLD."solicitacaoReemitidaId" IS NULL AND NEW."solicitacaoReemitidaId" IS NOT NULL
    AND NEW.id = OLD.id AND NEW."conciliacaoId" = OLD."conciliacaoId" AND NEW."decisorId" = OLD."decisorId"
    AND NEW.aprovada = OLD.aprovada AND NEW.motivo = OLD.motivo AND NEW."estadoHash" = OLD."estadoHash" THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Decisão de reemissão é imutável';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DecisaoReemissaoEnvioPortalAluno_imutavel" BEFORE UPDATE OR DELETE ON "DecisaoReemissaoEnvioPortalAluno" FOR EACH ROW EXECUTE FUNCTION "proteger_decisao_reemissao_envio_portal_aluno"();