-- REVISÃO614: INCOMPLETO, NÃO PROMOVER. Regularização exige cadeia aprovada de fontes.
-- Ver docs/planejamento/revisao-migracao146-614.md antes de aplicar qualquer versão.
-- RASCUNHO Q613 / futura migration 146 — NÃO APLICAR.
--
-- Fonte: docs/planejamento/mapa-integracao-revisao-612.md. Este arquivo não
-- preenche legado e não pertence a prisma/migrations antes de revisão.

BEGIN;

ALTER TABLE "PublicacaoGravacaoAula"
  ADD COLUMN "driveRevisionId" TEXT,
  ADD COLUMN "driveRevisionMd5" TEXT,
  ADD COLUMN "driveRevisionSize" BIGINT;

ALTER TABLE "MaterialReposicaoGravacao"
  ADD COLUMN "driveOrganizacaoId" TEXT,
  ADD COLUMN "driveRevisionId" TEXT,
  ADD COLUMN "driveRevisionMd5" TEXT,
  ADD COLUMN "driveRevisionSize" BIGINT,
  ADD COLUMN "mimeType" TEXT;

ALTER TABLE "PublicacaoGravacaoAula"
  ADD CONSTRAINT "PublicacaoGravacaoAula_revisao_conjunto_check"
    CHECK (("driveRevisionId" IS NULL AND "driveRevisionMd5" IS NULL AND "driveRevisionSize" IS NULL)
        OR ("driveRevisionId" IS NOT NULL AND "driveRevisionMd5" IS NOT NULL AND "driveRevisionSize" IS NOT NULL)),
  ADD CONSTRAINT "PublicacaoGravacaoAula_driveRevisionId_formato_check"
    CHECK ("driveRevisionId" IS NULL OR (length("driveRevisionId") BETWEEN 3 AND 500 AND "driveRevisionId" ~ '^[A-Za-z0-9_-]+$')),
  ADD CONSTRAINT "PublicacaoGravacaoAula_driveRevisionMd5_formato_check"
    CHECK ("driveRevisionMd5" IS NULL OR "driveRevisionMd5" ~* '^[a-f0-9]{32}$'),
  ADD CONSTRAINT "PublicacaoGravacaoAula_driveRevisionSize_positivo_check"
    CHECK ("driveRevisionSize" IS NULL OR "driveRevisionSize" > 0);

ALTER TABLE "MaterialReposicaoGravacao"
  ADD CONSTRAINT "MaterialReposicaoGravacao_revisao_conjunto_check"
    CHECK (("driveOrganizacaoId" IS NULL AND "driveRevisionId" IS NULL AND "driveRevisionMd5" IS NULL AND "driveRevisionSize" IS NULL AND "mimeType" IS NULL)
        OR ("driveOrganizacaoId" IS NOT NULL AND "driveRevisionId" IS NOT NULL AND "driveRevisionMd5" IS NOT NULL AND "driveRevisionSize" IS NOT NULL AND "mimeType" IS NOT NULL)),
  ADD CONSTRAINT "MaterialReposicaoGravacao_driveOrganizacaoId_formato_check"
    CHECK ("driveOrganizacaoId" IS NULL OR (length("driveOrganizacaoId") BETWEEN 3 AND 500 AND "driveOrganizacaoId" ~ '^[A-Za-z0-9_-]+$')),
  ADD CONSTRAINT "MaterialReposicaoGravacao_driveRevisionId_formato_check"
    CHECK ("driveRevisionId" IS NULL OR (length("driveRevisionId") BETWEEN 3 AND 500 AND "driveRevisionId" ~ '^[A-Za-z0-9_-]+$')),
  ADD CONSTRAINT "MaterialReposicaoGravacao_driveRevisionMd5_formato_check"
    CHECK ("driveRevisionMd5" IS NULL OR "driveRevisionMd5" ~* '^[a-f0-9]{32}$'),
  ADD CONSTRAINT "MaterialReposicaoGravacao_driveRevisionSize_positivo_check"
    CHECK ("driveRevisionSize" IS NULL OR "driveRevisionSize" > 0),
  ADD CONSTRAINT "MaterialReposicaoGravacao_mimeType_video_check"
    CHECK ("mimeType" IS NULL OR "mimeType" ~* '^video/[A-Za-z0-9][A-Za-z0-9.!#$&^_+-]*$');

