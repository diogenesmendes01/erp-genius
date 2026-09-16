-- F07.7 / Q72--Q74: identidade própria do aluno. Nenhuma tabela abaixo usa
-- Usuario, papéis ou a sessão da equipe como credencial de portal.

ALTER TABLE "ConfiguracaoOperacional"
  ADD COLUMN IF NOT EXISTS "prazoSessaoPortalAlunoMinutos" INTEGER,
  ADD COLUMN IF NOT EXISTS "prazoConvitePortalAlunoMinutos" INTEGER,
  ADD COLUMN IF NOT EXISTS "prazoRecuperacaoPortalAlunoMinutos" INTEGER,
  ADD COLUMN IF NOT EXISTS "prazoValidacaoEmailPortalAlunoMinutos" INTEGER;

ALTER TABLE "ConfiguracaoOperacional"
  ADD CONSTRAINT "ConfiguracaoOperacional_prazos_portal_aluno_positivos"
  CHECK (
    ("prazoSessaoPortalAlunoMinutos" IS NULL OR "prazoSessaoPortalAlunoMinutos" > 0)
    AND ("prazoConvitePortalAlunoMinutos" IS NULL OR "prazoConvitePortalAlunoMinutos" > 0)
    AND ("prazoRecuperacaoPortalAlunoMinutos" IS NULL OR "prazoRecuperacaoPortalAlunoMinutos" > 0)
    AND ("prazoValidacaoEmailPortalAlunoMinutos" IS NULL OR "prazoValidacaoEmailPortalAlunoMinutos" > 0)
  );

CREATE TYPE "FinalidadeTokenPortalAluno" AS ENUM ('CONVITE', 'RECUPERACAO', 'VALIDAR_TROCA_EMAIL');
CREATE TYPE "SituacaoEnvioPortalAluno" AS ENUM ('PREPARADO', 'CANCELADO', 'ENVIADO', 'FALHOU', 'INCERTO');
CREATE TYPE "SituacaoTrocaEmailPortalAluno" AS ENUM ('PENDENTE_VALIDACAO', 'PENDENTE_DECISAO', 'APROVADA_APLICADA', 'REJEITADA', 'CANCELADA');

CREATE TABLE "ContaPortalAluno" (
  "id" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL,
  "emailVerificado" TEXT,
  "emailVerificadoEm" TIMESTAMP(3),
  "senhaHash" TEXT,
  "versaoSessao" INTEGER NOT NULL DEFAULT 1,
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContaPortalAluno_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContaPortalAluno_email_verificado_consistente" CHECK (("emailVerificado" IS NULL) = ("emailVerificadoEm" IS NULL)),
  CONSTRAINT "ContaPortalAluno_versao_sessao_positiva" CHECK ("versaoSessao" > 0)
);

CREATE UNIQUE INDEX "ContaPortalAluno_alunoId_key" ON "ContaPortalAluno"("alunoId");
CREATE UNIQUE INDEX "ContaPortalAluno_emailVerificado_lower_key" ON "ContaPortalAluno"(LOWER("emailVerificado")) WHERE "emailVerificado" IS NOT NULL;

CREATE TABLE "SessaoPortalAluno" (
  "id" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "contaId" TEXT NOT NULL,
  "versaoConta" INTEGER NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "revogadaEm" TIMESTAMP(3),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimoUsoEm" TIMESTAMP(3),
  CONSTRAINT "SessaoPortalAluno_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessaoPortalAluno_digest_key" UNIQUE ("digest"),
  CONSTRAINT "SessaoPortalAluno_expira_depois_criacao" CHECK ("expiraEm" > "criadaEm")
);
CREATE INDEX "SessaoPortalAluno_contaId_expiraEm_idx" ON "SessaoPortalAluno"("contaId", "expiraEm");

