-- Banco separado para a Evolution API (roda só no PRIMEIRO boot do volume do Postgres).
-- App (erp) e Evolution (evolution) não compartilham schema — banco por serviço (gap A5).
CREATE DATABASE evolution;
