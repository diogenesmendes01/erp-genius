-- Q21/Q146-Q149: um encontro SEGUNDA_CHAMADA só pode nascer das aplicações
-- atômicas de agenda inicial (125) ou de remarcação (121). Não há desvio legado.
CREATE FUNCTION conferir_origem_encontro_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE autorizado BOOLEAN := false;
BEGIN
 IF TG_OP='DELETE' THEN
   IF OLD.finalidade='SEGUNDA_CHAMADA' THEN
     RAISE EXCEPTION 'Encontro de segunda chamada não pode ser apagado';
   END IF;
   RETURN OLD;
 END IF;

 IF TG_OP='UPDATE' THEN
   IF OLD.finalidade='SEGUNDA_CHAMADA' OR NEW.finalidade='SEGUNDA_CHAMADA' THEN
     IF OLD.finalidade IS DISTINCT FROM NEW.finalidade
       OR (to_jsonb(OLD)-'status') IS DISTINCT FROM (to_jsonb(NEW)-'status') THEN
       RAISE EXCEPTION 'Origem e dados do encontro de segunda chamada são imutáveis';
     END IF;
     IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
     IF pg_trigger_depth()<=1 OR OLD.status<>'PREVISTO' THEN
       RAISE EXCEPTION 'Transição de segunda chamada exige fato terminal aplicado';
     END IF;
     IF NEW.status='MINISTRADO' AND EXISTS(
       SELECT 1 FROM "AgendaSegundaChamada" a JOIN "ReservaSegundaChamada" r ON r.id=a."reservaId"
       JOIN "RealizacaoSegundaChamada" x ON x."reservaId"=r.id
       WHERE a."encontroId"=OLD.id AND r.status='CONSUMIDA_REALIZACAO'
         AND x."professorId" IS NOT DISTINCT FROM OLD."professorId" AND x."realizadaEm">=OLD.inicio AND x."realizadaEm"<OLD.fim
     ) THEN RETURN NEW; END IF;
     IF NEW.status='NAO_REALIZADO' AND EXISTS(
       SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id
         AND falta_agenda_segunda_chamada_valida(a."reservaId",OLD.id)
     ) THEN RETURN NEW; END IF;
     IF NEW.status='IMPEDIDO_ESCOLA' AND EXISTS(
       SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id
         AND impedimento_escola_agenda_segunda_chamada_valido(a."reservaId",OLD.id)
     ) THEN RETURN NEW; END IF;
     IF NEW.status='CANCELADO' AND (
       EXISTS(SELECT 1 FROM "AgendaSegundaChamada" a WHERE a."encontroId"=OLD.id AND cancelamento_agenda_segunda_chamada_aprovado_valido(a."reservaId",OLD.id))
       OR EXISTS(SELECT 1 FROM "AplicacaoRemarcacaoAgendaSegundaChamada" x WHERE x."encontroOriginalId"=OLD.id)
     ) THEN RETURN NEW; END IF;
     RAISE EXCEPTION 'Transição de segunda chamada sem fato terminal correspondente';
   END IF;
   RETURN NEW;
 END IF;

 IF NEW.finalidade<>'SEGUNDA_CHAMADA' THEN RETURN NEW; END IF;
 IF NEW.status<>'PREVISTO' OR pg_trigger_depth()<=1 THEN
   RAISE EXCEPTION 'Encontro de segunda chamada exige aplicação atômica aprovada';
 END IF;

 IF NEW."propostaAgendaSegundaChamadaId" IS NOT NULL THEN
   SELECT EXISTS(
     SELECT 1 FROM "PropostaAgendaSegundaChamada" p
     JOIN "DecisaoAgendaSegundaChamada" d ON d."propostaId"=p.id AND d.aprovada AND d."encontroId" IS NULL
     WHERE p.id=NEW."propostaAgendaSegundaChamadaId"
   ) INTO autorizado;
 ELSE
   SELECT EXISTS(
     SELECT 1 FROM "DecisaoRemarcacaoAgendaSegundaChamada" d
     JOIN "PropostaRemarcacaoAgendaSegundaChamada" p ON p.id=d."propostaId"
     JOIN "ReservaSegundaChamada" r ON r.id=p."reservaId" AND r.status='RESERVADA'
     JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id
     JOIN "EncontroAgenda" antigo ON antigo.id=a."encontroId" AND antigo.finalidade='SEGUNDA_CHAMADA' AND antigo.status='PREVISTO'
     WHERE d.aprovada AND d."encontroNovoId" IS NULL
       AND NEW."turmaId" IS NOT DISTINCT FROM antigo."turmaId"
       AND NEW."matriculaId" IS NOT DISTINCT FROM antigo."matriculaId"
       AND NEW."professorId" IS NOT DISTINCT FROM antigo."professorId"
       AND NEW.inicio=p.inicio AND NEW.fim=p.fim AND NEW."fusoOrigem"=p."fusoOrigem"
   ) INTO autorizado;
 END IF;
 IF NOT autorizado THEN RAISE EXCEPTION 'Encontro de segunda chamada sem cadeia de aplicação aprovada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_origem_encontro_segunda_chamada
BEFORE INSERT OR UPDATE OR DELETE ON "EncontroAgenda"
FOR EACH ROW EXECUTE FUNCTION conferir_origem_encontro_segunda_chamada();

-- A verificação deferred fecha a janela interna: o encontro só subsiste se a
-- mesma transação materializou sua aplicação e todos os vínculos correspondentes.
CREATE FUNCTION conferir_origem_encontro_segunda_chamada_final() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.finalidade<>'SEGUNDA_CHAMADA' THEN RETURN NEW; END IF;
 IF NOT (
   EXISTS(
     SELECT 1 FROM "AplicacaoAgendaSegundaChamada" x
     JOIN "DecisaoAgendaSegundaChamada" d ON d.id=x."decisaoId" AND d.aprovada AND d."encontroId"=NEW.id
     JOIN "PropostaAgendaSegundaChamada" p ON p.id=d."propostaId" AND NEW."propostaAgendaSegundaChamadaId"=p.id
     JOIN "AgendaSegundaChamada" a ON a.id=x."agendaId" AND a."reservaId"=x."reservaId" AND a."encontroId"=NEW.id
     JOIN "ReservaSegundaChamada" r ON r.id=x."reservaId" AND r."propostaId"=p."propostaSegundaChamadaId"
     WHERE x."encontroId"=NEW.id
   )
   OR EXISTS(
     SELECT 1 FROM "AplicacaoRemarcacaoAgendaSegundaChamada" x
     JOIN "DecisaoRemarcacaoAgendaSegundaChamada" d ON d.id=x."decisaoId" AND d.aprovada AND d."encontroNovoId"=NEW.id
     JOIN "AgendaSegundaChamada" a ON a."encontroId"=NEW.id
     WHERE x."encontroNovoId"=NEW.id
   )
 ) THEN RAISE EXCEPTION 'Encontro de segunda chamada sem aplicação atômica finalizada'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER conferir_origem_encontro_segunda_chamada_final
AFTER INSERT ON "EncontroAgenda" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION conferir_origem_encontro_segunda_chamada_final();
