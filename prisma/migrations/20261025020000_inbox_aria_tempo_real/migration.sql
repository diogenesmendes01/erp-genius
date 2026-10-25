-- Inbox #345: invalidações da Aria, só IDs; NOTIFY é entregue no commit.
-- Objetos novos, sem redefinir notificar_inbox ou alterar dados existentes.
BEGIN;

CREATE FUNCTION notificar_inbox_acao_ia() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_conversa text;
BEGIN
  IF NEW."atendimentoId" IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW."status" IS NOT DISTINCT FROM OLD."status" THEN RETURN NULL; END IF;
  SELECT "conversaId" INTO v_conversa FROM "AtendimentoWhatsApp" WHERE "id" = NEW."atendimentoId";
  PERFORM pg_notify('inbox_eventos', json_build_object(
    'tipo', 'atendimento.atualizado',
    'atendimentoId', NEW."atendimentoId",
    'mensagemId', NULL,
    'conversaId', v_conversa
  )::text);
  RETURN NULL;
END $$;

CREATE TRIGGER notificar_inbox_acao_ia AFTER INSERT OR UPDATE OF "status" ON "AcaoAgenteIA"
  FOR EACH ROW EXECUTE FUNCTION notificar_inbox_acao_ia();

CREATE FUNCTION notificar_inbox_agente_ia() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."estado" IS NOT DISTINCT FROM OLD."estado"
    AND NEW."pausadoEm" IS NOT DISTINCT FROM OLD."pausadoEm" THEN RETURN NULL; END IF;
  PERFORM pg_notify('inbox_eventos', json_build_object(
    'tipo', 'aria.global',
    'atendimentoId', NULL,
    'mensagemId', NULL,
    'conversaId', ''
  )::text);
  RETURN NULL;
END $$;

CREATE TRIGGER notificar_inbox_agente_ia AFTER UPDATE ON "AgenteIA"
  FOR EACH ROW EXECUTE FUNCTION notificar_inbox_agente_ia();

COMMIT;
