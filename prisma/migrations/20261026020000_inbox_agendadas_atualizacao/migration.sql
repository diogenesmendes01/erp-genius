-- #362: avisar alterações de agendadas sem atualizar ou promover o lock do atendimento.
-- Conteúdo do aviso restrito ao contrato de ids do canal; entrega apenas no commit.
CREATE FUNCTION notificar_inbox_agendadas_362() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_conversa text;
BEGIN
  SELECT "conversaId" INTO v_conversa
    FROM "AtendimentoWhatsApp" WHERE id = NEW."agregadoId";
  IF v_conversa IS NOT NULL THEN
    PERFORM pg_notify('inbox_eventos', json_build_object(
      'tipo', 'atendimento.atualizado',
      'atendimentoId', NEW."agregadoId",
      'mensagemId', NULL,
      'conversaId', v_conversa
    )::text);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER notificar_inbox_agendadas_362
  AFTER INSERT ON "Evento"
  FOR EACH ROW
  WHEN (NEW."agregadoTipo" = 'AtendimentoWhatsApp'
    AND NEW."tipo" IN ('MensagemAgendada', 'MensagemReagendada')
    AND NEW."payload" ->> 'contexto' = 'inbox362')
  EXECUTE FUNCTION notificar_inbox_agendadas_362();
