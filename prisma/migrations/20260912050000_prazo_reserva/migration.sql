ALTER TABLE "ConfiguracaoOperacional" ADD COLUMN "prazoReservaMinutos" INTEGER;
ALTER TABLE "ConfiguracaoOperacional" ADD CONSTRAINT "ConfiguracaoOperacional_prazoReserva_positivo" CHECK ("prazoReservaMinutos" IS NULL OR "prazoReservaMinutos" > 0);
