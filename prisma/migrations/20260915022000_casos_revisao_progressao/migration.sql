-- Q154 — fatos imutáveis de revisão após correção que pode alcançar uma
-- progressão já aprovada ou executada. A resolução futura é outro fato.

CREATE TABLE "CasoRevisaoProgressao" (
  "id" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "solicitacaoId" TEXT NOT NULL,
  "decisaoCorrecaoNotaId" TEXT,
  "decisaoCorrecaoRecuperacaoId" TEXT,
  "alocacaoFonteId" TEXT NOT NULL,
  "snapshotImpacto" JSONB NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "CasoRevisaoProgressao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CasoRevisaoProgressao_fonte_exclusiva_check"
    CHECK (num_nonnulls("decisaoCorrecaoNotaId", "decisaoCorrecaoRecuperacaoId") = 1),
  CONSTRAINT "CasoRevisaoProgressao_snapshotImpacto_objeto_check"
    CHECK (jsonb_typeof("snapshotImpacto") = 'object'),
  CONSTRAINT "CasoRevisaoProgressao_snapshotImpacto_estado_check"
    CHECK (COALESCE("snapshotImpacto" ->> 'status' IN ('APROVADA', 'EXECUTADA'), FALSE))
);

CREATE UNIQUE INDEX "CasoRevisaoProgressao_solicitacao_decisaoNota_key"
  ON "CasoRevisaoProgressao" ("solicitacaoId", "decisaoCorrecaoNotaId");
CREATE UNIQUE INDEX "CasoRevisaoProgressao_solicitacao_decisaoRecuperacao_key"
  ON "CasoRevisaoProgressao" ("solicitacaoId", "decisaoCorrecaoRecuperacaoId");
CREATE INDEX "CasoRevisaoProgressao_matricula_criada_idx"
  ON "CasoRevisaoProgressao" ("matriculaId", "criadaEm");
CREATE INDEX "CasoRevisaoProgressao_alocacaoFonte_criada_idx"
  ON "CasoRevisaoProgressao" ("alocacaoFonteId", "criadaEm");

