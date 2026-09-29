-- Nome de perfil do WhatsApp separado do nome dado pelo ERP (bug de produção 29/09/2026).
-- `nomeExibicao` misturava o nome do cadastro com o pushName dos webhooks, e o pushName de
-- mensagem enviada pelo celular da linha (fromMe) é o perfil de QUEM ENVIOU: conversas iniciadas
-- pelo celular ficavam com o nome do dono da linha.
ALTER TABLE "ContatoWhatsApp" ADD COLUMN "nomePerfil" TEXT;

-- Legado: contato sem vínculo no ERP e sem nenhuma intenção originada pelo ERP (cobrança, aviso,
-- alerta de gestão) só pode ter recebido o nome de um webhook, então esse nome é perfil, não cadastro.
UPDATE "ContatoWhatsApp" c
SET "nomePerfil" = c."nomeExibicao", "nomeExibicao" = NULL
WHERE c."nomeExibicao" IS NOT NULL
  AND c."alunoId" IS NULL AND c."responsavelId" IS NULL AND c."leadId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "IntencaoMensagem" i WHERE i."contatoId" = c."id");
