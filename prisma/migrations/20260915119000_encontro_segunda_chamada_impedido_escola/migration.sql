-- O novo valor é aplicado separadamente para poder ser usado com segurança
-- pelos guards da migração seguinte no PostgreSQL.
ALTER TYPE "StatusEncontroAgenda" ADD VALUE 'IMPEDIDO_ESCOLA';
