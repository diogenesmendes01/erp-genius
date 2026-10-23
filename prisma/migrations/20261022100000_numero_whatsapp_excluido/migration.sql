-- Exclusão de número do WhatsApp pela configuração (sem apagar dados).
--
-- O número excluído some da tela de Números, mas conversas, mensagens, intenções e Eventos continuam
-- ligados a ele. Quem excluiu fica no Evento NumeroWhatsAppExcluido. Um número excluído é sempre
-- inativo e desconectado; recadastrar o mesmo telefone limpa a marca.
ALTER TABLE "NumeroWhatsApp" ADD COLUMN "excluidoEm" TIMESTAMP(3);

ALTER TABLE "NumeroWhatsApp" ADD CONSTRAINT "NumeroWhatsApp_excluido_inativo_check"
  CHECK ("excluidoEm" IS NULL OR "ativo" = false);
