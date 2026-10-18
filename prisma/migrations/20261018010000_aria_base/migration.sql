-- CreateEnum
CREATE TYPE "StatusVersaoAgenteIA" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "AcaoAgenteIATipo" AS ENUM ('RESPONDER', 'ENVIAR_DOCUMENTO', 'ATUALIZAR_CAMPO', 'TAG', 'MOVER_ETAPA', 'MARCAR_PERDIDO', 'CRIAR_TAREFA', 'AGENDAR_MENSAGEM', 'NOTA_INTERNA', 'CONDICAO_COMERCIAL', 'HANDOFF', 'CLASSIFICAR_SETOR');

-- CreateEnum
CREATE TYPE "StatusAcaoAgenteIA" AS ENUM ('SUGERIDA', 'EXECUTADA', 'APROVADA', 'REJEITADA', 'EXPIRADA', 'DESFEITA', 'FALHOU', 'SIMULADA', 'BLOQUEADA');

-- CreateEnum
CREATE TYPE "MotivoPausaAtendimentoIA" AS ENUM ('HUMANO_RESPONDEU', 'CELULAR', 'MANUAL', 'HANDOFF', 'OPT_OUT');

-- CreateEnum
CREATE TYPE "OrigemChamadaIA" AS ENUM ('ATENDIMENTO', 'TRIAGEM', 'RESUMO', 'INDEXACAO', 'PLAYGROUND');

-- CreateEnum
CREATE TYPE "AcaoOrcamentoIA" AS ENUM ('SO_SUGERIR', 'PAUSAR');

-- DropForeignKey
ALTER TABLE "SugestaoIA" DROP CONSTRAINT "SugestaoIA_decididaPorId_fkey";

-- DropForeignKey
ALTER TABLE "SugestaoIA" DROP CONSTRAINT "SugestaoIA_leadId_fkey";

-- AlterTable
ALTER TABLE "AtendimentoWhatsApp" ADD COLUMN     "iaPausaMotivo" "MotivoPausaAtendimentoIA",
ADD COLUMN     "iaPausadaEm" TIMESTAMP(3),
ADD COLUMN     "iaRetomadaEm" TIMESTAMP(3),
ADD COLUMN     "iaRetomadaPorId" TEXT;

-- AlterTable
ALTER TABLE "ConfigComercial" DROP COLUMN "copilotoAtivo",
DROP COLUMN "copilotoQuietudeMinutos";

-- AlterTable
ALTER TABLE "IntencaoMensagem" ADD COLUMN     "acaoAgenteIAId" TEXT;

-- AlterTable
ALTER TABLE "MensagemWhatsApp" ADD COLUMN     "acaoAgenteIAId" TEXT;

-- DropTable
DROP TABLE "SugestaoIA";

-- DropEnum
DROP TYPE "GatilhoSugestaoIA";

-- DropEnum
DROP TYPE "StatusSugestaoIA";

-- DropEnum
DROP TYPE "TipoSugestaoIA";

