-- Aula passa a ter intervalo de horário: início + fim (ex.: 19:00–21:00). Renomeia o
-- `horario` (recém-criado, ainda sem dados) para `horarioInicio` e adiciona `horarioFim`.
ALTER TABLE "Turma" RENAME COLUMN "horario" TO "horarioInicio";
ALTER TABLE "Turma" ADD COLUMN "horarioFim" TEXT;
