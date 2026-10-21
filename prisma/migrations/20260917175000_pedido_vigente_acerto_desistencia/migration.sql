-- Q165: uma aplicação deve pertencer ao pedido atual e ser única por matrícula.
-- q165_guard continua conferindo fotografia, condições e decisões; esta guarda
-- adicional impede inserção direta que atravesse pedidos da mesma matrícula.
BEGIN;

CREATE FUNCTION q165_aplicacao_pedido_vigente_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  proposta_registro "PropostaAcertoDesistenciaContratual"%ROWTYPE;
  pedido "PedidoDesistenciaPreparacao"%ROWTYPE;
  matricula_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Aplicação Q165 é imutável';
  END IF;

  -- Esta leitura só descobre a matrícula. Em seguida o lock da matrícula
  -- serializa com o registro do próximo pedido e tudo é relido.
  SELECT pedido_origem."matriculaId" INTO matricula_id
  FROM "DecisaoAcertoDesistenciaContratual" decisao
  JOIN "PropostaAcertoDesistenciaContratual" proposta_origem ON proposta_origem.id=decisao."propostaId"
  JOIN "PedidoDesistenciaPreparacao" pedido_origem ON pedido_origem.id=proposta_origem."pedidoId"
  WHERE decisao.id=NEW."decisaoId";
  IF matricula_id IS NULL THEN
    RAISE EXCEPTION 'Aplicação Q165 exige proposta e pedido existentes';
  END IF;

  PERFORM id FROM "Matricula" WHERE id=matricula_id FOR UPDATE;
  SELECT proposta_atual.* INTO proposta_registro
  FROM "DecisaoAcertoDesistenciaContratual" decisao
  JOIN "PropostaAcertoDesistenciaContratual" proposta_atual ON proposta_atual.id=decisao."propostaId"
  WHERE decisao.id=NEW."decisaoId"
  FOR UPDATE OF proposta_atual;
  SELECT * INTO pedido FROM "PedidoDesistenciaPreparacao" WHERE id=proposta_registro."pedidoId" FOR UPDATE;
  IF proposta_registro.id IS NULL OR pedido.id IS NULL OR pedido."matriculaId" IS DISTINCT FROM matricula_id THEN
    RAISE EXCEPTION 'Aplicação Q165 exige proposta e pedido existentes';
  END IF;

  PERFORM id FROM "PedidoDesistenciaPreparacao"
  WHERE "matriculaId"=pedido."matriculaId"
  ORDER BY versao FOR UPDATE;
  IF EXISTS(
    SELECT 1 FROM "PedidoDesistenciaPreparacao" atual
    WHERE atual."matriculaId"=pedido."matriculaId" AND atual.versao>pedido.versao
  ) THEN
    RAISE EXCEPTION 'Aplicação Q165 exige o pedido de desistência atual';
  END IF;
  IF EXISTS(
    SELECT 1
    FROM "AplicacaoAcertoDesistenciaContratual" aplicacao
    JOIN "DecisaoAcertoDesistenciaContratual" decisao_anterior ON decisao_anterior.id=aplicacao."decisaoId"
    JOIN "PropostaAcertoDesistenciaContratual" proposta_anterior ON proposta_anterior.id=decisao_anterior."propostaId"
    JOIN "PedidoDesistenciaPreparacao" pedido_anterior ON pedido_anterior.id=proposta_anterior."pedidoId"
    WHERE pedido_anterior."matriculaId"=pedido."matriculaId"
  ) THEN
    RAISE EXCEPTION 'A matrícula já possui aplicação Q165 pendente de efetivação';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "AplicacaoAcertoDesistenciaContratual_pedido_vigente_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoAcertoDesistenciaContratual"
  FOR EACH ROW EXECUTE FUNCTION q165_aplicacao_pedido_vigente_guard();

COMMIT;
