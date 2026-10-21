-- Configuração operacional é singleton; as referências escolhidas para agenda
-- não podem ser compartilhadas por registros operacionais futuros.
CREATE UNIQUE INDEX "ConfiguracaoOperacional_numeroAvisosAgendaId_key"
  ON "ConfiguracaoOperacional"("numeroAvisosAgendaId");

CREATE UNIQUE INDEX "ConfiguracaoOperacional_templateAvisosAgendaId_key"
  ON "ConfiguracaoOperacional"("templateAvisosAgendaId");
