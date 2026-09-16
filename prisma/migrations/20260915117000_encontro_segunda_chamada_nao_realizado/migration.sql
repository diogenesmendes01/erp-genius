-- O PostgreSQL só permite utilizar o novo rótulo do enum depois desta migração.
ALTER TYPE "StatusEncontroAgenda" ADD VALUE 'NAO_REALIZADO';
