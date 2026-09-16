-- Q154 — resolução versionada dos casos imutáveis de revisão de progressão.
-- Esta migration só registra decisão e suas referências. Ela não atualiza
-- solicitação, movimentação, alocação, nota, frequência ou financeiro.

CREATE TYPE "AcaoResolucaoRevisaoProgressao" AS ENUM (
  'REGISTRAR_CANCELAMENTO',
  'RECONFIRMAR_EXECUTADA',
  'ENCAMINHAR_REGULARIZACAO'
);

CREATE TABLE "PropostaResolucaoRevisaoProgressao" (
  "id" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "solicitacaoId" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "acao" "AcaoResolucaoRevisaoProgressao" NOT NULL,
  "snapshot" JSONB NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "preparadorId" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "PropostaResolucaoRevisaoProgressao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropostaResolucaoRevisaoProgressao_versao_positiva_check" CHECK ("versao" > 0),
  CONSTRAINT "PropostaResolucaoRevisaoProgressao_snapshot_objeto_check" CHECK (jsonb_typeof("snapshot") = 'object'),
  CONSTRAINT "PropostaResolucaoRevisaoProgressao_estadoHash_formato_check" CHECK ("estadoHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PropostaResolucaoRevisaoProgressao_entradaHash_formato_check" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PropostaResolucaoRevisaoProgressao_motivo_tamanho_check" CHECK (length(btrim("motivo")) BETWEEN 5 AND 3000),
  CONSTRAINT "PropostaResolucaoRevisaoProgressao_chave_tamanho_check" CHECK (length("chaveIdempotencia") BETWEEN 1 AND 100)
);

CREATE TABLE "ItemPropostaResolucaoRevisaoProgressao" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "casoId" TEXT NOT NULL,
  "casoHash" TEXT NOT NULL,

  CONSTRAINT "ItemPropostaResolucaoRevisaoProgressao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ItemPropostaResolucaoRevisaoProgressao_casoHash_formato_check" CHECK ("casoHash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "DecisaoResolucaoRevisaoProgressao" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL,
  "fechamentoReconfirmadoId" TEXT,
  "fechamentoEstadoHash" TEXT,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "DecisaoResolucaoRevisaoProgressao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisaoResolucaoRevisaoProgressao_motivo_tamanho_check" CHECK (length(btrim("motivo")) BETWEEN 5 AND 2000),
  CONSTRAINT "DecisaoResolucaoRevisaoProgressao_fechamentoHash_formato_check"
    CHECK ("fechamentoEstadoHash" IS NULL OR "fechamentoEstadoHash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "PropostaResolucaoRevisaoProgressao_contexto_versao_key"
  ON "PropostaResolucaoRevisaoProgressao" ("matriculaId", "solicitacaoId", "versao");
CREATE UNIQUE INDEX "PropostaResolucaoRevisaoProgressao_idempotencia_key"
  ON "PropostaResolucaoRevisaoProgressao" ("preparadorId", "chaveIdempotencia");
CREATE INDEX "PropostaResolucaoRevisaoProgressao_solicitacao_criada_idx"
  ON "PropostaResolucaoRevisaoProgressao" ("solicitacaoId", "criadaEm");
CREATE UNIQUE INDEX "ItemPropostaResolucaoRevisaoProgressao_proposta_caso_key"
  ON "ItemPropostaResolucaoRevisaoProgressao" ("propostaId", "casoId");
CREATE INDEX "ItemPropostaResolucaoRevisaoProgressao_caso_idx"
  ON "ItemPropostaResolucaoRevisaoProgressao" ("casoId");
CREATE UNIQUE INDEX "DecisaoResolucaoRevisaoProgressao_propostaId_key"
  ON "DecisaoResolucaoRevisaoProgressao" ("propostaId");

ALTER TABLE "PropostaResolucaoRevisaoProgressao"
  ADD CONSTRAINT "PropostaResolucaoRevisaoProgressao_matriculaId_fkey"
  FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PropostaResolucaoRevisaoProgressao_solicitacaoId_fkey"
  FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoMudancaAcademica"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PropostaResolucaoRevisaoProgressao_preparadorId_fkey"
  FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ItemPropostaResolucaoRevisaoProgressao"
  ADD CONSTRAINT "ItemPropostaResolucaoRevisaoProgressao_propostaId_fkey"
  FOREIGN KEY ("propostaId") REFERENCES "PropostaResolucaoRevisaoProgressao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "ItemPropostaResolucaoRevisaoProgressao_casoId_fkey"
  FOREIGN KEY ("casoId") REFERENCES "CasoRevisaoProgressao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoResolucaoRevisaoProgressao"
  ADD CONSTRAINT "DecisaoResolucaoRevisaoProgressao_propostaId_fkey"
  FOREIGN KEY ("propostaId") REFERENCES "PropostaResolucaoRevisaoProgressao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "DecisaoResolucaoRevisaoProgressao_decisorId_fkey"
  FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "DecisaoResolucaoRevisaoProgressao_fechamentoReconfirmadoId_fkey"
  FOREIGN KEY ("fechamentoReconfirmadoId") REFERENCES "FechamentoAcademico"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION "validar_proposta_resolucao_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  matricula_pedido TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Propostas de resolução de revisão são imutáveis';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'resolucao-revisao-progressao:' || NEW."matriculaId" || ':' || NEW."solicitacaoId", 0));
  SELECT "matriculaId" INTO matricula_pedido
    FROM "SolicitacaoMudancaAcademica" WHERE id = NEW."solicitacaoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação da resolução não encontrada'; END IF;
  IF matricula_pedido IS NOT NULL AND matricula_pedido IS DISTINCT FROM NEW."matriculaId" THEN
    RAISE EXCEPTION 'A solicitação não pertence à matrícula da resolução';
  END IF;
  IF jsonb_typeof(NEW.snapshot -> 'casos') IS DISTINCT FROM 'array'
    OR NEW.snapshot ->> 'matriculaId' IS DISTINCT FROM NEW."matriculaId"
    OR NEW.snapshot ->> 'solicitacaoId' IS DISTINCT FROM NEW."solicitacaoId"
    OR NEW.snapshot ->> 'acao' IS DISTINCT FROM NEW.acao::text
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.snapshot -> 'casos') AS caso
      WHERE jsonb_typeof(caso) IS DISTINCT FROM 'object'
        OR caso ->> 'id' IS NULL
        OR caso ->> 'casoHash' IS NULL
        OR (caso ->> 'casoHash') !~ '^[a-f0-9]{64}$'
    )
    OR (SELECT count(*) FROM jsonb_array_elements(NEW.snapshot -> 'casos')) IS DISTINCT FROM
       (SELECT count(DISTINCT caso ->> 'id') FROM jsonb_array_elements(NEW.snapshot -> 'casos') AS caso) THEN
    RAISE EXCEPTION 'Snapshot da resolução deve declarar casos únicos com hash verificável';
  END IF;
  PERFORM 1 FROM "Usuario" WHERE id = NEW."preparadorId" AND ativo
    AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preparação exige gestão pedagógica ou administração ativa'; END IF;
  IF NEW.versao <> COALESCE((
    SELECT MAX(versao) FROM "PropostaResolucaoRevisaoProgressao"
    WHERE "matriculaId" = NEW."matriculaId" AND "solicitacaoId" = NEW."solicitacaoId"
  ), 0) + 1 THEN RAISE EXCEPTION 'Versão de resolução desatualizada'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validar_item_proposta_resolucao_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  proposta_matricula TEXT;
  proposta_solicitacao TEXT;
  caso_matricula TEXT;
  caso_solicitacao TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Itens de resolução de revisão são imutáveis';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT "matriculaId", "solicitacaoId" INTO proposta_matricula, proposta_solicitacao
    FROM "PropostaResolucaoRevisaoProgressao" WHERE id = NEW."propostaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de resolução não encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM "DecisaoResolucaoRevisaoProgressao" WHERE "propostaId" = NEW."propostaId") THEN
    RAISE EXCEPTION 'Não é permitido alterar os casos de proposta já decidida';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT snapshot FROM "PropostaResolucaoRevisaoProgressao" WHERE id = NEW."propostaId") -> 'casos') AS declarado
    WHERE declarado ->> 'id' = NEW."casoId" AND declarado ->> 'casoHash' = NEW."casoHash"
  ) THEN RAISE EXCEPTION 'Item não corresponde ao caso declarado no snapshot da proposta'; END IF;
  SELECT "matriculaId", "solicitacaoId" INTO caso_matricula, caso_solicitacao
    FROM "CasoRevisaoProgressao" WHERE id = NEW."casoId" FOR SHARE;
  IF NOT FOUND OR caso_matricula IS DISTINCT FROM proposta_matricula
    OR caso_solicitacao IS DISTINCT FROM proposta_solicitacao THEN
    RAISE EXCEPTION 'Caso não pertence ao contexto da proposta de resolução';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validar_decisao_resolucao_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  proposta "PropostaResolucaoRevisaoProgressao"%ROWTYPE;
  solicitacao "SolicitacaoMudancaAcademica"%ROWTYPE;
  fechamento "FechamentoAcademico"%ROWTYPE;
  nivel_origem TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Decisões de resolução de revisão são imutáveis';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO proposta FROM "PropostaResolucaoRevisaoProgressao"
    WHERE id = NEW."propostaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de resolução não encontrada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'resolucao-revisao-progressao:' || proposta."matriculaId" || ':' || proposta."solicitacaoId", 0));
  IF proposta.versao IS DISTINCT FROM (
    SELECT MAX(versao) FROM "PropostaResolucaoRevisaoProgressao"
    WHERE "matriculaId" = proposta."matriculaId" AND "solicitacaoId" = proposta."solicitacaoId"
  ) THEN RAISE EXCEPTION 'Há proposta de resolução mais recente'; END IF;
  SELECT * INTO solicitacao FROM "SolicitacaoMudancaAcademica"
    WHERE id = proposta."solicitacaoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação da resolução não encontrada'; END IF;
  IF solicitacao."matriculaId" IS NOT NULL AND solicitacao."matriculaId" IS DISTINCT FROM proposta."matriculaId" THEN
    RAISE EXCEPTION 'Solicitação não pertence à matrícula da resolução';
  END IF;
  PERFORM 1 FROM "Usuario" WHERE id IN (proposta."preparadorId", NEW."decisorId")
    AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
    ORDER BY id FOR SHARE;
  IF (SELECT count(*) FROM "Usuario" WHERE id IN (proposta."preparadorId", NEW."decisorId")
    AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) <> 2
    OR proposta."preparadorId" = NEW."decisorId" THEN
    RAISE EXCEPTION 'A decisão exige outra pessoa ativa da gestão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "ItemPropostaResolucaoRevisaoProgressao" WHERE "propostaId" = proposta.id) THEN
    RAISE EXCEPTION 'A proposta precisa selecionar ao menos um caso';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ItemPropostaResolucaoRevisaoProgressao" i
    JOIN "CasoRevisaoProgressao" c ON c.id = i."casoId"
    WHERE i."propostaId" = proposta.id
      AND (c."matriculaId" IS DISTINCT FROM proposta."matriculaId"
        OR c."solicitacaoId" IS DISTINCT FROM proposta."solicitacaoId")
  ) THEN RAISE EXCEPTION 'Itens não pertencem ao contexto da proposta'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(proposta.snapshot -> 'casos') AS declarado
    WHERE NOT EXISTS (
      SELECT 1 FROM "ItemPropostaResolucaoRevisaoProgressao" i
      WHERE i."propostaId" = proposta.id
        AND i."casoId" = declarado ->> 'id'
        AND i."casoHash" = declarado ->> 'casoHash'
    )
  ) OR EXISTS (
    SELECT 1 FROM "ItemPropostaResolucaoRevisaoProgressao" i
    WHERE i."propostaId" = proposta.id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(proposta.snapshot -> 'casos') AS declarado
      WHERE declarado ->> 'id' = i."casoId" AND declarado ->> 'casoHash' = i."casoHash"
    )
  ) THEN RAISE EXCEPTION 'Itens e casos declarados no snapshot divergem'; END IF;
  IF NOT NEW.aprovada THEN
    IF NEW."fechamentoReconfirmadoId" IS NOT NULL OR NEW."fechamentoEstadoHash" IS NOT NULL THEN
      RAISE EXCEPTION 'Decisão rejeitada não pode registrar fechamento';
    END IF;
    RETURN NEW;
  END IF;

  -- Todo item decidido precisa continuar aberto. Uma decisão terminal anterior
  -- não pode receber encaminhamento nem reconfirmação em versão posterior.
  IF EXISTS (
    SELECT 1 FROM "ItemPropostaResolucaoRevisaoProgressao" atual
    WHERE atual."propostaId" = proposta.id AND EXISTS (
      SELECT 1 FROM "ItemPropostaResolucaoRevisaoProgressao" anterior_item
      JOIN "PropostaResolucaoRevisaoProgressao" anterior_proposta ON anterior_proposta.id = anterior_item."propostaId"
      JOIN "DecisaoResolucaoRevisaoProgressao" anterior_decisao ON anterior_decisao."propostaId" = anterior_proposta.id
      WHERE anterior_item."casoId" = atual."casoId" AND anterior_decisao.aprovada
        AND anterior_proposta.acao IN ('REGISTRAR_CANCELAMENTO', 'RECONFIRMAR_EXECUTADA')
    )
  ) THEN RAISE EXCEPTION 'Um dos casos selecionados já possui resolução terminal'; END IF;

  IF proposta.acao IN ('REGISTRAR_CANCELAMENTO', 'RECONFIRMAR_EXECUTADA') AND EXISTS (
    WITH abertos AS (
      SELECT c.id FROM "CasoRevisaoProgressao" c
      WHERE c."matriculaId" = proposta."matriculaId" AND c."solicitacaoId" = proposta."solicitacaoId"
        AND NOT EXISTS (
          SELECT 1 FROM "ItemPropostaResolucaoRevisaoProgressao" anterior_item
          JOIN "PropostaResolucaoRevisaoProgressao" anterior_proposta ON anterior_proposta.id = anterior_item."propostaId"
          JOIN "DecisaoResolucaoRevisaoProgressao" anterior_decisao ON anterior_decisao."propostaId" = anterior_proposta.id
          WHERE anterior_item."casoId" = c.id AND anterior_decisao.aprovada
            AND anterior_proposta.acao IN ('REGISTRAR_CANCELAMENTO', 'RECONFIRMAR_EXECUTADA')
        )
    ), divergentes AS (
      (SELECT id FROM abertos EXCEPT SELECT "casoId" FROM "ItemPropostaResolucaoRevisaoProgressao" WHERE "propostaId" = proposta.id)
      UNION ALL
      (SELECT "casoId" FROM "ItemPropostaResolucaoRevisaoProgressao" WHERE "propostaId" = proposta.id EXCEPT SELECT id FROM abertos)
    )
    SELECT 1 FROM divergentes
  ) THEN RAISE EXCEPTION 'A resolução terminal precisa cobrir todos e somente os casos ainda abertos'; END IF;

  IF proposta.acao = 'REGISTRAR_CANCELAMENTO' THEN
    IF solicitacao.status IS DISTINCT FROM 'CANCELADA'::"StatusMudancaAcademica"
      OR NEW."fechamentoReconfirmadoId" IS NOT NULL OR NEW."fechamentoEstadoHash" IS NOT NULL THEN
      RAISE EXCEPTION 'Registro de cancelamento exige solicitação cancelada e não aceita fechamento';
    END IF;
  ELSIF proposta.acao = 'RECONFIRMAR_EXECUTADA' THEN
    IF solicitacao.status IS DISTINCT FROM 'EXECUTADA'::"StatusMudancaAcademica"
      OR solicitacao."matriculaId" IS DISTINCT FROM proposta."matriculaId"
      OR NEW."fechamentoReconfirmadoId" IS NULL OR NEW."fechamentoEstadoHash" IS NULL THEN
      RAISE EXCEPTION 'Reconfirmação exige solicitação executada, matrícula conferida e fechamento informado';
    END IF;
    SELECT t."nivelId" INTO nivel_origem FROM "AlocacaoTurma" a
      JOIN "Turma" t ON t.id = a."turmaId"
      WHERE a.id = solicitacao."alocacaoOrigemId" AND a."matriculaId" = proposta."matriculaId" FOR SHARE OF a, t;
    IF NOT FOUND THEN RAISE EXCEPTION 'Alocação de origem da progressão não corresponde à matrícula'; END IF;
    SELECT * INTO fechamento FROM "FechamentoAcademico" WHERE id = NEW."fechamentoReconfirmadoId" FOR SHARE;
    IF NOT FOUND OR NOT fechamento."resultadoSuficiente"
      OR fechamento."matriculaId" IS DISTINCT FROM proposta."matriculaId"
      OR fechamento."nivelId" IS DISTINCT FROM nivel_origem
      OR fechamento."alocacaoReferenciaId" IS DISTINCT FROM solicitacao."alocacaoOrigemId"
      OR fechamento."estadoHash" IS DISTINCT FROM NEW."fechamentoEstadoHash"
      OR fechamento.id IS NOT DISTINCT FROM solicitacao."fechamentoAcademicoId"
      OR fechamento."confirmadoEm" < (
        SELECT MAX(c."criadaEm") FROM "ItemPropostaResolucaoRevisaoProgressao" i
        JOIN "CasoRevisaoProgressao" c ON c.id = i."casoId"
        WHERE i."propostaId" = proposta.id
      )
      OR fechamento.versao IS DISTINCT FROM (
        SELECT MAX(versao) FROM "FechamentoAcademico"
        WHERE "matriculaId" = proposta."matriculaId" AND "nivelId" = nivel_origem
      ) THEN RAISE EXCEPTION 'Fechamento reconfirmado não corresponde à progressão atual'; END IF;
  ELSE
    IF solicitacao.status IS DISTINCT FROM 'EXECUTADA'::"StatusMudancaAcademica"
      OR NEW."fechamentoReconfirmadoId" IS NOT NULL OR NEW."fechamentoEstadoHash" IS NOT NULL THEN
      RAISE EXCEPTION 'Encaminhamento exige solicitação executada e não pode registrar fechamento';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PropostaResolucaoRevisaoProgressao_validar"
  BEFORE INSERT OR UPDATE OR DELETE ON "PropostaResolucaoRevisaoProgressao"
  FOR EACH ROW EXECUTE FUNCTION "validar_proposta_resolucao_revisao_progressao"();
CREATE TRIGGER "ItemPropostaResolucaoRevisaoProgressao_validar"
  BEFORE INSERT OR UPDATE OR DELETE ON "ItemPropostaResolucaoRevisaoProgressao"
  FOR EACH ROW EXECUTE FUNCTION "validar_item_proposta_resolucao_revisao_progressao"();
CREATE TRIGGER "DecisaoResolucaoRevisaoProgressao_validar"
  BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoResolucaoRevisaoProgressao"
  FOR EACH ROW EXECUTE FUNCTION "validar_decisao_resolucao_revisao_progressao"();
