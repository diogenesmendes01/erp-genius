-- RASCUNHO 183 — Q13/Q33/Q35/Q36/Q52/Q57/Q58.
-- Não está em prisma/migrations e não deve ser aplicado automaticamente.
-- Integração posterior precisa acrescentar as relações equivalentes ao schema.
-- O Drive fica identificado pelo arquivo oficial; nenhuma URL pública é gravada.

ALTER TABLE "ConfiguracaoOperacional"
  ADD COLUMN "prazoPrimeiraEntregaReposicaoMinutos" INTEGER,
  ADD COLUMN "prazoRespostaCorrecaoReposicaoMinutos" INTEGER;
ALTER TABLE "ConfiguracaoOperacional" ADD CONSTRAINT "ConfiguracaoOperacional_prazos_entrega_reposicao_positivos"
  CHECK (("prazoPrimeiraEntregaReposicaoMinutos" IS NULL OR "prazoPrimeiraEntregaReposicaoMinutos" > 0)
     AND ("prazoRespostaCorrecaoReposicaoMinutos" IS NULL OR "prazoRespostaCorrecaoReposicaoMinutos" > 0));

CREATE TYPE "ProvedorMaterialReposicao" AS ENUM ('GOOGLE_DRIVE');
CREATE TYPE "SituacaoCorrecaoEntregaReposicao" AS ENUM ('PENDENTE', 'RESPONDIDA', 'CANCELADA');
CREATE TYPE "SituacaoRelatoMaterialReposicao" AS ENUM ('ABERTO', 'CONFIRMADO', 'DESCARTADO');

