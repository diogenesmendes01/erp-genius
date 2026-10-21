ALTER TABLE "ProdutoPais"
 ADD COLUMN "versaoEntrada" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "taxaPreviaAssinatura" BOOLEAN,
 ADD COLUMN "adiantamentoHoraExigido" BOOLEAN,
 ADD CONSTRAINT "ProdutoPais_versaoEntrada_check" CHECK ("versaoEntrada" >= 0);