CREATE TABLE "TentativaAutenticacaoPortalAluno" (
  "chaveDigest" TEXT NOT NULL,
  falhas INTEGER NOT NULL,
  "janelaIniciadaEm" TIMESTAMP(3) NOT NULL,
  "bloqueadaAte" TIMESTAMP(3),
  "atualizadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TentativaAutenticacaoPortalAluno_pkey" PRIMARY KEY ("chaveDigest"),
  CONSTRAINT "TentativaAutenticacaoPortalAluno_falhas_positivas" CHECK (falhas >= 0)
);

CREATE TABLE "SolicitacaoTrocaEmailPortalAluno" (
  "id" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL,
  "contaId" TEXT NOT NULL,
  "emailAnterior" TEXT,
  "novoEmail" TEXT NOT NULL,
  "novoEmailVerificadoEm" TIMESTAMP(3),
  "versaoContaConferida" INTEGER NOT NULL,
  "motivo" TEXT NOT NULL,
  "evidencia" TEXT NOT NULL,
  "preparadorId" TEXT NOT NULL,
  "situacao" "SituacaoTrocaEmailPortalAluno" NOT NULL DEFAULT 'PENDENTE_VALIDACAO',
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decididaEm" TIMESTAMP(3),
  CONSTRAINT "SolicitacaoTrocaEmailPortalAluno_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SolicitacaoTrocaEmailPortalAluno_versao_positiva" CHECK ("versaoContaConferida" > 0),
  CONSTRAINT "SolicitacaoTrocaEmailPortalAluno_decisao_consistente" CHECK (
    ("situacao" IN ('APROVADA_APLICADA', 'REJEITADA', 'CANCELADA')) = ("decididaEm" IS NOT NULL)
  )
);
CREATE INDEX "SolicitacaoTrocaEmailPortalAluno_aluno_situacao_idx" ON "SolicitacaoTrocaEmailPortalAluno"("alunoId", "situacao", "criadaEm");
CREATE UNIQUE INDEX "SolicitacaoTrocaEmailPortalAluno_pendente_unica" ON "SolicitacaoTrocaEmailPortalAluno"("contaId") WHERE "situacao" IN ('PENDENTE_VALIDACAO', 'PENDENTE_DECISAO');

CREATE TABLE "TokenPortalAluno" (
  "id" TEXT NOT NULL,
  "contaId" TEXT NOT NULL,
  "finalidade" "FinalidadeTokenPortalAluno" NOT NULL,
  "digest" TEXT NOT NULL,
  "destinatario" TEXT NOT NULL,
  "trocaEmailId" TEXT,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "consumidoEm" TIMESTAMP(3),
  "revogadoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TokenPortalAluno_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TokenPortalAluno_digest_key" UNIQUE ("digest"),
  CONSTRAINT "TokenPortalAluno_expira_depois_criacao" CHECK ("expiraEm" > "criadoEm"),
  CONSTRAINT "TokenPortalAluno_troca_finalidade_consistente" CHECK (
    ("finalidade" = 'VALIDAR_TROCA_EMAIL') = ("trocaEmailId" IS NOT NULL)
  )
);
CREATE INDEX "TokenPortalAluno_conta_finalidade_expira_idx" ON "TokenPortalAluno"("contaId", "finalidade", "expiraEm");

CREATE TABLE "SolicitacaoEnvioPortalAluno" (
  "id" TEXT NOT NULL,
  "contaId" TEXT NOT NULL,
  "finalidade" "FinalidadeTokenPortalAluno" NOT NULL,
  "destinatario" TEXT NOT NULL,
  "trocaEmailId" TEXT,
  "situacao" "SituacaoEnvioPortalAluno" NOT NULL DEFAULT 'PREPARADO',
  "chave" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SolicitacaoEnvioPortalAluno_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SolicitacaoEnvioPortalAluno_chave_key" UNIQUE ("chave"),
  CONSTRAINT "SolicitacaoEnvioPortalAluno_troca_finalidade_consistente" CHECK (
    ("finalidade" = 'VALIDAR_TROCA_EMAIL') = ("trocaEmailId" IS NOT NULL)
  )
);
CREATE INDEX "SolicitacaoEnvioPortalAluno_situacao_criada_idx" ON "SolicitacaoEnvioPortalAluno"("situacao", "criadoEm");

