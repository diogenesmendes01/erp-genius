-- providerRef identifica o número DENTRO do driver (phone_number_id da Meta ×
-- instância Evolution). Duplicado deixaria o roteamento dos webhooks ambíguo —
-- mensagem cairia na conversa/dono errados (review PR #51 P2-6).
-- NULLs seguem permitidos (número ainda sem referência configurada).
CREATE UNIQUE INDEX "NumeroWhatsApp_driver_providerRef_key" ON "NumeroWhatsApp"("driver", "providerRef");
