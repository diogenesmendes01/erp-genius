-- "Editar nome" na inbox: marca que a equipe definiu ou limpou o nome salvo do contato. Depois disso,
-- os fluxos do ERP (cobrança, avisos de agenda, abrir atendimento) não voltam a preencher o nome.
ALTER TABLE "ContatoWhatsApp" ADD COLUMN "nomeEditadoEm" TIMESTAMP(3);