CREATE TABLE "DecisaoTrocaEmailPortalAluno" (
  "id" TEXT NOT NULL,
  "solicitacaoId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoTrocaEmailPortalAluno_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisaoTrocaEmailPortalAluno_solicitacaoId_key" UNIQUE ("solicitacaoId")
);

ALTER TABLE "ContaPortalAluno" ADD CONSTRAINT "ContaPortalAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SessaoPortalAluno" ADD CONSTRAINT "SessaoPortalAluno_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoTrocaEmailPortalAluno" ADD CONSTRAINT "SolicitacaoTrocaEmailPortalAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoTrocaEmailPortalAluno" ADD CONSTRAINT "SolicitacaoTrocaEmailPortalAluno_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoTrocaEmailPortalAluno" ADD CONSTRAINT "SolicitacaoTrocaEmailPortalAluno_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenPortalAluno" ADD CONSTRAINT "TokenPortalAluno_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenPortalAluno" ADD CONSTRAINT "TokenPortalAluno_trocaEmailId_fkey" FOREIGN KEY ("trocaEmailId") REFERENCES "SolicitacaoTrocaEmailPortalAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoEnvioPortalAluno" ADD CONSTRAINT "SolicitacaoEnvioPortalAluno_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoEnvioPortalAluno" ADD CONSTRAINT "SolicitacaoEnvioPortalAluno_trocaEmailId_fkey" FOREIGN KEY ("trocaEmailId") REFERENCES "SolicitacaoTrocaEmailPortalAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisaoTrocaEmailPortalAluno" ADD CONSTRAINT "DecisaoTrocaEmailPortalAluno_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoTrocaEmailPortalAluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisaoTrocaEmailPortalAluno" ADD CONSTRAINT "DecisaoTrocaEmailPortalAluno_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tokens só podem ser consumidos ou revogados uma vez. Digest, conta, prazo e
-- destinatário são imutáveis, impedindo reutilizar um link para outra conta.
CREATE OR REPLACE FUNCTION "proteger_token_portal_aluno"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TokenPortalAluno é histórico e não pode ser removido';
  END IF;
  IF NEW."id" <> OLD."id"
    OR NEW."contaId" <> OLD."contaId"
    OR NEW."finalidade" <> OLD."finalidade"
    OR NEW."digest" <> OLD."digest"
    OR NEW."destinatario" <> OLD."destinatario"
    OR NEW."trocaEmailId" IS DISTINCT FROM OLD."trocaEmailId"
    OR NEW."expiraEm" <> OLD."expiraEm"
    OR NEW."criadoEm" <> OLD."criadoEm"
    OR (OLD."consumidoEm" IS NOT NULL AND NEW."consumidoEm" IS DISTINCT FROM OLD."consumidoEm")
    OR (OLD."revogadoEm" IS NOT NULL AND NEW."revogadoEm" IS DISTINCT FROM OLD."revogadoEm") THEN
    RAISE EXCEPTION 'TokenPortalAluno imutável';
  END IF;
  IF NEW."consumidoEm" IS NOT NULL AND NEW."consumidoEm" < OLD."criadoEm"
    OR NEW."consumidoEm" IS NOT NULL AND NEW."consumidoEm" > NEW."expiraEm"
    OR NEW."revogadoEm" IS NOT NULL AND NEW."revogadoEm" < OLD."criadoEm" THEN
    RAISE EXCEPTION 'Momento de token inválido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TokenPortalAluno_proteger"
  BEFORE UPDATE OR DELETE ON "TokenPortalAluno"
  FOR EACH ROW EXECUTE FUNCTION "proteger_token_portal_aluno"();