ALTER TABLE "CasoRevisaoProgressao"
  ADD CONSTRAINT "CasoRevisaoProgressao_matriculaId_fkey"
  FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "CasoRevisaoProgressao_solicitacaoId_fkey"
  FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoMudancaAcademica"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "CasoRevisaoProgressao_decisaoCorrecaoNotaId_fkey"
  FOREIGN KEY ("decisaoCorrecaoNotaId") REFERENCES "DecisaoCorrecaoNota"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "CasoRevisaoProgressao_decisaoCorrecaoRecuperacaoId_fkey"
  FOREIGN KEY ("decisaoCorrecaoRecuperacaoId") REFERENCES "DecisaoCorrecaoRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "CasoRevisaoProgressao_alocacaoFonteId_fkey"
  FOREIGN KEY ("alocacaoFonteId") REFERENCES "AlocacaoTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION "validar_caso_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  solicitacao "SolicitacaoMudancaAcademica"%ROWTYPE;
  matricula_origem_pedido TEXT;
  matricula_fonte TEXT;
  alocacao_fonte TEXT;
  aprovada BOOLEAN;
  impactos JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Casos de revisão de progressão são imutáveis';
  END IF;

  SELECT * INTO solicitacao
    FROM "SolicitacaoMudancaAcademica"
    WHERE id = NEW."solicitacaoId"
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação da revisão não encontrada';
  END IF;

  SELECT "matriculaId" INTO matricula_origem_pedido
    FROM "AlocacaoTurma"
    WHERE id = solicitacao."alocacaoOrigemId"
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alocação de origem da solicitação não encontrada';
  END IF;

  -- Legado sem matrícula não pode ser estendido por uma cadeia inferida: só a
  -- correção da própria alocação de origem pode abrir seu caso de revisão.
  IF solicitacao."matriculaId" IS NULL THEN
    IF NEW."alocacaoFonteId" IS DISTINCT FROM solicitacao."alocacaoOrigemId" THEN
      RAISE EXCEPTION 'Solicitação legada só aceita correção da alocação de origem';
    END IF;
  ELSIF solicitacao."matriculaId" IS DISTINCT FROM NEW."matriculaId"
    OR matricula_origem_pedido IS DISTINCT FROM NEW."matriculaId" THEN
    RAISE EXCEPTION 'Solicitação e alocação de origem precisam pertencer à matrícula da revisão';
  END IF;

  IF NEW."decisaoCorrecaoNotaId" IS NOT NULL THEN
    SELECT d.aprovada, d.impactos, r."matriculaId", r."alocacaoId"
      INTO aprovada, impactos, matricula_fonte, alocacao_fonte
      FROM "DecisaoCorrecaoNota" d
      JOIN "PropostaCorrecaoNota" p ON p.id = d."propostaId"
      JOIN "VersaoLancamentoAvaliacao" v ON v.id = p."lancamentoId"
      JOIN "RegistroAvaliacaoMatricula" r ON r.id = v."registroId"
      WHERE d.id = NEW."decisaoCorrecaoNotaId"
      FOR SHARE OF d, p, v, r;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Decisão de correção regular não encontrada';
    END IF;
    IF jsonb_typeof(impactos) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Impactos da correção regular estão inválidos';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(impactos) AS impacto
      WHERE impacto = NEW."snapshotImpacto" AND impacto ->> 'id' = NEW."solicitacaoId"
    ) THEN
      RAISE EXCEPTION 'O impacto regular conferido não corresponde à solicitação';
    END IF;
  ELSE
    SELECT d.aprovada, d.impactos, plano."matriculaId", plano."alocacaoId"
      INTO aprovada, impactos, matricula_fonte, alocacao_fonte
      FROM "DecisaoCorrecaoRecuperacao" d
      JOIN "PropostaCorrecaoRecuperacao" p ON p.id = d."propostaId"
      JOIN "NotaRecuperacao" n ON n.id = p."notaId"
      JOIN "RealizacaoRecuperacao" realizacao ON realizacao.id = n."realizacaoId"
      JOIN "ItemReservaTentativaRecuperacao" item ON item.id = realizacao."itemReservaId"
      JOIN "ReservaTentativaRecuperacao" reserva ON reserva.id = item."reservaId"
      JOIN "PropostaPlanoRecuperacao" plano ON plano.id = reserva."propostaId"
      WHERE d.id = NEW."decisaoCorrecaoRecuperacaoId"
      FOR SHARE OF d, p, n, realizacao, item, reserva, plano;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Decisão de correção de recuperação não encontrada';
    END IF;
    IF jsonb_typeof(impactos) IS DISTINCT FROM 'object'
      OR jsonb_typeof(impactos -> 'mudancas') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Impactos da correção de recuperação estão inválidos';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(impactos -> 'mudancas') AS impacto
      WHERE impacto = NEW."snapshotImpacto" AND impacto ->> 'id' = NEW."solicitacaoId"
    ) THEN
      RAISE EXCEPTION 'O impacto de recuperação conferido não corresponde à solicitação';
    END IF;
  END IF;

  IF NOT aprovada THEN
    RAISE EXCEPTION 'Caso de revisão exige decisão de correção aprovada';
  END IF;
  IF matricula_fonte IS DISTINCT FROM NEW."matriculaId"
    OR alocacao_fonte IS DISTINCT FROM NEW."alocacaoFonteId" THEN
    RAISE EXCEPTION 'A fonte da correção não corresponde à matrícula ou alocação informada';
  END IF;

  -- A alocação registrada precisa conservar a mesma âncora de matrícula da
  -- fonte oficial, inclusive no caso de solicitação legada sem matrícula.
  PERFORM 1 FROM "AlocacaoTurma"
    WHERE id = NEW."alocacaoFonteId" AND "matriculaId" = NEW."matriculaId"
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alocação fonte não pertence à matrícula da revisão';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CasoRevisaoProgressao_validar"
  BEFORE INSERT OR UPDATE OR DELETE ON "CasoRevisaoProgressao"
  FOR EACH ROW EXECUTE FUNCTION "validar_caso_revisao_progressao"();
