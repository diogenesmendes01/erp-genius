-- ATENÇÃO: FAÇA BACKUP DO BANCO ANTES DO DEPLOY DESTA MIGRATION.
-- Ela apaga dados de forma irreversível: as tabelas "PoliticaComercial" e "DegrauComercial", a coluna
-- "IntencaoMensagem"."politicaComercialId" e as colunas de auto-lead, saudação e gestão de "ConfigComercial".
-- Antes de aplicar, confira que as tabelas estão vazias ou que os dados não precisam ser guardados
-- (consultas na seção "Antes do deploy" do PR e no quadro de entregas).
--
-- Remoção do CRM antigo (B13/D4, decisão do dono de 20/10/2026). Nada no código lê ou grava estes objetos:
-- - a régua comercial (PoliticaComercial/DegrauComercial) perdeu o cron e o enfileirador; o despachante cancela
--   as intenções comerciais que sobraram na fila ("politica_comercial_alterada");
-- - o auto-lead, a saudação e a gestão (C5) da ConfigComercial perderam a tela, a ação e os leitores.
-- Continuam em ConfigComercial: checkInToleranciaMinutos e matriculaAutomaticaAtiva (lidos pela Home e pelo
-- fechamento automático). Continuam em IntencaoMensagem: leadId, passoComercial e ocorrenciaComercial.

-- Índice único parcial da cadência comercial (migration 20260720180000_ocorrencia_cadencia_comercial). O DROP
-- COLUMN abaixo já o removeria; fica explícito para o efeito ser legível.
DROP INDEX IF EXISTS "IntencaoMensagem_comercial_degrau_key";

-- DropForeignKey
ALTER TABLE "IntencaoMensagem" DROP CONSTRAINT "IntencaoMensagem_politicaComercialId_fkey";

-- DropForeignKey
ALTER TABLE "PoliticaComercial" DROP CONSTRAINT "PoliticaComercial_numeroRemetenteId_fkey";

-- DropForeignKey
ALTER TABLE "DegrauComercial" DROP CONSTRAINT "DegrauComercial_politicaId_fkey";

-- DropForeignKey
ALTER TABLE "DegrauComercial" DROP CONSTRAINT "DegrauComercial_templateId_fkey";

-- DropForeignKey
ALTER TABLE "ConfigComercial" DROP CONSTRAINT "ConfigComercial_gestaoNumeroId_fkey";

-- AlterTable
ALTER TABLE "IntencaoMensagem" DROP COLUMN "politicaComercialId";

-- AlterTable
ALTER TABLE "ConfigComercial" DROP COLUMN "autoLeadAtivo",
DROP COLUMN "gestaoEstado",
DROP COLUMN "gestaoNumeroId",
DROP COLUMN "gestaoRelatorioHora",
DROP COLUMN "gestaoSlaMinutos",
DROP COLUMN "gestaoTelefoneE164",
DROP COLUMN "saudacaoEstado",
DROP COLUMN "saudacaoTexto";

-- DropTable
DROP TABLE "DegrauComercial";

-- DropTable
DROP TABLE "PoliticaComercial";
