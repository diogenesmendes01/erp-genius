-- AlterTable
ALTER TABLE "IntencaoMensagem" ADD COLUMN "clientMessageId" TEXT,
ADD COLUMN "conteudo" JSONB;

-- AlterTable
ALTER TABLE "MensagemWhatsApp" ADD COLUMN "mensagemIdMotor" TEXT,
ADD COLUMN "editadaEm" TIMESTAMP(3),
ADD COLUMN "apagadaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReacaoMensagemWhatsApp" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "autorJid" TEXT NOT NULL,
    "deMim" BOOLEAN NOT NULL,
    "emoji" TEXT NOT NULL,
    "usuarioId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReacaoMensagemWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoMotorRecebido" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "idEvento" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numeroRef" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL,
    "dados" JSONB NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" TIMESTAMP(3),
    "processadoEm" TIMESTAMP(3),
    "resultado" TEXT,

    CONSTRAINT "EventoMotorRecebido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntencaoMensagem_clientMessageId_key" ON "IntencaoMensagem"("clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ReacaoMensagemWhatsApp_mensagemId_autorJid_key" ON "ReacaoMensagemWhatsApp"("mensagemId", "autorJid");

-- CreateIndex
CREATE UNIQUE INDEX "EventoMotorRecebido_seq_key" ON "EventoMotorRecebido"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "EventoMotorRecebido_idEvento_key" ON "EventoMotorRecebido"("idEvento");

-- CreateIndex
CREATE INDEX "EventoMotorRecebido_processadoEm_seq_idx" ON "EventoMotorRecebido"("processadoEm", "seq");

-- AddForeignKey
ALTER TABLE "ReacaoMensagemWhatsApp" ADD CONSTRAINT "ReacaoMensagemWhatsApp_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "MensagemWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ambiente em teste (decisão 1): números de outros drivers ficam desativados, sem cópia de dados.
UPDATE "NumeroWhatsApp" SET ativo = false, sessao = 'DESCONECTADO' WHERE driver <> 'MOTOR';
