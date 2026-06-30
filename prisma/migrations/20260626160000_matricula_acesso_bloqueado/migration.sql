-- Bloqueio de acesso à aula (régua de cobrança D+15, doc 24). ADITIVO e seguro: colunas com
-- default/nullable, não travam linhas existentes nem alteram dados. Flag ortogonal ao status
-- da matrícula (segue ATIVA); enforcement técnico é Fase 1+ — aqui grava-se a decisão humana.
ALTER TABLE "Matricula" ADD COLUMN "acessoBloqueado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Matricula" ADD COLUMN "bloqueadoEm" TIMESTAMP(3);
