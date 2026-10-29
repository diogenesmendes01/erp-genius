ALTER TABLE "IntencaoMensagem" ADD COLUMN "perguntarSeResponder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IntencaoMensagem" ADD COLUMN "confirmadaAposRespostaEm" TIMESTAMP(3);
