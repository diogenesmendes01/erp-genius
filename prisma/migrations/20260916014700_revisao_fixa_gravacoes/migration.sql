-- 147: revisão binária fixa e cadeia de regularização de gravações.
-- Legado permanece sem revisão; nunca é preenchido pela cabeça atual do Drive.
CREATE TYPE "AlvoRegularizacaoFonteGravacao" AS ENUM ('PUBLICACAO_AULA', 'MATERIAL_REPOSICAO');

ALTER TABLE "PublicacaoGravacaoAula"
  ADD COLUMN "driveRevisionId" TEXT,
  ADD COLUMN "driveRevisionMd5" TEXT,
  ADD COLUMN "driveRevisionSize" BIGINT,
  ADD CONSTRAINT "PublicacaoGravacaoAula_revisao_conjunto_check"
    CHECK (("driveRevisionId" IS NULL AND "driveRevisionMd5" IS NULL AND "driveRevisionSize" IS NULL)
      OR ("driveRevisionId" IS NOT NULL AND "driveRevisionMd5" IS NOT NULL AND "driveRevisionSize" IS NOT NULL));

ALTER TABLE "MaterialReposicaoGravacao"
  ADD COLUMN "driveOrganizacaoId" TEXT,
  ADD COLUMN "driveRevisionId" TEXT,
  ADD COLUMN "driveRevisionMd5" TEXT,
  ADD COLUMN "driveRevisionSize" BIGINT,
  ADD COLUMN "mimeType" TEXT,
  ADD CONSTRAINT "MaterialReposicaoGravacao_revisao_conjunto_check"
    CHECK (("driveOrganizacaoId" IS NULL AND "driveRevisionId" IS NULL AND "driveRevisionMd5" IS NULL AND "driveRevisionSize" IS NULL AND "mimeType" IS NULL)
      OR ("driveOrganizacaoId" IS NOT NULL AND "driveRevisionId" IS NOT NULL AND "driveRevisionMd5" IS NOT NULL AND "driveRevisionSize" IS NOT NULL AND "mimeType" IS NOT NULL));

CREATE TABLE "PropostaRegularizacaoFonteGravacao" (
  id TEXT NOT NULL, alvo "AlvoRegularizacaoFonteGravacao" NOT NULL,
  "publicacaoAulaId" TEXT, "materialReposicaoId" TEXT, "versaoEsperada" INTEGER NOT NULL,
  "arquivoOficialId" TEXT NOT NULL, "driveOrganizacaoId" TEXT NOT NULL,
  "driveRevisionId" TEXT NOT NULL, "driveRevisionMd5" TEXT NOT NULL,
  "driveRevisionSize" BIGINT NOT NULL, "mimeType" TEXT NOT NULL,
  motivo TEXT NOT NULL, "preparadorId" TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  CONSTRAINT "PropostaRegularizacaoFonteGravacao_pkey" PRIMARY KEY (id),
  CONSTRAINT "PropostaRegularizacaoFonteGravacao_alvo_check" CHECK (
    (alvo = 'PUBLICACAO_AULA' AND "publicacaoAulaId" IS NOT NULL AND "materialReposicaoId" IS NULL)
    OR (alvo = 'MATERIAL_REPOSICAO' AND "publicacaoAulaId" IS NULL AND "materialReposicaoId" IS NOT NULL)),
  CONSTRAINT "PropostaRegularizacaoFonteGravacao_fonte_check" CHECK (
    length("arquivoOficialId") BETWEEN 3 AND 500 AND "arquivoOficialId" ~ '^[A-Za-z0-9_-]+$'
    AND length("driveOrganizacaoId") BETWEEN 3 AND 500 AND "driveOrganizacaoId" ~ '^[A-Za-z0-9_-]+$'
    AND length("driveRevisionId") BETWEEN 3 AND 500 AND "driveRevisionId" ~ '^[A-Za-z0-9_-]+$'
    AND "driveRevisionMd5" ~* '^[a-f0-9]{32}$' AND "driveRevisionSize" > 0
    AND "mimeType" ~* '^video/[A-Za-z0-9][A-Za-z0-9.!#$&^_+-]*$'
  )
);
CREATE UNIQUE INDEX "PropostaRegularizacaoFonteGravacao_preparador_chave_key" ON "PropostaRegularizacaoFonteGravacao"("preparadorId", "chaveIdempotencia");
CREATE INDEX "PropostaRegularizacaoFonteGravacao_publicacao_idx" ON "PropostaRegularizacaoFonteGravacao"("publicacaoAulaId", "criadaEm");
CREATE INDEX "PropostaRegularizacaoFonteGravacao_material_idx" ON "PropostaRegularizacaoFonteGravacao"("materialReposicaoId", "criadaEm");

