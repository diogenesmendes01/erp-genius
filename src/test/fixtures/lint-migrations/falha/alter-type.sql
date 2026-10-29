ALTER TABLE "Usuario"
  ALTER COLUMN "limiteDescontoPct" TYPE DECIMAL(5,2) USING ROUND("limiteDescontoPct"::numeric, 2);
