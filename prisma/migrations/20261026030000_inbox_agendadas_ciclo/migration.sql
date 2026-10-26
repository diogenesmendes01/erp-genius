-- #362: cobertura genérica de agendadas (IA, CRM e despachante), sem atualizar o atendimento.
-- A migração501 permanece imutável. Seu emissor específico deixa de participar;
-- a função histórica é mantida, sem trigger, para preservar o checkpoint anterior.
BEGIN;

DROP TRIGGER notificar_inbox_agendadas_362 ON "Evento";

CREATE FUNCTION notificar_inbox_agendadas_ciclo_362() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_anterior text;
  v_atual text;
  v_alvos text[] := ARRAY[]::text[];
  v_atendimento text;
  v_conversa text;
  v_payload text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."atendimentoId" IS NOT NULL AND OLD."agendadaPara" IS NOT NULL THEN
      v_anterior := OLD."atendimentoId";
    END IF;
  END IF;
  IF NEW."atendimentoId" IS NOT NULL AND NEW."agendadaPara" IS NOT NULL THEN
    v_atual := NEW."atendimentoId";
  END IF;
  IF v_anterior IS NOT NULL THEN
    v_alvos := array_append(v_alvos, v_anterior);
  END IF;
  IF v_atual IS NOT NULL AND v_atual IS DISTINCT FROM v_anterior THEN
    v_alvos := array_append(v_alvos, v_atual);
  END IF;

  FOREACH v_atendimento IN ARRAY v_alvos LOOP
    SELECT "conversaId" INTO v_conversa
      FROM "AtendimentoWhatsApp" WHERE id = v_atendimento;
    IF v_conversa IS NOT NULL THEN
      -- Protocolo compacto idêntico ao JSON.stringify de avisarAtendimentoAtualizado:
      -- mesma ordem e ausência de espaços; cada valor é escapado pelo PostgreSQL.
      -- O PostgreSQL agrupa avisos byte a byte iguais no mesmo canal e transação,
      -- incluindo o aviso manual já emitido pelo cancelamento333.
      v_payload := '{"tipo":"atendimento.atualizado","atendimentoId":'
        || to_json(v_atendimento)::text
        || ',"mensagemId":null,"conversaId":'
        || to_json(v_conversa)::text || '}';
      PERFORM pg_notify('inbox_eventos', v_payload);
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE TRIGGER notificar_inbox_agendadas_ciclo_362
  AFTER INSERT OR UPDATE ON "IntencaoMensagem"
  FOR EACH ROW EXECUTE FUNCTION notificar_inbox_agendadas_ciclo_362();

COMMIT;
