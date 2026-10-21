-- Q152: esta coluna timestamp representa instante UTC, como inicio/fim.
-- Não reinterpreta dados passados gravados com fuso local.
ALTER TABLE "DesignacaoSegundaChamada"
  ALTER COLUMN "criadaEm" SET DEFAULT (clock_timestamp() AT TIME ZONE 'UTC');
