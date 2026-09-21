-- 220: bloquear novo envio sem descartar resultado do envio já iniciado.
CREATE OR REPLACE FUNCTION proteger_transicao_substituicao_218() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.estado='CANCELADO' AND NEW.estado<>'CANCELADO' THEN RAISE EXCEPTION 'Processo cancelado não pode ser reaberto'; END IF;
 IF TG_OP='UPDATE' AND OLD.estado<>'CANCELADO' AND NEW.estado='CANCELADO' THEN
  IF EXISTS(SELECT 1 FROM "ConclusaoAssinaturaContratual" WHERE "processoId"=OLD.id) OR NOT EXISTS(SELECT 1 FROM "AplicacaoSubstituicaoContratual" a JOIN "IntencaoCancelamentoAssinatura" i ON i.id=a."intencaoId" WHERE i."processoId"=OLD.id) THEN RAISE EXCEPTION 'Cancelamento exige aplicação comprovada sem assinatura concluída'; END IF;
 END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=NEW."matriculaId") THEN
  IF NOT EXISTS(SELECT 1 FROM "AplicacaoSubstituicaoContratual" WHERE "processoSubstitutoId"=NEW.id) THEN RAISE EXCEPTION 'Novo processo exige aplicação da substituição'; END IF;
 END IF;
 IF NEW.estado IN ('PREPARADO','ENVIANDO') AND fonte_assinada_substituicao_218(NEW.id) THEN RAISE EXCEPTION 'Contrato anterior assinado exige conferência Q117'; END IF;
 RETURN NEW;
END; $$;

