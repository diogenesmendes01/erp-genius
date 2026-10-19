-- SLA (C3 da R1 do #241): momento em que a mensagem de saída foi enviada. statusEm avança com
-- ENTREGUE/LIDA; o D6 (a Aria respondeu no prazo) precisa do envio. Só estrutura: sem UPDATE de dados
-- (o trigger notificar_inbox_mensagem dispara em todo UPDATE de MensagemWhatsApp). As saídas antigas
-- já nasciam enviadas, então o criadoEm delas equivale (COALESCE em alertas-sla.ts).
ALTER TABLE "MensagemWhatsApp" ADD COLUMN "enviadaEm" TIMESTAMP(3);