CREATE TABLE "DecisaoRegularizacaoFonteGravacao" (
  id TEXT NOT NULL, "propostaId" TEXT NOT NULL, "decisorId" TEXT NOT NULL,
  aprovada BOOLEAN NOT NULL, motivo TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  CONSTRAINT "DecisaoRegularizacaoFonteGravacao_pkey" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX "DecisaoRegularizacaoFonteGravacao_propostaId_key" ON "DecisaoRegularizacaoFonteGravacao"("propostaId");

CREATE TABLE "FonteRevisaoGravacao" (
  id TEXT NOT NULL, alvo "AlvoRegularizacaoFonteGravacao" NOT NULL,
  "publicacaoAulaId" TEXT, "materialReposicaoId" TEXT, versao INTEGER NOT NULL,
  "arquivoOficialId" TEXT NOT NULL, "driveOrganizacaoId" TEXT NOT NULL,
  "driveRevisionId" TEXT NOT NULL, "driveRevisionMd5" TEXT NOT NULL,
  "driveRevisionSize" BIGINT NOT NULL, "mimeType" TEXT NOT NULL, "propostaId" TEXT,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  CONSTRAINT "FonteRevisaoGravacao_pkey" PRIMARY KEY (id),
  CONSTRAINT "FonteRevisaoGravacao_alvo_check" CHECK (
    (alvo = 'PUBLICACAO_AULA' AND "publicacaoAulaId" IS NOT NULL AND "materialReposicaoId" IS NULL)
    OR (alvo = 'MATERIAL_REPOSICAO' AND "publicacaoAulaId" IS NULL AND "materialReposicaoId" IS NOT NULL)),
  CONSTRAINT "FonteRevisaoGravacao_fonte_check" CHECK (
    versao > 0 AND length("arquivoOficialId") BETWEEN 3 AND 500 AND "arquivoOficialId" ~ '^[A-Za-z0-9_-]+$'
    AND length("driveOrganizacaoId") BETWEEN 3 AND 500 AND "driveOrganizacaoId" ~ '^[A-Za-z0-9_-]+$'
    AND length("driveRevisionId") BETWEEN 3 AND 500 AND "driveRevisionId" ~ '^[A-Za-z0-9_-]+$'
    AND "driveRevisionMd5" ~* '^[a-f0-9]{32}$' AND "driveRevisionSize" > 0
    AND "mimeType" ~* '^video/[A-Za-z0-9][A-Za-z0-9.!#$&^_+-]*$'
  )
);
CREATE UNIQUE INDEX "FonteRevisaoGravacao_publicacao_versao_key" ON "FonteRevisaoGravacao"("publicacaoAulaId", versao);
CREATE UNIQUE INDEX "FonteRevisaoGravacao_material_versao_key" ON "FonteRevisaoGravacao"("materialReposicaoId", versao);
CREATE UNIQUE INDEX "FonteRevisaoGravacao_propostaId_key" ON "FonteRevisaoGravacao"("propostaId");
CREATE INDEX "FonteRevisaoGravacao_publicacao_versao_idx" ON "FonteRevisaoGravacao"("publicacaoAulaId", versao);
CREATE INDEX "FonteRevisaoGravacao_material_versao_idx" ON "FonteRevisaoGravacao"("materialReposicaoId", versao);

ALTER TABLE "PropostaRegularizacaoFonteGravacao"
  ADD CONSTRAINT "PropostaRegularizacaoFonteGravacao_publicacaoAulaId_fkey" FOREIGN KEY ("publicacaoAulaId") REFERENCES "PublicacaoGravacaoAula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PropostaRegularizacaoFonteGravacao_materialReposicaoId_fkey" FOREIGN KEY ("materialReposicaoId") REFERENCES "MaterialReposicaoGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PropostaRegularizacaoFonteGravacao_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoRegularizacaoFonteGravacao"
  ADD CONSTRAINT "DecisaoRegularizacaoFonteGravacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaRegularizacaoFonteGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "DecisaoRegularizacaoFonteGravacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "FonteRevisaoGravacao"
  ADD CONSTRAINT "FonteRevisaoGravacao_publicacaoAulaId_fkey" FOREIGN KEY ("publicacaoAulaId") REFERENCES "PublicacaoGravacaoAula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "FonteRevisaoGravacao_materialReposicaoId_fkey" FOREIGN KEY ("materialReposicaoId") REFERENCES "MaterialReposicaoGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "FonteRevisaoGravacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaRegularizacaoFonteGravacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION validar_fonte_revisao_gravacao_147() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaRegularizacaoFonteGravacao"%ROWTYPE;
DECLARE decisao "DecisaoRegularizacaoFonteGravacao"%ROWTYPE;
DECLARE ultimo INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Fontes de revisão são imutáveis'; END IF;
  -- Serializa a cadeia pelo alvo. Um agregado vazio não pode ser bloqueado com
  -- FOR UPDATE na própria fonte, pois duas primeiras versões concorrentes então
  -- observariam ambas versao 0.
  IF NEW.alvo = 'PUBLICACAO_AULA' THEN
    PERFORM 1 FROM "PublicacaoGravacaoAula" WHERE id = NEW."publicacaoAulaId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Publicação da fonte não encontrada'; END IF;
  ELSE
    PERFORM 1 FROM "MaterialReposicaoGravacao" WHERE id = NEW."materialReposicaoId" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Material da fonte não encontrado'; END IF;
  END IF;
  SELECT COALESCE(MAX(versao), 0) INTO ultimo FROM "FonteRevisaoGravacao"
    WHERE "publicacaoAulaId" IS NOT DISTINCT FROM NEW."publicacaoAulaId"
      AND "materialReposicaoId" IS NOT DISTINCT FROM NEW."materialReposicaoId";
  IF NEW.versao IS DISTINCT FROM ultimo + 1 THEN RAISE EXCEPTION 'A fonte exige a próxima versão sequencial'; END IF;
  IF NEW."propostaId" IS NULL THEN
    IF NEW.versao <> 1 THEN RAISE EXCEPTION 'Somente a fonte original pode não ter aprovação'; END IF;
    IF NEW.alvo = 'PUBLICACAO_AULA' AND NOT EXISTS (SELECT 1 FROM "PublicacaoGravacaoAula" p WHERE p.id=NEW."publicacaoAulaId" AND p."arquivoOficialId"=NEW."arquivoOficialId" AND p."driveOrganizacaoId"=NEW."driveOrganizacaoId" AND p."driveRevisionId"=NEW."driveRevisionId" AND p."driveRevisionMd5"=NEW."driveRevisionMd5" AND p."driveRevisionSize"=NEW."driveRevisionSize" AND p."mimeType"=NEW."mimeType") THEN RAISE EXCEPTION 'Fonte original não corresponde à publicação'; END IF;
    IF NEW.alvo = 'MATERIAL_REPOSICAO' AND NOT EXISTS (SELECT 1 FROM "MaterialReposicaoGravacao" m WHERE m.id=NEW."materialReposicaoId" AND m."arquivoOficialId" IS NOT DISTINCT FROM NEW."arquivoOficialId" AND m."driveOrganizacaoId" IS NOT DISTINCT FROM NEW."driveOrganizacaoId" AND m."driveRevisionId" IS NOT DISTINCT FROM NEW."driveRevisionId" AND m."driveRevisionMd5" IS NOT DISTINCT FROM NEW."driveRevisionMd5" AND m."driveRevisionSize" IS NOT DISTINCT FROM NEW."driveRevisionSize" AND m."mimeType" IS NOT DISTINCT FROM NEW."mimeType") THEN RAISE EXCEPTION 'Fonte original não corresponde ao material'; END IF;
    IF NEW.alvo = 'MATERIAL_REPOSICAO' AND NOT EXISTS (
      SELECT 1 FROM "MaterialReposicaoGravacao" m
      JOIN LATERAL (
        SELECT f."arquivoOficialId", f."driveOrganizacaoId", f."driveRevisionId", f."driveRevisionMd5", f."driveRevisionSize", f."mimeType"
        FROM "FonteRevisaoGravacao" f
        WHERE f."publicacaoAulaId" = m."publicacaoAulaId"
        ORDER BY f.versao DESC LIMIT 1
      ) origem ON TRUE
      WHERE m.id = NEW."materialReposicaoId" AND m."publicacaoAulaId" IS NOT NULL
        AND origem."arquivoOficialId" IS NOT DISTINCT FROM NEW."arquivoOficialId"
        AND origem."driveOrganizacaoId" IS NOT DISTINCT FROM NEW."driveOrganizacaoId"
        AND origem."driveRevisionId" IS NOT DISTINCT FROM NEW."driveRevisionId"
        AND origem."driveRevisionMd5" IS NOT DISTINCT FROM NEW."driveRevisionMd5"
        AND origem."driveRevisionSize" IS NOT DISTINCT FROM NEW."driveRevisionSize"
        AND origem."mimeType" IS NOT DISTINCT FROM NEW."mimeType"
    ) AND EXISTS (SELECT 1 FROM "MaterialReposicaoGravacao" WHERE id = NEW."materialReposicaoId" AND "publicacaoAulaId" IS NOT NULL) THEN RAISE EXCEPTION 'Fonte derivada não corresponde à publicação'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO proposta FROM "PropostaRegularizacaoFonteGravacao" WHERE id=NEW."propostaId" FOR SHARE;
  SELECT * INTO decisao FROM "DecisaoRegularizacaoFonteGravacao" WHERE "propostaId"=NEW."propostaId" AND aprovada FOR SHARE;
  IF NOT FOUND OR proposta.alvo IS DISTINCT FROM NEW.alvo OR proposta."publicacaoAulaId" IS DISTINCT FROM NEW."publicacaoAulaId" OR proposta."materialReposicaoId" IS DISTINCT FROM NEW."materialReposicaoId" OR proposta."versaoEsperada" IS DISTINCT FROM ultimo OR proposta."arquivoOficialId" IS DISTINCT FROM NEW."arquivoOficialId" OR proposta."driveOrganizacaoId" IS DISTINCT FROM NEW."driveOrganizacaoId" OR proposta."driveRevisionId" IS DISTINCT FROM NEW."driveRevisionId" OR proposta."driveRevisionMd5" IS DISTINCT FROM NEW."driveRevisionMd5" OR proposta."driveRevisionSize" IS DISTINCT FROM NEW."driveRevisionSize" OR proposta."mimeType" IS DISTINCT FROM NEW."mimeType" THEN RAISE EXCEPTION 'Fonte substituta exige proposta aprovada e ainda atual'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "FonteRevisaoGravacao_validar_147" BEFORE INSERT OR UPDATE OR DELETE ON "FonteRevisaoGravacao" FOR EACH ROW EXECUTE FUNCTION validar_fonte_revisao_gravacao_147();

CREATE OR REPLACE FUNCTION validar_decisao_regularizacao_fonte_gravacao_147() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisões de regularização são imutáveis'; END IF;
  IF EXISTS (
    SELECT 1 FROM "PropostaRegularizacaoFonteGravacao" p
    WHERE p.id = NEW."propostaId" AND p."preparadorId" = NEW."decisorId"
  ) THEN RAISE EXCEPTION 'Outra pessoa deve decidir a regularização'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Usuario" u
    WHERE u.id = NEW."decisorId" AND u.ativo
      AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(u.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(u.papeis))
  ) THEN RAISE EXCEPTION 'Decisor sem papel de gestão ativo'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "DecisaoRegularizacaoFonteGravacao_validar_147"
  BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoRegularizacaoFonteGravacao"
  FOR EACH ROW EXECUTE FUNCTION validar_decisao_regularizacao_fonte_gravacao_147();

CREATE OR REPLACE FUNCTION preservar_proposta_regularizacao_fonte_gravacao_147() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Propostas de regularização são imutáveis'; END; $$;
CREATE TRIGGER "PropostaRegularizacaoFonteGravacao_imutavel_147"
  BEFORE UPDATE OR DELETE ON "PropostaRegularizacaoFonteGravacao"
  FOR EACH ROW EXECUTE FUNCTION preservar_proposta_regularizacao_fonte_gravacao_147();
