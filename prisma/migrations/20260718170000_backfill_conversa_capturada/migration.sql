-- BACKFILL de seguranca de upgrade (review PR #53 2a passada): a coluna capturadaEm
-- nasceu NULL para todo o historico. Sem este backfill, o PROXIMO inbound de uma conversa
-- ANTIGA venceria o claim e seria tratado como "1o inbound" — criando lead e enviando
-- saudacao para contatos JA em atendimento.
--
-- Marca como capturada toda conversa que ja teve inbound (ultimoInboundEm IS NOT NULL),
-- preservando NULL apenas para conversas ainda sem inbound (essas SIM devem capturar no 1o).
-- Idempotente: em deploy novo a tabela esta vazia (no-op); em upgrade corrige o historico.
UPDATE "ConversaWhatsApp"
SET "capturadaEm" = "ultimoInboundEm"
WHERE "capturadaEm" IS NULL AND "ultimoInboundEm" IS NOT NULL;
