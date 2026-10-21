-- Q154 — rascunho de vínculo entre progressão e fechamento final suficiente.
--
-- As colunas são anuláveis para preservar solicitações históricas. A regra só
-- alcança novas aprovações e execuções; não reescreve nem invalida o legado.

ALTER TABLE "SolicitacaoMudancaAcademica"
  ADD COLUMN "fechamentoAcademicoId" TEXT,
  ADD COLUMN "fechamentoEstadoHash" TEXT;
ALTER TABLE "SolicitacaoMudancaAcademica"
  ADD CONSTRAINT "SolicitacaoMudancaAcademica_fechamentoAcademicoId_fkey"
  FOREIGN KEY ("fechamentoAcademicoId") REFERENCES "FechamentoAcademico"(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "SolicitacaoMudancaAcademica_fechamentoAcademicoId_idx"
  ON "SolicitacaoMudancaAcademica" ("fechamentoAcademicoId");

CREATE OR REPLACE FUNCTION "validar_fechamento_progressao_solicitacao"()
RETURNS TRIGGER AS $$
DECLARE
  nivel_origem TEXT;
  regra_origem TEXT;
  fechamento "FechamentoAcademico"%ROWTYPE;
BEGIN
  -- Após a aprovação, inclusive se houver cancelamento posterior, a ligação
  -- usada para decidir a progressão permanece auditável.
  IF TG_OP = 'UPDATE' AND (OLD.status IN ('APROVADA', 'EXECUTADA') OR OLD."fechamentoAcademicoId" IS NOT NULL)
    AND (NEW."fechamentoAcademicoId" IS DISTINCT FROM OLD."fechamentoAcademicoId"
      OR NEW."fechamentoEstadoHash" IS DISTINCT FROM OLD."fechamentoEstadoHash") THEN
    RAISE EXCEPTION 'Fechamento conferido da solicitação deve ser preservado após a decisão';
  END IF;
  -- A solicitação ainda pendente ou um registro histórico preservado não é
  -- bloqueado por este incremento. A aprovação/executação nova, sim, exige
  -- uma versão final suficiente e atual do mesmo vínculo acadêmico.
  IF NEW.status NOT IN ('APROVADA', 'EXECUTADA') THEN
    RETURN NEW;
  END IF;
  IF NEW."matriculaId" IS NULL
    OR NEW."fechamentoAcademicoId" IS NULL
    OR NEW."fechamentoEstadoHash" IS NULL
    OR NEW."fechamentoEstadoHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Aprovação ou execução da progressão exige fechamento acadêmico conferido';
  END IF;

  SELECT t."nivelId", t."regraAvaliacaoId" INTO nivel_origem, regra_origem
    FROM "AlocacaoTurma" a
    JOIN "Turma" t ON t.id = a."turmaId"
    WHERE a.id = NEW."alocacaoOrigemId"
      AND a."matriculaId" = NEW."matriculaId"
    FOR SHARE OF a, t;
  IF nivel_origem IS NULL THEN
    RAISE EXCEPTION 'Alocação de origem não pertence à matrícula da progressão';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'fechamento-academico:' || NEW."matriculaId" || ':' || nivel_origem, 0));

  SELECT * INTO fechamento FROM "FechamentoAcademico"
    WHERE id = NEW."fechamentoAcademicoId" FOR SHARE;
  IF fechamento.id IS NULL
    OR NOT fechamento."resultadoSuficiente"
    OR fechamento."matriculaId" IS DISTINCT FROM NEW."matriculaId"
    OR fechamento."nivelId" IS DISTINCT FROM nivel_origem
    OR fechamento."alocacaoReferenciaId" IS DISTINCT FROM NEW."alocacaoOrigemId"
    OR fechamento."regraId" IS DISTINCT FROM regra_origem
    OR fechamento."estadoHash" IS DISTINCT FROM NEW."fechamentoEstadoHash" THEN
    RAISE EXCEPTION 'Fechamento acadêmico não corresponde à matrícula, nível, alocação, regra ou hash da progressão';
  END IF;
  IF fechamento.versao IS DISTINCT FROM (
    SELECT MAX(f.versao) FROM "FechamentoAcademico" f
    WHERE f."matriculaId" = NEW."matriculaId" AND f."nivelId" = nivel_origem
  ) THEN
    RAISE EXCEPTION 'A progressão exige a versão mais recente do fechamento acadêmico';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Não substitui `conferir_contrato_solicitacao_academica`: os dois guards se
-- complementam. Este dispara nas transições e nos campos de vínculo novos.
CREATE TRIGGER "SolicitacaoMudancaAcademica_validar_fechamento_progressao"
  BEFORE INSERT OR UPDATE OF status, "fechamentoAcademicoId", "fechamentoEstadoHash", "matriculaId", "alocacaoOrigemId", "turmaOrigemId"
  ON "SolicitacaoMudancaAcademica"
  FOR EACH ROW EXECUTE FUNCTION "validar_fechamento_progressao_solicitacao"();
