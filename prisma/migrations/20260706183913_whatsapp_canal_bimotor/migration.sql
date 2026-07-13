-- CreateEnum
CREATE TYPE "DriverWhatsApp" AS ENUM ('META_CLOUD', 'BAILEYS');

-- CreateEnum
CREATE TYPE "FinalidadeNumero" AS ENUM ('COBRANCA', 'VENDAS');

-- CreateEnum
CREATE TYPE "SessaoNumero" AS ENUM ('DESCONECTADO', 'AGUARDANDO_QR', 'CONECTADO', 'CAIU');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('TEXTO', 'IMAGEM', 'AUDIO', 'VIDEO', 'DOCUMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusMensagem" AS ENUM ('NA_FILA', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHOU');

-- CreateEnum
CREATE TYPE "OrigemEnvio" AS ENUM ('HUMANO', 'CRON', 'LOTE');

-- CreateEnum
CREATE TYPE "StatusIntencao" AS ENUM ('PENDENTE', 'DESPACHADA', 'CANCELADA', 'FALHOU', 'ADIADA', 'SIMULADA');

-- CreateEnum
CREATE TYPE "StatusTemplate" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "ModoDegrau" AS ENUM ('AUTOMATICO', 'MANUAL', 'LOTE');

-- CreateEnum
CREATE TYPE "EstadoPolitica" AS ENUM ('DESLIGADA', 'SHADOW', 'ATIVA');

