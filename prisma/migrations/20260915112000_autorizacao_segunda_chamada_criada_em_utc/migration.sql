-- Q151/Q148: a vigência da autorização compara fatos UTC; o default não pode
-- depender do fuso da sessão do banco.
ALTER TABLE "AutorizacaoEspecialSegundaChamada"
  ALTER COLUMN "criadaEm" SET DEFAULT (clock_timestamp() AT TIME ZONE 'UTC');
