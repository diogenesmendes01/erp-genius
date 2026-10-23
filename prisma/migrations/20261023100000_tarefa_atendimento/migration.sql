-- Vínculo opcional da tarefa ao atendimento (#322). As tarefas anteriores permanecem com NULL.
ALTER TABLE "Tarefa" ADD COLUMN "atendimentoId" TEXT;
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
