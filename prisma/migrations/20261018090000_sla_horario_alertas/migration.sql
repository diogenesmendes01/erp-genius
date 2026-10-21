-- SLA (P5 da Task 39): horário de atendimento por setor e alerta único de prazo estourado.
-- Só estrutura: nenhum UPDATE de dados (um UPDATE em AtendimentoWhatsApp dispararia notificar_inbox em massa).
ALTER TYPE "TipoNotificacao" ADD VALUE 'SLA_ESTOURADO';

-- Calendário do setor (JSON validado por HorarioAtendimentoSchema); nulo = sem horário, contagem corrida.
ALTER TABLE "PrazoRespostaSetor" ADD COLUMN "horario" JSONB;

-- Claim do alerta: marcado uma vez por atendimento (como Tarefa.lembreteDisparadoEm).
ALTER TABLE "AtendimentoWhatsApp" ADD COLUMN "slaAlertadoEm" TIMESTAMP(3);
CREATE INDEX "AtendimentoWhatsApp_sla_pendente_idx" ON "AtendimentoWhatsApp"("prazoRespostaEm")
  WHERE "primeiraRespostaEm" IS NULL AND "slaAlertadoEm" IS NULL AND "status" <> 'ENCERRADO';

-- Duas notificações do mesmo aviso na mesma transação (responsável e gerente) têm o mesmo now():
-- a unicidade passa a incluir o destinatário.
DROP INDEX "NotificacaoUsuario_tipo_refId_criadaEm_key";
CREATE UNIQUE INDEX "NotificacaoUsuario_tipo_refId_usuarioId_criadaEm_key" ON "NotificacaoUsuario"("tipo", "refId", "usuarioId", "criadaEm");
