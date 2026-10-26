-- D12: geração sob demanda. Fonte em revisão; aplicação exclusiva do integrador.
ALTER TYPE "OrigemChamadaIA" ADD VALUE 'INSIGHT';

CREATE TYPE "EstadoGeracaoInsightInbox" AS ENUM ('PROCESSANDO', 'PRONTA', 'FALHOU', 'INCERTO', 'RECUSADA', 'DESCARTADA');

CREATE TABLE "GeracaoInsightInbox" (
  "id" TEXT NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 0,
  "atendimentoId" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "descartadaPorId" TEXT,
  "descartadaEm" TIMESTAMP(3),
  "chaveTentativa" TEXT NOT NULL,
  "estado" "EstadoGeracaoInsightInbox" NOT NULL DEFAULT 'PROCESSANDO',
  "contextoHash" TEXT NOT NULL,
  "baseHash" TEXT NOT NULL,
  "baseUltimaMensagemId" TEXT,
  "baseQuantidade" INTEGER NOT NULL,
  "configPublicadaId" TEXT,
  "configSnapshotJson" JSONB NOT NULL,
  "precosSnapshotJson" JSONB NOT NULL,
  "modelo" TEXT NOT NULL,
  "provedor" TEXT NOT NULL,
  "simulada" BOOLEAN NOT NULL DEFAULT false,
  "resultadoJson" JSONB,
  "chamadaIAId" TEXT,
  "solicitadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "iniciadaEm" TIMESTAMP(3),
  "geradoEm" TIMESTAMP(3),
  "finalizadoEm" TIMESTAMP(3),
  "erroCodigo" TEXT,
  CONSTRAINT "GeracaoInsightInbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeracaoInsightInbox_chaveTentativa_key" ON "GeracaoInsightInbox"("chaveTentativa");
CREATE UNIQUE INDEX "GeracaoInsightInbox_chamadaIAId_key" ON "GeracaoInsightInbox"("chamadaIAId");
CREATE INDEX "GeracaoInsightInbox_atendimentoId_solicitadoEm_id_idx" ON "GeracaoInsightInbox"("atendimentoId", "solicitadoEm", "id");
-- INCERTO também retém o claim: nova intenção exige descarte explícito, nunca TTL.
CREATE UNIQUE INDEX "GeracaoInsightInbox_claim_ativo_idx" ON "GeracaoInsightInbox"("atendimentoId") WHERE "estado" IN ('PROCESSANDO', 'INCERTO');

-- Restrict é escolha deliberada de retenção: não presumir a mesma política de purga anterior.
ALTER TABLE "GeracaoInsightInbox" ADD CONSTRAINT "GeracaoInsightInbox_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeracaoInsightInbox" ADD CONSTRAINT "GeracaoInsightInbox_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeracaoInsightInbox" ADD CONSTRAINT "GeracaoInsightInbox_descartadaPorId_fkey" FOREIGN KEY ("descartadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeracaoInsightInbox" ADD CONSTRAINT "GeracaoInsightInbox_configPublicadaId_fkey" FOREIGN KEY ("configPublicadaId") REFERENCES "VersaoAgenteIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeracaoInsightInbox" ADD CONSTRAINT "GeracaoInsightInbox_chamadaIAId_fkey" FOREIGN KEY ("chamadaIAId") REFERENCES "ChamadaIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