CREATE TABLE "MaterialReposicaoGravacao" (
  "id" TEXT NOT NULL,
  "reposicaoId" TEXT NOT NULL,
  provedor "ProvedorMaterialReposicao" NOT NULL,
  "arquivoOficialId" TEXT NOT NULL,
  disponivel BOOLEAN NOT NULL DEFAULT true,
  "publicadoPorId" TEXT NOT NULL,
  "publicadoEm" TIMESTAMP(3) NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "MaterialReposicaoGravacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaterialReposicaoGravacao_arquivo_oficial" CHECK (btrim("arquivoOficialId") <> '' AND "arquivoOficialId" !~* '^https?://')
);
CREATE UNIQUE INDEX "MaterialReposicaoGravacao_reposicaoId_key" ON "MaterialReposicaoGravacao"("reposicaoId");
ALTER TABLE "MaterialReposicaoGravacao" ADD CONSTRAINT "MaterialReposicaoGravacao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "MaterialReposicaoGravacao" ADD CONSTRAINT "MaterialReposicaoGravacao_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "DisponibilizacaoEntregaReposicao" (
  "id" TEXT NOT NULL,
  "reposicaoId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "disponibilizadaEm" TIMESTAMP(3) NOT NULL,
  "prazoBaseMinutos" INTEGER NOT NULL,
  "prazoInicialAte" TIMESTAMP(3) NOT NULL,
  "publicadaPorId" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "DisponibilizacaoEntregaReposicao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisponibilizacaoEntregaReposicao_prazo_positivo" CHECK ("prazoBaseMinutos" > 0 AND "prazoInicialAte" > "disponibilizadaEm")
);
CREATE UNIQUE INDEX "DisponibilizacaoEntregaReposicao_reposicaoId_key" ON "DisponibilizacaoEntregaReposicao"("reposicaoId");
CREATE UNIQUE INDEX "DisponibilizacaoEntregaReposicao_materialId_key" ON "DisponibilizacaoEntregaReposicao"("materialId");
ALTER TABLE "DisponibilizacaoEntregaReposicao" ADD CONSTRAINT "DisponibilizacaoEntregaReposicao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DisponibilizacaoEntregaReposicao" ADD CONSTRAINT "DisponibilizacaoEntregaReposicao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DisponibilizacaoEntregaReposicao" ADD CONSTRAINT "DisponibilizacaoEntregaReposicao_publicadaPorId_fkey" FOREIGN KEY ("publicadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "RelatoIndisponibilidadeMaterialReposicao" (
  "id" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "contaPortalAlunoId" TEXT,
  "relatadoPorId" TEXT,
  descricao TEXT NOT NULL,
  situacao "SituacaoRelatoMaterialReposicao" NOT NULL DEFAULT 'ABERTO',
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  "confirmadoEm" TIMESTAMP(3),
  CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_autor_exato" CHECK (("contaPortalAlunoId" IS NULL) <> ("relatadoPorId" IS NULL)),
  CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_descricao" CHECK (btrim(descricao) <> '')
);
CREATE INDEX "RelatoIndisponibilidadeMaterialReposicao_material_situacao_idx" ON "RelatoIndisponibilidadeMaterialReposicao"("materialId", situacao, "criadaEm");
ALTER TABLE "RelatoIndisponibilidadeMaterialReposicao" ADD CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "RelatoIndisponibilidadeMaterialReposicao" ADD CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_contaPortalAlunoId_fkey" FOREIGN KEY ("contaPortalAlunoId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "RelatoIndisponibilidadeMaterialReposicao" ADD CONSTRAINT "RelatoIndisponibilidadeMaterialReposicao_relatadoPorId_fkey" FOREIGN KEY ("relatadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "IndisponibilidadeMaterialReposicao" (
  "id" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "relatoId" TEXT NOT NULL,
  "confirmadaPorId" TEXT NOT NULL,
  inicio TIMESTAMP(3) NOT NULL,
  fim TIMESTAMP(3),
  motivo TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "IndisponibilidadeMaterialReposicao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IndisponibilidadeMaterialReposicao_intervalo" CHECK (fim IS NULL OR fim > inicio),
  CONSTRAINT "IndisponibilidadeMaterialReposicao_motivo" CHECK (btrim(motivo) <> '')
);
CREATE UNIQUE INDEX "IndisponibilidadeMaterialReposicao_relatoId_key" ON "IndisponibilidadeMaterialReposicao"("relatoId");
CREATE UNIQUE INDEX "IndisponibilidadeMaterialReposicao_ativa_unica" ON "IndisponibilidadeMaterialReposicao"("materialId") WHERE fim IS NULL;
ALTER TABLE "IndisponibilidadeMaterialReposicao" ADD CONSTRAINT "IndisponibilidadeMaterialReposicao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "IndisponibilidadeMaterialReposicao" ADD CONSTRAINT "IndisponibilidadeMaterialReposicao_relatoId_fkey" FOREIGN KEY ("relatoId") REFERENCES "RelatoIndisponibilidadeMaterialReposicao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "IndisponibilidadeMaterialReposicao" ADD CONSTRAINT "IndisponibilidadeMaterialReposicao_confirmadaPorId_fkey" FOREIGN KEY ("confirmadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "SolicitacaoCorrecaoEntregaReposicao" (
  "id" TEXT NOT NULL,
  "reposicaoId" TEXT NOT NULL,
  "entregaId" TEXT NOT NULL,
  "solicitadaPorId" TEXT NOT NULL,
  comentario TEXT NOT NULL,
  "prazoBaseMinutos" INTEGER NOT NULL,
  "prazoAte" TIMESTAMP(3) NOT NULL,
  situacao "SituacaoCorrecaoEntregaReposicao" NOT NULL DEFAULT 'PENDENTE',
  "respondidaEm" TIMESTAMP(3),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_prazo" CHECK ("prazoBaseMinutos" > 0 AND "prazoAte" > "criadaEm"),
  CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_situacao" CHECK ((situacao = 'RESPONDIDA') = ("respondidaEm" IS NOT NULL)),
  CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_comentario" CHECK (btrim(comentario) <> '')
);
CREATE UNIQUE INDEX "SolicitacaoCorrecaoEntregaReposicao_entregaId_key" ON "SolicitacaoCorrecaoEntregaReposicao"("entregaId");
CREATE UNIQUE INDEX "SolicitacaoCorrecaoEntregaReposicao_pendente_unica" ON "SolicitacaoCorrecaoEntregaReposicao"("reposicaoId") WHERE situacao = 'PENDENTE';
ALTER TABLE "SolicitacaoCorrecaoEntregaReposicao" ADD CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "SolicitacaoCorrecaoEntregaReposicao" ADD CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "EntregaReposicaoGravacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "SolicitacaoCorrecaoEntregaReposicao" ADD CONSTRAINT "SolicitacaoCorrecaoEntregaReposicao_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "EntregaReposicaoGravacao"
  ADD COLUMN "contaPortalAlunoId" TEXT,
  ADD COLUMN "solicitacaoCorrecaoId" TEXT;
