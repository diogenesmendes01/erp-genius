-- Shadow PRÓPRIO da saudação (review PR #53 2a passada · doc 27 §regra de ouro): a
-- saudação deixa de ser boolean ligado/desligado e ganha DESLIGADA/SHADOW/ATIVA, como as
-- políticas de cobrança. SHADOW registra o que TERIA sido enviado, sem enviar. Forward-only
-- (a tabela ConfigComercial e singleton e normalmente vazia; preserva o toggle anterior).
ALTER TABLE "ConfigComercial" ADD COLUMN "saudacaoEstado" "EstadoPolitica" NOT NULL DEFAULT 'DESLIGADA';
UPDATE "ConfigComercial" SET "saudacaoEstado" = 'ATIVA' WHERE "saudacaoAtiva" = true;
ALTER TABLE "ConfigComercial" DROP COLUMN "saudacaoAtiva";
