-- Configuração explícita do canal institucional de agenda. A finalidade nova
-- é adicionada isoladamente: nenhuma regra desta migração a usa na mesma
-- transação, pois PostgreSQL não permite usar valor novo de enum antes do commit.
ALTER TYPE "FinalidadeNumero" ADD VALUE IF NOT EXISTS 'AGENDA';

ALTER TABLE "ConfiguracaoOperacional"
  ADD COLUMN IF NOT EXISTS "numeroAvisosAgendaId" TEXT,
  ADD COLUMN IF NOT EXISTS "templateAvisosAgendaId" TEXT;

ALTER TABLE "IntencaoMensagem"
  ADD COLUMN IF NOT EXISTS "avisoAlteracaoAgendaId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "IntencaoMensagem_avisoAlteracaoAgendaId_key"
  ON "IntencaoMensagem"("avisoAlteracaoAgendaId");

ALTER TABLE "ConfiguracaoOperacional"
  ADD CONSTRAINT "ConfiguracaoOperacional_numeroAvisosAgendaId_fkey"
  FOREIGN KEY ("numeroAvisosAgendaId") REFERENCES "NumeroWhatsApp"(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConfiguracaoOperacional"
  ADD CONSTRAINT "ConfiguracaoOperacional_templateAvisosAgendaId_fkey"
  FOREIGN KEY ("templateAvisosAgendaId") REFERENCES "TemplateWhatsApp"(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntencaoMensagem"
  ADD CONSTRAINT "IntencaoMensagem_avisoAlteracaoAgendaId_fkey"
  FOREIGN KEY ("avisoAlteracaoAgendaId") REFERENCES "AvisoAlteracaoAgenda"(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
