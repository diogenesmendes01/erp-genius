-- C5 (doc 27 Onda 3): GESTÃO — alerta de SLA e relatório diário no WhatsApp do gestor.
-- Mensagens para a EQUIPE saem pela mesma outbox/despachante com a nova origem GESTAO
-- (isentas de janela/teto/silêncio; kill switch global congela; shadow próprio na config).

ALTER TYPE "OrigemEnvio" ADD VALUE IF NOT EXISTS 'GESTAO';

ALTER TABLE "ConfigComercial"
  ADD COLUMN "gestaoEstado" "EstadoPolitica" NOT NULL DEFAULT 'DESLIGADA',
  ADD COLUMN "gestaoTelefoneE164" TEXT,
  ADD COLUMN "gestaoNumeroId" TEXT,
  ADD COLUMN "gestaoSlaMinutos" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "gestaoRelatorioHora" INTEGER NOT NULL DEFAULT 19;

ALTER TABLE "ConfigComercial" ADD CONSTRAINT "ConfigComercial_gestaoNumeroId_fkey"
  FOREIGN KEY ("gestaoNumeroId") REFERENCES "NumeroWhatsApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
