-- Claim atômico do "1º inbound" da captura comercial C1 (review PR #53 P1): dois inbounds
-- concorrentes do mesmo contato não podem criar dois leads/saudações. Um updateMany
-- condicional (where capturadaEm IS NULL) serializa por lock de linha. Migration aditiva.
ALTER TABLE "ConversaWhatsApp" ADD COLUMN "capturadaEm" TIMESTAMP(3);