-- A publicação já tem trigger de imutabilidade total (211). Este guard só
-- distingue INSERT novo de linhas históricas que receberam NULL na transição.
CREATE OR REPLACE FUNCTION validar_revisao_publicacao_gravacao_aula_613()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."driveRevisionId" IS NULL OR NEW."driveRevisionMd5" IS NULL OR NEW."driveRevisionSize" IS NULL THEN
    RAISE EXCEPTION 'Nova publicação exige identidade completa de revisão do Drive';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PublicacaoGravacaoAula_validar_revisao_613"
  BEFORE INSERT ON "PublicacaoGravacaoAula"
  FOR EACH ROW EXECUTE FUNCTION validar_revisao_publicacao_gravacao_aula_613();

-- Mantém atualizações operacionais permitidas em material, mas nunca permite
-- completar, trocar ou apagar a identidade de uma fonte histórica.
CREATE OR REPLACE FUNCTION validar_revisao_material_reposicao_gravacao_613()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  publicacao_arquivo TEXT;
  publicacao_drive TEXT;
  publicacao_revisao TEXT;
  publicacao_md5 TEXT;
  publicacao_tamanho BIGINT;
  publicacao_mime TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.provedor IS DISTINCT FROM NEW.provedor
      OR OLD."arquivoOficialId" IS DISTINCT FROM NEW."arquivoOficialId"
      OR OLD."driveOrganizacaoId" IS DISTINCT FROM NEW."driveOrganizacaoId"
      OR OLD."driveRevisionId" IS DISTINCT FROM NEW."driveRevisionId"
      OR OLD."driveRevisionMd5" IS DISTINCT FROM NEW."driveRevisionMd5"
      OR OLD."driveRevisionSize" IS DISTINCT FROM NEW."driveRevisionSize"
      OR OLD."mimeType" IS DISTINCT FROM NEW."mimeType" THEN
      RAISE EXCEPTION 'Identidade de revisão do material é imutável; legado exige nova publicação';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."driveOrganizacaoId" IS NULL OR NEW."driveRevisionId" IS NULL
    OR NEW."driveRevisionMd5" IS NULL OR NEW."driveRevisionSize" IS NULL OR NEW."mimeType" IS NULL THEN
    RAISE EXCEPTION 'Novo material exige identidade completa de revisão do Drive';
  END IF;

  IF NEW."publicacaoAulaId" IS NOT NULL THEN
    SELECT "arquivoOficialId", "driveOrganizacaoId", "driveRevisionId", "driveRevisionMd5", "driveRevisionSize", "mimeType"
      INTO publicacao_arquivo, publicacao_drive, publicacao_revisao, publicacao_md5, publicacao_tamanho, publicacao_mime
      FROM "PublicacaoGravacaoAula" WHERE id = NEW."publicacaoAulaId" FOR SHARE;
    IF NOT FOUND
      OR NEW."arquivoOficialId" IS DISTINCT FROM publicacao_arquivo
      OR NEW."driveOrganizacaoId" IS DISTINCT FROM publicacao_drive
      OR NEW."driveRevisionId" IS DISTINCT FROM publicacao_revisao
      OR NEW."driveRevisionMd5" IS DISTINCT FROM publicacao_md5
      OR NEW."driveRevisionSize" IS DISTINCT FROM publicacao_tamanho
      OR NEW."mimeType" IS DISTINCT FROM publicacao_mime THEN
      RAISE EXCEPTION 'Material derivado exige identidade integral da publicação da aula';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "MaterialReposicaoGravacao_validar_revisao_613"
  BEFORE INSERT OR UPDATE ON "MaterialReposicaoGravacao"
  FOR EACH ROW EXECUTE FUNCTION validar_revisao_material_reposicao_gravacao_613();

COMMIT;

/*
Impacto de INSERT SQL/fixtures a ajustar na migration real:
- src/server/gravacoes/autorizacao.int.test.ts
- src/server/portal-aluno/reposicoes-conclusao.int.test.ts
- src/server/portal-aluno/relatos-indisponibilidade.int.test.ts
- src/server/portal-aluno/guardrails-entrega-190.int.test.ts
- src/server/diario/reposicao-entrega-operacional.int.test.ts
- src/server/portal-aluno/entregas-reposicao.int.test.ts
- src/server/portal-aluno/entregas-reposicao.ts (INSERT próprio da action)

As fixtures históricas devem manter todas as colunas de revisão NULL apenas se
representarem legado deliberado; não podem preencher a cabeça atual do Drive.
*/
