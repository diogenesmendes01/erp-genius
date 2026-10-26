-- PROPOSTA D6 / reserva ROOT496. NÃO APLICADA pelo DEV.
-- Uma row por usuário/aba. Só lifecycle explícito Inbox escreve; nunca ultimoAcesso ERP.
CREATE TABLE "PresencaInbox" (
 "id" TEXT NOT NULL,
 "usuarioId" TEXT NOT NULL,
 "abaId" UUID NOT NULL,
 "aberturaId" UUID NOT NULL,
 "geracao" BIGINT NOT NULL DEFAULT 1,
 "sequencia" BIGINT NOT NULL DEFAULT 0,
 "confirmadaEm" TIMESTAMP(3),
 "ultimoContatoEm" TIMESTAMP(3) NOT NULL,
 "ultimaInteracaoEm" TIMESTAMP(3),
 "desconectadaEm" TIMESTAMP(3),
 "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "atualizadaEm" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PresencaInbox_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PresencaInbox_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
 CONSTRAINT "PresencaInbox_contadores_check" CHECK ("geracao">=1 AND "sequencia">=0),
 CONSTRAINT "PresencaInbox_ordem_temporal_check" CHECK (
   ("confirmadaEm" IS NULL OR "confirmadaEm"<="ultimoContatoEm") AND
   ("ultimaInteracaoEm" IS NULL OR "ultimaInteracaoEm"<="ultimoContatoEm") AND
   ("desconectadaEm" IS NULL OR "desconectadaEm">="ultimoContatoEm")
 )
);
CREATE UNIQUE INDEX "PresencaInbox_usuarioId_abaId_key" ON "PresencaInbox"("usuarioId","abaId");
CREATE INDEX "PresencaInbox_usuarioId_desconectadaEm_ultimoContatoEm_idx" ON "PresencaInbox"("usuarioId","desconectadaEm","ultimoContatoEm");
CREATE INDEX "PresencaInbox_ultimoContatoEm_idx" ON "PresencaInbox"("ultimoContatoEm");
