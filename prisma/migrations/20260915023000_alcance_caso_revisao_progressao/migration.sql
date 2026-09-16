-- Q154 — o item imutável de impacto também precisa provar, no banco, que a
-- solicitação está na cadeia de equivalências aplicadas da fonte corrigida.
-- A migration 196 permanece como guard de conteúdo, matrícula e imutabilidade.

CREATE OR REPLACE FUNCTION "validar_alcance_caso_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  matricula_pedido TEXT;
  alocacao_origem_pedido TEXT;
BEGIN
  SELECT "matriculaId", "alocacaoOrigemId"
    INTO matricula_pedido, alocacao_origem_pedido
    FROM "SolicitacaoMudancaAcademica"
    WHERE id = NEW."solicitacaoId"
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação da revisão não encontrada';
  END IF;

  -- Reproduz a pré-condição da coleta: a fonte é uma alocação identificada
  -- desta matrícula, nunca uma alocação inferida de outro contrato.
  PERFORM 1 FROM "AlocacaoTurma"
    WHERE id = NEW."alocacaoFonteId" AND "matriculaId" = NEW."matriculaId"
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alocação fonte não pertence à matrícula da revisão';
  END IF;

  IF matricula_pedido IS NULL THEN
    -- Legado sem matrícula não pode ser ligado por cadeia: conserva somente o
    -- impacto direto que o coletor também permite.
    IF NEW."alocacaoFonteId" IS DISTINCT FROM alocacao_origem_pedido THEN
      RAISE EXCEPTION 'Solicitação legada só aceita correção da alocação de origem';
    END IF;
    RETURN NEW;
  END IF;

  IF matricula_pedido IS DISTINCT FROM NEW."matriculaId" THEN
    RAISE EXCEPTION 'Solicitação não pertence à matrícula da revisão';
  END IF;
  PERFORM 1 FROM "AlocacaoTurma"
    WHERE id = alocacao_origem_pedido AND "matriculaId" = NEW."matriculaId"
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alocação de origem da solicitação não pertence à matrícula da revisão';
  END IF;

  -- UNION, e não UNION ALL, encerra qualquer ciclo de dados históricos. Cada
  -- aresta reproduz os predicados do coletor TypeScript: aplicação e proposta
  -- da mesma matrícula, decisão aprovada e turmas/aloações coerentes.
  IF NOT EXISTS (
    WITH RECURSIVE alcance("alocacaoId") AS (
      SELECT NEW."alocacaoFonteId"
      UNION
      SELECT aplicacao."alocacaoDestinoId"
        FROM "AplicacaoEquivalenciaAvaliacao" aplicacao
        JOIN "DecisaoEquivalenciaAvaliacao" decisao
          ON decisao.id = aplicacao."decisaoId" AND decisao.aprovada
        JOIN "PropostaEquivalenciaAvaliacao" proposta
          ON proposta.id = decisao."propostaId"
        JOIN "AlocacaoTurma" origem
          ON origem.id = aplicacao."alocacaoOrigemId"
        JOIN "AlocacaoTurma" destino
          ON destino.id = aplicacao."alocacaoDestinoId"
        JOIN alcance anterior
          ON anterior."alocacaoId" = aplicacao."alocacaoOrigemId"
       WHERE aplicacao."matriculaId" = NEW."matriculaId"
         AND proposta."matriculaId" = NEW."matriculaId"
         AND proposta."alocacaoOrigemId" = aplicacao."alocacaoOrigemId"
         AND proposta."turmaOrigemId" = aplicacao."turmaOrigemId"
         AND proposta."turmaDestinoId" = aplicacao."turmaDestinoId"
         AND origem."matriculaId" = NEW."matriculaId"
         AND destino."matriculaId" = NEW."matriculaId"
         AND origem."turmaId" = aplicacao."turmaOrigemId"
         AND destino."turmaId" = aplicacao."turmaDestinoId"
    )
    SELECT 1 FROM alcance WHERE "alocacaoId" = alocacao_origem_pedido
  ) THEN
    RAISE EXCEPTION 'A solicitação não é alcançada por equivalência aplicada da fonte corrigida';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CasoRevisaoProgressao_validar_alcance"
  BEFORE INSERT ON "CasoRevisaoProgressao"
  FOR EACH ROW EXECUTE FUNCTION "validar_alcance_caso_revisao_progressao"();