CREATE OR REPLACE FUNCTION "proteger_decisao_troca_email_portal_aluno"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DecisaoTrocaEmailPortalAluno é imutável';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DecisaoTrocaEmailPortalAluno_proteger"
  BEFORE UPDATE OR DELETE ON "DecisaoTrocaEmailPortalAluno"
  FOR EACH ROW EXECUTE FUNCTION "proteger_decisao_troca_email_portal_aluno"();

-- A decisão só nasce de outra pessoa da Administração, para a solicitação
-- ainda conferida. Rejeição continua possível para encerrar a pendência que
-- se tornou obsoleta; aprovação exige a conferência completa abaixo.
CREATE OR REPLACE FUNCTION "validar_decisao_troca_email_portal_aluno"() RETURNS TRIGGER AS $$
DECLARE
  decisor_valido BOOLEAN;
  solicitacao_valida BOOLEAN;
BEGIN
  SELECT u.ativo AND u.papeis @> ARRAY['ADMINISTRADOR']::"Papel"[]
    INTO decisor_valido FROM "Usuario" u WHERE u.id = NEW."decisorId";
  IF decisor_valido IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Decisor da troca de e-mail do portal precisa ser administrador ativo';
  END IF;
  SELECT s."preparadorId" <> NEW."decisorId"
    AND s.situacao = 'PENDENTE_DECISAO'
    INTO solicitacao_valida
  FROM "SolicitacaoTrocaEmailPortalAluno" s
  WHERE s.id = NEW."solicitacaoId";
  IF solicitacao_valida IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Decisão de troca de e-mail inválida ou autoaprovada';
  END IF;
  IF NEW.aprovada THEN
    SELECT s."novoEmailVerificadoEm" IS NOT NULL
      AND c.ativa
      AND c."versaoSessao" = s."versaoContaConferida"
      AND c."emailVerificado" IS NOT DISTINCT FROM s."emailAnterior"
      INTO solicitacao_valida
    FROM "SolicitacaoTrocaEmailPortalAluno" s
    JOIN "ContaPortalAluno" c ON c.id = s."contaId"
    WHERE s.id = NEW."solicitacaoId";
    IF solicitacao_valida IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Aprovação da troca de e-mail exige conta e endereço conferidos';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DecisaoTrocaEmailPortalAluno_validar"
  BEFORE INSERT ON "DecisaoTrocaEmailPortalAluno"
  FOR EACH ROW EXECUTE FUNCTION "validar_decisao_troca_email_portal_aluno"();

-- Alterar o e-mail de identidade não acompanha edição cadastral comum. Só o
-- convite consumido inicial ou uma solicitação aprovada pode fazê-lo.
CREATE OR REPLACE FUNCTION "proteger_email_conta_portal_aluno"() RETURNS TRIGGER AS $$
DECLARE
  permitido BOOLEAN;
BEGIN
  IF NEW."emailVerificado" IS NOT DISTINCT FROM OLD."emailVerificado" THEN
    RETURN NEW;
  END IF;
  IF OLD."emailVerificado" IS NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "TokenPortalAluno" t
      WHERE t."contaId" = OLD.id AND t.finalidade = 'CONVITE'
        AND t."consumidoEm" IS NOT NULL AND t.destinatario = NEW."emailVerificado"
    ) INTO permitido;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM "SolicitacaoTrocaEmailPortalAluno" s
      JOIN "DecisaoTrocaEmailPortalAluno" d ON d."solicitacaoId" = s.id AND d.aprovada = true
      WHERE s."contaId" = OLD.id AND s.situacao = 'APROVADA_APLICADA'
        AND s."emailAnterior" IS NOT DISTINCT FROM OLD."emailVerificado"
        AND s."novoEmail" = NEW."emailVerificado"
        AND s."versaoContaConferida" = OLD."versaoSessao"
    ) INTO permitido;
  END IF;
  IF permitido IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'E-mail verificado da conta do portal só muda por fluxo autorizado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ContaPortalAluno_proteger_email"
  BEFORE UPDATE OF "emailVerificado" ON "ContaPortalAluno"
  FOR EACH ROW EXECUTE FUNCTION "proteger_email_conta_portal_aluno"();