CREATE UNIQUE INDEX "EntregaReposicaoGravacao_solicitacaoCorrecaoId_key" ON "EntregaReposicaoGravacao"("solicitacaoCorrecaoId") WHERE "solicitacaoCorrecaoId" IS NOT NULL;
ALTER TABLE "EntregaReposicaoGravacao" ADD CONSTRAINT "EntregaReposicaoGravacao_contaPortalAlunoId_fkey" FOREIGN KEY ("contaPortalAlunoId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "EntregaReposicaoGravacao" ADD CONSTRAINT "EntregaReposicaoGravacao_solicitacaoCorrecaoId_fkey" FOREIGN KEY ("solicitacaoCorrecaoId") REFERENCES "SolicitacaoCorrecaoEntregaReposicao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "ProrrogacaoPrazoReposicao" (
  "id" TEXT NOT NULL,
  "reposicaoId" TEXT NOT NULL,
  "solicitacaoCorrecaoId" TEXT,
  versao INTEGER NOT NULL,
  "prazoAnterior" TIMESTAMP(3) NOT NULL,
  "novoPrazo" TIMESTAMP(3) NOT NULL,
  motivo TEXT NOT NULL,
  "autorizadaPorId" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "ProrrogacaoPrazoReposicao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProrrogacaoPrazoReposicao_prazo" CHECK (versao > 0 AND "novoPrazo" > "prazoAnterior" AND btrim(motivo) <> '')
);
CREATE UNIQUE INDEX "ProrrogacaoPrazoReposicao_entrega_versao" ON "ProrrogacaoPrazoReposicao"("reposicaoId", versao) WHERE "solicitacaoCorrecaoId" IS NULL;
CREATE UNIQUE INDEX "ProrrogacaoPrazoReposicao_correcao_versao" ON "ProrrogacaoPrazoReposicao"("solicitacaoCorrecaoId", versao) WHERE "solicitacaoCorrecaoId" IS NOT NULL;
ALTER TABLE "ProrrogacaoPrazoReposicao" ADD CONSTRAINT "ProrrogacaoPrazoReposicao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ProrrogacaoPrazoReposicao" ADD CONSTRAINT "ProrrogacaoPrazoReposicao_solicitacaoCorrecaoId_fkey" FOREIGN KEY ("solicitacaoCorrecaoId") REFERENCES "SolicitacaoCorrecaoEntregaReposicao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ProrrogacaoPrazoReposicao" ADD CONSTRAINT "ProrrogacaoPrazoReposicao_autorizadaPorId_fkey" FOREIGN KEY ("autorizadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "LiberacaoEntregaReposicao" (
  "id" TEXT NOT NULL,
  "reposicaoId" TEXT NOT NULL,
  "contaId" TEXT NOT NULL,
  inicio TIMESTAMP(3) NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  motivo TEXT NOT NULL,
  "autorizadaPorId" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "LiberacaoEntregaReposicao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiberacaoEntregaReposicao_prazo" CHECK ("expiraEm" > inicio AND btrim(motivo) <> '')
);
CREATE INDEX "LiberacaoEntregaReposicao_reposicao_conta_expira_idx" ON "LiberacaoEntregaReposicao"("reposicaoId", "contaId", "expiraEm");
ALTER TABLE "LiberacaoEntregaReposicao" ADD CONSTRAINT "LiberacaoEntregaReposicao_reposicaoId_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "LiberacaoEntregaReposicao" ADD CONSTRAINT "LiberacaoEntregaReposicao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaPortalAluno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "LiberacaoEntregaReposicao" ADD CONSTRAINT "LiberacaoEntregaReposicao_autorizadaPorId_fkey" FOREIGN KEY ("autorizadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- A origem da entrega continua sendo o aluno da matrícula e passa a exigir a
-- conta autenticada correspondente. As inserções legadas, sem conta, seguem
-- legíveis; novas inserções de portal precisam preencher ambas as fontes.
CREATE OR REPLACE FUNCTION "validar_origem_entrega_reposicao_portal"() RETURNS TRIGGER AS $$
DECLARE aluno_matricula TEXT; conta_aluno TEXT; versao_anterior INTEGER; correcao TEXT;
BEGIN
  SELECT m."alunoId" INTO aluno_matricula FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id = r."matriculaId"
    WHERE r.id = NEW."reposicaoId" AND r.modalidade = 'GRAVACAO';
  SELECT "alunoId" INTO conta_aluno FROM "ContaPortalAluno" WHERE id = NEW."contaPortalAlunoId" AND ativa;
  SELECT COALESCE(MAX(versao), 0) INTO versao_anterior FROM "EntregaReposicaoGravacao" WHERE "reposicaoId" = NEW."reposicaoId";
  IF NEW."contaPortalAlunoId" IS NULL OR aluno_matricula IS NULL OR NEW."alunoId" <> aluno_matricula OR conta_aluno IS DISTINCT FROM aluno_matricula
    OR NEW.versao <> versao_anterior + 1 THEN RAISE EXCEPTION 'Entrega de portal exige aluno, conta e versão da mesma reposição gravada'; END IF;
  IF NEW."solicitacaoCorrecaoId" IS NOT NULL THEN
    SELECT id INTO correcao FROM "SolicitacaoCorrecaoEntregaReposicao" WHERE id = NEW."solicitacaoCorrecaoId"
      AND "reposicaoId" = NEW."reposicaoId" AND situacao = 'PENDENTE';
    IF correcao IS NULL THEN RAISE EXCEPTION 'Resposta não corresponde a uma correção pendente'; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "EntregaReposicaoGravacao_validar_origem_portal" BEFORE INSERT ON "EntregaReposicaoGravacao"
  FOR EACH ROW EXECUTE FUNCTION "validar_origem_entrega_reposicao_portal"();

CREATE OR REPLACE FUNCTION "proteger_entrega_reposicao_portal"() RETURNS TRIGGER AS $$ BEGIN
  RAISE EXCEPTION 'EntregaReposicaoGravacao é histórica e não pode ser alterada ou removida';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "EntregaReposicaoGravacao_proteger_portal" BEFORE UPDATE OR DELETE ON "EntregaReposicaoGravacao"
  FOR EACH ROW EXECUTE FUNCTION "proteger_entrega_reposicao_portal"();

CREATE OR REPLACE FUNCTION "validar_indisponibilidade_reposicao"() RETURNS TRIGGER AS $$
DECLARE gestor BOOLEAN; relato_material TEXT;
BEGIN
  SELECT u.ativo AND u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] INTO gestor FROM "Usuario" u WHERE u.id = NEW."confirmadaPorId";
  SELECT "materialId" INTO relato_material FROM "RelatoIndisponibilidadeMaterialReposicao" WHERE id = NEW."relatoId" AND situacao = 'ABERTO';
  IF gestor IS DISTINCT FROM true OR relato_material IS NULL OR relato_material <> NEW."materialId" THEN
    RAISE EXCEPTION 'Indisponibilidade exige relato aberto e confirmação de gestão ativa';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "IndisponibilidadeMaterialReposicao_validar" BEFORE INSERT ON "IndisponibilidadeMaterialReposicao"
  FOR EACH ROW EXECUTE FUNCTION "validar_indisponibilidade_reposicao"();