-- CreateTable
CREATE TABLE "NumeroWhatsApp" (
    "id" TEXT NOT NULL,
    "telefoneE164" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "driver" "DriverWhatsApp" NOT NULL,
    "finalidade" "FinalidadeNumero" NOT NULL,
    "sessao" "SessaoNumero" NOT NULL DEFAULT 'DESCONECTADO',
    "donoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumeroWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContatoWhatsApp" (
    "id" TEXT NOT NULL,
    "telefoneE164" TEXT NOT NULL,
    "waId" TEXT,
    "nomeExibicao" TEXT,
    "alunoId" TEXT,
    "responsavelId" TEXT,
    "leadId" TEXT,
    "optOutEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContatoWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversaWhatsApp" (
    "id" TEXT NOT NULL,
    "numeroId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "ultimaMensagemEm" TIMESTAMP(3),
    "ultimoInboundEm" TIMESTAMP(3),
    "naoLidas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversaWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemWhatsApp" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "numeroId" TEXT NOT NULL,
    "direcao" "DirecaoMensagem" NOT NULL,
    "tipo" "TipoMensagem" NOT NULL DEFAULT 'TEXTO',
    "corpo" TEXT,
    "midiaPath" TEXT,
    "status" "StatusMensagem" NOT NULL DEFAULT 'NA_FILA',
    "statusEm" TIMESTAMP(3),
    "driver" "DriverWhatsApp" NOT NULL,
    "origem" "OrigemEnvio",
    "providerMessageId" TEXT,
    "autorId" TEXT,
    "templateId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntencaoMensagem" (
    "id" TEXT NOT NULL,
    "numeroId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "origem" "OrigemEnvio" NOT NULL,
    "status" "StatusIntencao" NOT NULL DEFAULT 'PENDENTE',
    "corpoRenderizado" TEXT NOT NULL,
    "templateId" TEXT,
    "cobrancaId" TEXT,
    "passo" TEXT,
    "politicaId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "despacharAposEm" TIMESTAMP(3),
    "despachadaEm" TIMESTAMP(3),
    "motivoFalha" TEXT,
    "mensagemId" TEXT,
    "autorId" TEXT,

    CONSTRAINT "IntencaoMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateWhatsApp" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "categoria" TEXT NOT NULL DEFAULT 'utility',
    "statusMeta" "StatusTemplate" NOT NULL DEFAULT 'RASCUNHO',
    "metaTemplateId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticaRegua" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "escopo" TEXT NOT NULL DEFAULT 'COBRANCA',
    "estado" "EstadoPolitica" NOT NULL DEFAULT 'DESLIGADA',
    "janelaInicio" INTEGER NOT NULL DEFAULT 9,
    "janelaFim" INTEGER NOT NULL DEFAULT 20,
    "diasSemana" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "tetoPorContatoDia" INTEGER NOT NULL DEFAULT 2,
    "silencioPosInboundHoras" INTEGER NOT NULL DEFAULT 72,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "numeroRemetenteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliticaRegua_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DegrauPolitica" (
    "id" TEXT NOT NULL,
    "politicaId" TEXT NOT NULL,
    "passo" TEXT NOT NULL,
    "offsetDias" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "modo" "ModoDegrau" NOT NULL DEFAULT 'MANUAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT,

    CONSTRAINT "DegrauPolitica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NumeroWhatsApp_telefoneE164_key" ON "NumeroWhatsApp"("telefoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "ContatoWhatsApp_telefoneE164_key" ON "ContatoWhatsApp"("telefoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "ContatoWhatsApp_waId_key" ON "ContatoWhatsApp"("waId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversaWhatsApp_numeroId_contatoId_key" ON "ConversaWhatsApp"("numeroId", "contatoId");

-- CreateIndex
CREATE INDEX "MensagemWhatsApp_conversaId_criadoEm_idx" ON "MensagemWhatsApp"("conversaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemWhatsApp_numeroId_providerMessageId_key" ON "MensagemWhatsApp"("numeroId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "IntencaoMensagem_mensagemId_key" ON "IntencaoMensagem"("mensagemId");

-- CreateIndex
CREATE INDEX "IntencaoMensagem_status_despacharAposEm_idx" ON "IntencaoMensagem"("status", "despacharAposEm");

-- CreateIndex
CREATE UNIQUE INDEX "IntencaoMensagem_cobrancaId_passo_key" ON "IntencaoMensagem"("cobrancaId", "passo");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateWhatsApp_nome_key" ON "TemplateWhatsApp"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticaRegua_nome_key" ON "PoliticaRegua"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "DegrauPolitica_politicaId_passo_key" ON "DegrauPolitica"("politicaId", "passo");

-- CreateIndex
CREATE INDEX "Aluno_telefoneE164_idx" ON "Aluno"("telefoneE164");

-- CreateIndex
CREATE INDEX "Lead_telefoneE164_idx" ON "Lead"("telefoneE164");

-- CreateIndex
CREATE INDEX "Responsavel_telefoneE164_idx" ON "Responsavel"("telefoneE164");

-- AddForeignKey
ALTER TABLE "NumeroWhatsApp" ADD CONSTRAINT "NumeroWhatsApp_donoId_fkey" FOREIGN KEY ("donoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContatoWhatsApp" ADD CONSTRAINT "ContatoWhatsApp_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContatoWhatsApp" ADD CONSTRAINT "ContatoWhatsApp_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Responsavel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContatoWhatsApp" ADD CONSTRAINT "ContatoWhatsApp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaWhatsApp" ADD CONSTRAINT "ConversaWhatsApp_numeroId_fkey" FOREIGN KEY ("numeroId") REFERENCES "NumeroWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaWhatsApp" ADD CONSTRAINT "ConversaWhatsApp_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "ContatoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemWhatsApp" ADD CONSTRAINT "MensagemWhatsApp_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemWhatsApp" ADD CONSTRAINT "MensagemWhatsApp_numeroId_fkey" FOREIGN KEY ("numeroId") REFERENCES "NumeroWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemWhatsApp" ADD CONSTRAINT "MensagemWhatsApp_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemWhatsApp" ADD CONSTRAINT "MensagemWhatsApp_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TemplateWhatsApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_numeroId_fkey" FOREIGN KEY ("numeroId") REFERENCES "NumeroWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "ContatoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TemplateWhatsApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES "PoliticaRegua"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "MensagemWhatsApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticaRegua" ADD CONSTRAINT "PoliticaRegua_numeroRemetenteId_fkey" FOREIGN KEY ("numeroRemetenteId") REFERENCES "NumeroWhatsApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegrauPolitica" ADD CONSTRAINT "DegrauPolitica_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES "PoliticaRegua"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegrauPolitica" ADD CONSTRAINT "DegrauPolitica_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TemplateWhatsApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
