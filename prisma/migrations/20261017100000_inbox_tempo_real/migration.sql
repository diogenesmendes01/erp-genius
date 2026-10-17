-- E6: índices de cursor do inbox e aviso de tempo real (LISTEN/NOTIFY, só ids).

-- CreateIndex
CREATE INDEX "AtendimentoWhatsApp_ultimaMensagemEm_id_idx" ON "AtendimentoWhatsApp"("ultimaMensagemEm" DESC, "id");

-- CreateIndex
CREATE INDEX "MensagemWhatsApp_atendimentoId_criadoEm_id_idx" ON "MensagemWhatsApp"("atendimentoId", "criadoEm", "id");

-- Aviso sem conteúdo: só tipo e ids. O NOTIFY é entregue apenas no commit (rollback não avisa).
CREATE FUNCTION notificar_inbox() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_tipo text;
  v_atendimento text;
  v_mensagem text;
BEGIN
  IF TG_TABLE_NAME = 'MensagemWhatsApp' THEN
    v_mensagem := NEW."id";
    v_atendimento := NEW."atendimentoId";
    IF TG_OP = 'INSERT' THEN
      v_tipo := 'mensagem.nova';
    ELSIF NEW."status" IS DISTINCT FROM OLD."status" THEN
      v_tipo := 'mensagem.status';
    ELSIF NEW."atendimentoId" IS DISTINCT FROM OLD."atendimentoId" THEN
      v_tipo := 'atendimento.atualizado';
    ELSE
      RETURN NULL;
    END IF;
    PERFORM pg_notify('inbox_eventos', json_build_object('tipo', v_tipo, 'atendimentoId', v_atendimento, 'mensagemId', v_mensagem, 'conversaId', NEW."conversaId")::text);
  ELSE
    PERFORM pg_notify('inbox_eventos', json_build_object('tipo', 'atendimento.atualizado', 'atendimentoId', NEW."id", 'mensagemId', NULL, 'conversaId', NEW."conversaId")::text);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER notificar_inbox_mensagem AFTER INSERT OR UPDATE ON "MensagemWhatsApp"
  FOR EACH ROW EXECUTE FUNCTION notificar_inbox();

CREATE TRIGGER notificar_inbox_atendimento AFTER UPDATE ON "AtendimentoWhatsApp"
  FOR EACH ROW EXECUTE FUNCTION notificar_inbox();
