-- PostgreSQL limita quantificadores de repetição. Validar comprimento
-- separadamente mantém o contrato de IDs entre 3 e 500 caracteres.
ALTER TABLE "PublicacaoGravacaoAula"
  DROP CONSTRAINT "PublicacaoGravacaoAula_arquivoOficialId_formato_check",
  DROP CONSTRAINT "PublicacaoGravacaoAula_driveOrganizacaoId_formato_check",
  ADD CONSTRAINT "PublicacaoGravacaoAula_arquivoOficialId_formato_check"
    CHECK (length("arquivoOficialId") BETWEEN 3 AND 500 AND "arquivoOficialId" ~ '^[A-Za-z0-9_-]+$'),
  ADD CONSTRAINT "PublicacaoGravacaoAula_driveOrganizacaoId_formato_check"
    CHECK (length("driveOrganizacaoId") BETWEEN 3 AND 500 AND "driveOrganizacaoId" ~ '^[A-Za-z0-9_-]+$');
