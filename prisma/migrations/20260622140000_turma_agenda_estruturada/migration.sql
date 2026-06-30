-- Agenda estruturada da turma (doc 06/09): dias da semana + horário (calendário real),
-- além do rótulo derivado `diasHorario` já existente. Aditivo e seguro: turmas antigas
-- ficam com diasSemana vazio e horario null (a preencher na edição).
ALTER TABLE "Turma" ADD COLUMN "diasSemana" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Turma" ADD COLUMN "horario" TEXT;