-- CreateTable
CREATE TABLE "AgenteIA" (
    "id" TEXT NOT NULL DEFAULT 'aria',
    "estado" "EstadoPolitica" NOT NULL DEFAULT 'DESLIGADA',
    "pausadoEm" TIMESTAMP(3),
    "pausadoPorId" TEXT,
    "motivoPausa" TEXT,
    "supervisaoAte" TIMESTAMP(3),
    "versaoPublicadaId" TEXT,

    CONSTRAINT "AgenteIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersaoAgenteIA" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusVersaoAgenteIA" NOT NULL,
    "config" JSONB NOT NULL,
    "baseVersaoId" TEXT,
    "criadaPorId" TEXT NOT NULL,
    "publicadaPorId" TEXT,
    "publicadaEm" TIMESTAMP(3),
    "notaPublicacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VersaoAgenteIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnoAgenteIA" (
    "id" TEXT NOT NULL,
    "ancoraMensagemId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "versaoId" TEXT,
    "tipo" "OrigemChamadaIA" NOT NULL,
    "confianca" INTEGER,
    "resultado" TEXT NOT NULL,
    "chamadaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurnoAgenteIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaoAgenteIA" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "oportunidadeId" TEXT,
    "acao" "AcaoAgenteIATipo" NOT NULL,
    "etapaNoMomento" "EtapaLead",
    "modoConfigurado" TEXT NOT NULL,
    "status" "StatusAcaoAgenteIA" NOT NULL,
    "confianca" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "justificativa" TEXT,
    "fontes" JSONB,
    "reversivel" BOOLEAN NOT NULL,
    "motivoIrreversivel" TEXT,
    "intencaoId" TEXT,
    "eventoId" TEXT,
    "aprovacaoId" TEXT,
    "expiraEm" TIMESTAMP(3),
    "decididaPorId" TEXT,
    "decididaEm" TIMESTAMP(3),
    "desfeitaPorId" TEXT,
    "desfeitaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcaoAgenteIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamadaIA" (
    "id" TEXT NOT NULL,
    "origem" "OrigemChamadaIA" NOT NULL,
    "modelo" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "tokensEntrada" INTEGER NOT NULL,
    "tokensSaida" INTEGER NOT NULL,
    "tokensCache" INTEGER NOT NULL,
    "custoMicroUsd" INTEGER NOT NULL,
    "latenciaMs" INTEGER NOT NULL,
    "resultado" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadaIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigIA" (
    "id" TEXT NOT NULL DEFAULT 'ia',
    "modeloConversa" TEXT NOT NULL DEFAULT 'claude-sonnet-5-5',
    "modeloClassificacao" TEXT NOT NULL DEFAULT 'claude-haiku-5-5',
    "orcamentoMensalUsd" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "acaoAoEstourar" "AcaoOrcamentoIA" NOT NULL DEFAULT 'SO_SUGERIR',
    "limiarTriagem" INTEGER NOT NULL DEFAULT 80,
    "triagemAtiva" BOOLEAN NOT NULL DEFAULT false,
    "alteradaPorId" TEXT,

    CONSTRAINT "ConfigIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgenteIA_versaoPublicadaId_key" ON "AgenteIA"("versaoPublicadaId");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoAgenteIA_numero_key" ON "VersaoAgenteIA"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "TurnoAgenteIA_ancoraMensagemId_key" ON "TurnoAgenteIA"("ancoraMensagemId");

-- CreateIndex
CREATE INDEX "TurnoAgenteIA_atendimentoId_criadoEm_idx" ON "TurnoAgenteIA"("atendimentoId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "AcaoAgenteIA_intencaoId_key" ON "AcaoAgenteIA"("intencaoId");

-- CreateIndex
CREATE INDEX "AcaoAgenteIA_atendimentoId_criadoEm_idx" ON "AcaoAgenteIA"("atendimentoId", "criadoEm");

-- CreateIndex
CREATE INDEX "AcaoAgenteIA_status_expiraEm_idx" ON "AcaoAgenteIA"("status", "expiraEm");

-- CreateIndex
CREATE INDEX "ChamadaIA_criadoEm_idx" ON "ChamadaIA"("criadoEm");

-- AddForeignKey
ALTER TABLE "AgenteIA" ADD CONSTRAINT "AgenteIA_versaoPublicadaId_fkey" FOREIGN KEY ("versaoPublicadaId") REFERENCES "VersaoAgenteIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoAgenteIA" ADD CONSTRAINT "TurnoAgenteIA_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoAgenteIA" ADD CONSTRAINT "TurnoAgenteIA_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoAgenteIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoAgenteIA" ADD CONSTRAINT "TurnoAgenteIA_chamadaId_fkey" FOREIGN KEY ("chamadaId") REFERENCES "ChamadaIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoAgenteIA" ADD CONSTRAINT "AcaoAgenteIA_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoAgenteIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoAgenteIA" ADD CONSTRAINT "AcaoAgenteIA_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No máximo um rascunho e uma publicada por vez (ADR-F5-01).
CREATE UNIQUE INDEX "VersaoAgenteIA_um_rascunho" ON "VersaoAgenteIA" ((1)) WHERE status = 'RASCUNHO';
CREATE UNIQUE INDEX "VersaoAgenteIA_uma_publicada" ON "VersaoAgenteIA" ((1)) WHERE status = 'PUBLICADA';
