CREATE TABLE "TarefaNotificado" (
    "tarefaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "TarefaNotificado_pkey" PRIMARY KEY ("tarefaId", "usuarioId")
);

CREATE INDEX "TarefaNotificado_usuarioId_idx" ON "TarefaNotificado"("usuarioId");

ALTER TABLE "TarefaNotificado" ADD CONSTRAINT "TarefaNotificado_tarefaId_fkey"
    FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TarefaNotificado" ADD CONSTRAINT "TarefaNotificado_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;