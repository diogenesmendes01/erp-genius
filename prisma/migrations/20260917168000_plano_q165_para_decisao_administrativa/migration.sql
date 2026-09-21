-- Q243: uma destinação de recebimento só chega à decisão administrativa Q121
-- depois de plano Q165 aprovado e ainda correspondente à fotografia atual.
BEGIN;

CREATE OR REPLACE FUNCTION "impedir_decisao_desistencia_com_destinacao_fin04_211"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pedido RECORD; plano_id TEXT;
BEGIN
  IF TG_OP='INSERT' AND NEW.aprovada THEN
    SELECT * INTO pedido FROM "PedidoDesistenciaPreparacao" WHERE id=NEW."pedidoId" FOR SHARE;
    IF EXISTS (SELECT 1 FROM "DestinacaoRecebimento" d JOIN "Cobranca" c ON c.id=d."cobrancaId" WHERE c."matriculaId"=pedido."matriculaId") THEN
      SELECT proposta.id INTO plano_id
      FROM "PropostaAcertoDesistenciaContratual" proposta
      JOIN "DecisaoAcertoDesistenciaContratual" decisao ON decisao."propostaId"=proposta.id
      WHERE proposta."pedidoId"=pedido.id AND decisao.aprovada
      ORDER BY decisao."decididaEm" DESC, decisao.id DESC
      LIMIT 1 FOR SHARE;
      IF plano_id IS NULL THEN
        RAISE EXCEPTION 'Aprovação administrativa exige plano Q165 aprovado para a destinação de recebimento.';
      END IF;
      PERFORM q165_fotografia_atual(plano_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMIT;
