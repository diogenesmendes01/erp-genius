-- Instante da última transição da intenção (review PR #52): a saúde do canal mede
-- "falhas nas últimas 24h" pelo momento da FALHA, não pela criação da intenção.
-- DEFAULT preenche as linhas existentes; daqui em diante o client (@updatedAt) mantém.
ALTER TABLE "IntencaoMensagem" ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
