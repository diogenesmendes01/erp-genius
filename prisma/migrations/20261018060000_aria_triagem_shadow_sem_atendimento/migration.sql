-- Triagem simulada em SHADOW: o turno TRIAGEM e a ação CLASSIFICAR_SETOR SIMULADA
-- são gravados antes de existir atendimento. A FK continua Restrict.
ALTER TABLE "TurnoAgenteIA" ALTER COLUMN "atendimentoId" DROP NOT NULL;
ALTER TABLE "AcaoAgenteIA" ALTER COLUMN "atendimentoId" DROP NOT NULL;
