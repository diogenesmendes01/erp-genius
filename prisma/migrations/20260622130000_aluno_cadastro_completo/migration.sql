-- Cadastro de aluno completo (doc 09): identificação dividida (nome → primeiroNome +
-- sobrenome), documentação estruturada (tipo de documento + país emissor + nacionalidades),
-- residência, acadêmico e operacional. Gênero reduzido a 3 valores; PapelResponsavel ganha
-- EMERGENCIA. Backfill seguro verificado nos 190 alunos reais (sem OUTRO; sem mononomes).

-- 1) Normaliza gênero OUTRO -> NAO_INFORMADO ANTES de remover o valor do enum.
UPDATE "Aluno" SET "genero" = 'NAO_INFORMADO' WHERE "genero" = 'OUTRO';
UPDATE "Usuario" SET "genero" = 'NAO_INFORMADO' WHERE "genero" = 'OUTRO';

-- 2) Recria enum Genero sem OUTRO (rename-swap; colunas genero não têm default).
ALTER TYPE "Genero" RENAME TO "Genero_old";
CREATE TYPE "Genero" AS ENUM ('MASCULINO', 'FEMININO', 'NAO_INFORMADO');
ALTER TABLE "Aluno" ALTER COLUMN "genero" TYPE "Genero" USING "genero"::text::"Genero";
ALTER TABLE "Usuario" ALTER COLUMN "genero" TYPE "Genero" USING "genero"::text::"Genero";
DROP TYPE "Genero_old";

-- 3) Enum Escolaridade (novo).
CREATE TYPE "Escolaridade" AS ENUM ('FUNDAMENTAL_INCOMPLETO', 'FUNDAMENTAL_COMPLETO', 'MEDIO_INCOMPLETO', 'MEDIO_COMPLETO', 'TECNICO', 'SUPERIOR_INCOMPLETO', 'SUPERIOR_COMPLETO', 'POS_GRADUACAO', 'MESTRADO', 'DOUTORADO');

-- 4) PapelResponsavel ganha EMERGENCIA (rename-swap para evitar ADD VALUE em transação).
ALTER TABLE "AlunoResponsavel" ALTER COLUMN "papel" DROP DEFAULT;
ALTER TYPE "PapelResponsavel" RENAME TO "PapelResponsavel_old";
CREATE TYPE "PapelResponsavel" AS ENUM ('PEDAGOGICO', 'FINANCEIRO', 'EMERGENCIA');
ALTER TABLE "AlunoResponsavel" ALTER COLUMN "papel" TYPE "PapelResponsavel" USING "papel"::text::"PapelResponsavel";
ALTER TABLE "AlunoResponsavel" ALTER COLUMN "papel" SET DEFAULT 'FINANCEIRO';
DROP TYPE "PapelResponsavel_old";

-- 5) Identificação: divide nome em primeiroNome + sobrenome (backfill: 1º token / resto).
ALTER TABLE "Aluno" ADD COLUMN "primeiroNome" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "sobrenome" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "nomePreferido" TEXT;
UPDATE "Aluno" SET
  "primeiroNome" = split_part("nome", ' ', 1),
  "sobrenome" = NULLIF(regexp_replace("nome", '^\S+\s+', ''), '');
ALTER TABLE "Aluno" ALTER COLUMN "primeiroNome" SET NOT NULL;
ALTER TABLE "Aluno" DROP COLUMN "nome";

-- 6) Documentação estruturada.
ALTER TABLE "Aluno" ADD COLUMN "tipoDocumentoId" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "documentoPaisEmissor" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "nacionalidade" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "segundaNacionalidade" TEXT;

-- 7) Contato.
ALTER TABLE "Aluno" ADD COLUMN "whatsapp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Aluno" ADD COLUMN "aceitaComunicacoes" BOOLEAN NOT NULL DEFAULT true;

-- 8) Residência.
ALTER TABLE "Aluno" ADD COLUMN "paisResidencia" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "cep" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "rua" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "numero" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "complemento" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "bairro" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "cidade" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "regiao" TEXT;

-- 9) Acadêmico + operacional.
ALTER TABLE "Aluno" ADD COLUMN "escolaridade" "Escolaridade";
ALTER TABLE "Aluno" ADD COLUMN "idiomaNativo" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "fuso" TEXT;
ALTER TABLE "Aluno" ADD COLUMN "observacoes" TEXT;

-- 10) FK do tipo de documento (país dirige os tipos — doc 04).
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
