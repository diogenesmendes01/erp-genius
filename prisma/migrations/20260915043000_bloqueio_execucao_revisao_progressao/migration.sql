-- A aprovação original não executa uma progressão cuja fonte foi corrigida
-- e ainda está em revisão. Repetir o estado já EXECUTADA não desfaz o passado.
CREATE OR REPLACE FUNCTION impedir_execucao_progressao_com_revisao_209()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status::text <> 'EXECUTADA' OR OLD.status::text = 'EXECUTADA' THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  IF EXISTS (
    SELECT 1 FROM "CasoRevisaoProgressao" caso
    WHERE caso."solicitacaoId" = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM "ItemPropostaResolucaoRevisaoProgressao" item
        JOIN "PropostaResolucaoRevisaoProgressao" proposta ON proposta.id = item."propostaId"
        JOIN "DecisaoResolucaoRevisaoProgressao" decisao ON decisao."propostaId" = proposta.id
        WHERE item."casoId" = caso.id AND decisao.aprovada
          AND proposta.acao::text IN ('REGISTRAR_CANCELAMENTO', 'RECONFIRMAR_EXECUTADA')
      )
  ) THEN
    RAISE EXCEPTION 'Mudança acadêmica possui revisão de correção pendente antes da execução';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SolicitacaoMudancaAcademica_bloquear_revisao_209"
BEFORE UPDATE OF status ON "SolicitacaoMudancaAcademica"
FOR EACH ROW EXECUTE FUNCTION impedir_execucao_progressao_com_revisao_209();
