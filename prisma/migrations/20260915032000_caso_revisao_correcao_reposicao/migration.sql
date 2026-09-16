-- Q54/Q154: uma correção aprovada de conclusão de reposição pode alterar a
-- fonte usada no fechamento/progressão. O caso preserva esse impacto, sem
-- editar a correção, a conclusão ou a movimentação original.

ALTER TABLE "DecisaoCorrecaoConclusaoReposicao"
  ADD COLUMN "contextoAcademico" JSONB;

ALTER TABLE "CasoRevisaoProgressao"
  ADD COLUMN "decisaoCorrecaoConclusaoReposicaoId" TEXT,
  DROP CONSTRAINT "CasoRevisaoProgressao_fonte_exclusiva_check",
  ADD CONSTRAINT "CasoRevisaoProgressao_fonte_exclusiva_check"
    CHECK (num_nonnulls(
      "decisaoCorrecaoNotaId",
      "decisaoCorrecaoRecuperacaoId",
      "decisaoCorrecaoConclusaoReposicaoId"
    ) = 1);

CREATE UNIQUE INDEX "CasoRevisaoProgressao_solicitacao_decisaoReposicao_key"
  ON "CasoRevisaoProgressao" ("solicitacaoId", "decisaoCorrecaoConclusaoReposicaoId");

ALTER TABLE "CasoRevisaoProgressao"
  ADD CONSTRAINT "CasoRevisaoProgressao_decisaoCorrecaoConclusaoReposicaoId_fkey"
  FOREIGN KEY ("decisaoCorrecaoConclusaoReposicaoId")
  REFERENCES "DecisaoCorrecaoConclusaoReposicao"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- O contexto é opcional para manter decisões históricas já gravadas. Quando
-- presente, ele ancora a correção na mesma matrícula, aula e alocação que o
-- coletor de impactos usa. A action sempre o informa em novas aprovações.
CREATE OR REPLACE FUNCTION "validar_contexto_academico_decisao_correcao_reposicao"()
RETURNS TRIGGER AS $$
DECLARE
  matricula_id TEXT;
  aluno_id TEXT;
  turma_id TEXT;
  inicio_aula TIMESTAMP(3);
  finalidade_aula TEXT;
  status_aula TEXT;
  nivel_id TEXT;
  alocacao_id TEXT;
  alocacoes INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Decisões de correção de reposição são imutáveis';
  END IF;
  -- Executa antes do guard 200 por ordem alfabética e preserva a mesma ordem
  -- global de locks antes de ler a fonte acadêmica.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  IF NEW."contextoAcademico" IS NULL THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW."contextoAcademico") IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW."contextoAcademico" -> 'matriculaId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW."contextoAcademico" -> 'nivelId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW."contextoAcademico" -> 'alocacaoFonteId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW."contextoAcademico" -> 'impactos') IS DISTINCT FROM 'array'
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW."contextoAcademico" -> 'impactos') impacto
      WHERE jsonb_typeof(impacto) IS DISTINCT FROM 'object'
        OR jsonb_typeof(impacto -> 'id') IS DISTINCT FROM 'string'
        OR jsonb_typeof(impacto -> 'turmaDestinoId') IS DISTINCT FROM 'string'
        OR (jsonb_typeof(impacto -> 'decididoEm') IS DISTINCT FROM 'string'
          AND jsonb_typeof(impacto -> 'decididoEm') IS DISTINCT FROM 'null')
        OR (jsonb_typeof(impacto -> 'executadoEm') IS DISTINCT FROM 'string'
          AND jsonb_typeof(impacto -> 'executadoEm') IS DISTINCT FROM 'null')
        OR COALESCE((impacto ->> 'status') IN ('APROVADA', 'EXECUTADA'), FALSE) IS FALSE
        OR ((impacto ->> 'status') = 'APROVADA'
          AND (jsonb_typeof(impacto -> 'decididoEm') IS DISTINCT FROM 'string'
            OR jsonb_typeof(impacto -> 'executadoEm') IS DISTINCT FROM 'null'))
        OR ((impacto ->> 'status') = 'EXECUTADA'
          AND (jsonb_typeof(impacto -> 'decididoEm') IS DISTINCT FROM 'string'
            OR jsonb_typeof(impacto -> 'executadoEm') IS DISTINCT FROM 'string'))
    ) THEN
    RAISE EXCEPTION 'Contexto acadêmico da correção de reposição está inválido';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW."contextoAcademico" -> 'impactos')) IS DISTINCT FROM
     (SELECT count(DISTINCT impacto ->> 'id') FROM jsonb_array_elements(NEW."contextoAcademico" -> 'impactos') impacto) THEN
    RAISE EXCEPTION 'Contexto acadêmico não pode repetir a mesma solicitação de impacto';
  END IF;

  SELECT r."matriculaId", m."alunoId", aula."turmaId", aula.inicio,
    aula.finalidade::text, aula.status::text, turma."nivelId"
    INTO matricula_id, aluno_id, turma_id, inicio_aula, finalidade_aula, status_aula, nivel_id
    FROM "CorrecaoConclusaoReposicaoIndividual" correcao
    JOIN "ConclusaoReposicaoIndividual" conclusao ON conclusao.id = correcao."conclusaoId"
    JOIN "ReposicaoIndividual" r ON r.id = conclusao."reposicaoId"
    JOIN "Matricula" m ON m.id = r."matriculaId"
    JOIN "EncontroAgenda" aula ON aula.id = r."aulaOriginalId"
    JOIN "Turma" turma ON turma.id = aula."turmaId"
    WHERE correcao.id = NEW."correcaoId"
    FOR SHARE OF correcao, conclusao, r, m, aula, turma;
  IF NOT FOUND OR turma_id IS NULL OR finalidade_aula IS DISTINCT FROM 'AULA'
    OR status_aula IS DISTINCT FROM 'MINISTRADO' THEN
    RAISE EXCEPTION 'Contexto acadêmico exige aula original coletiva da reposição';
  END IF;
  IF NEW."contextoAcademico" ->> 'matriculaId' IS DISTINCT FROM matricula_id
    OR NEW."contextoAcademico" ->> 'nivelId' IS DISTINCT FROM nivel_id THEN
    RAISE EXCEPTION 'Contexto acadêmico não corresponde à matrícula ou nível da reposição';
  END IF;

  SELECT count(*), min(alocacao.id)
    INTO alocacoes, alocacao_id
    FROM "AlocacaoTurma" alocacao
    WHERE alocacao."matriculaId" = matricula_id
      AND alocacao."alunoId" = aluno_id
      AND alocacao."turmaId" = turma_id
      AND alocacao."criadoEm" <= inicio_aula
      AND (alocacao."encerradaEm" IS NULL OR inicio_aula < alocacao."encerradaEm");
  IF alocacoes IS DISTINCT FROM 1
    OR NEW."contextoAcademico" ->> 'alocacaoFonteId' IS DISTINCT FROM alocacao_id
    OR NOT EXISTS (
      SELECT 1 FROM "AlocacaoTurma" alocacao
      WHERE alocacao.id = alocacao_id
        AND (alocacao.ativa OR alocacao."encerradaEm" IS NOT NULL)
        AND (alocacao."encerradaEm" IS NULL OR alocacao."encerradaEm" > alocacao."criadoEm")
  ) THEN
    RAISE EXCEPTION 'Contexto acadêmico exige alocação fonte única vigente no início da aula';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW."contextoAcademico" -> 'impactos') impacto
    WHERE NOT EXISTS (
      SELECT 1 FROM "SolicitacaoMudancaAcademica" solicitacao
      JOIN "AlocacaoTurma" origem ON origem.id = solicitacao."alocacaoOrigemId"
      JOIN "Turma" turma_origem ON turma_origem.id = origem."turmaId"
      WHERE solicitacao.id = impacto ->> 'id'
        AND solicitacao.status::text = impacto ->> 'status'
        AND solicitacao."turmaDestinoId" = impacto ->> 'turmaDestinoId'
        AND (
          (solicitacao."decididoEm" IS NULL AND jsonb_typeof(impacto -> 'decididoEm') = 'null')
          OR impacto ->> 'decididoEm' = to_char(
            solicitacao."decididoEm", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        )
        AND (
          (solicitacao."executadoEm" IS NULL AND jsonb_typeof(impacto -> 'executadoEm') = 'null')
          OR impacto ->> 'executadoEm' = to_char(
            solicitacao."executadoEm", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        )
        AND solicitacao."matriculaId" = matricula_id
        AND origem."matriculaId" = matricula_id
        AND origem."alunoId" = aluno_id
        AND turma_origem."nivelId" = nivel_id
    )
  ) THEN
    RAISE EXCEPTION 'Impactos do contexto não pertencem ao escopo da reposição';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DecisaoCorrecaoConclusaoReposicao_validar_contexto_academico"
  BEFORE INSERT ON "DecisaoCorrecaoConclusaoReposicao"
  FOR EACH ROW EXECUTE FUNCTION "validar_contexto_academico_decisao_correcao_reposicao"();

-- Amplia o guard 196. Os dois ramos antigos permanecem iguais; REPOSICAO usa
-- o contexto persistido da decisão em vez de inferir cadeia de equivalência.
CREATE OR REPLACE FUNCTION "validar_caso_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  solicitacao "SolicitacaoMudancaAcademica"%ROWTYPE;
  matricula_origem_pedido TEXT;
  aluno_origem_pedido TEXT;
  nivel_origem_pedido TEXT;
  matricula_fonte TEXT;
  aluno_fonte TEXT;
  nivel_fonte TEXT;
  alocacao_fonte TEXT;
  aprovada BOOLEAN;
  impactos JSONB;
  contexto JSONB;
  turma_fonte TEXT;
  inicio_aula TIMESTAMP(3);
  alocacoes INTEGER;
  alocacao_unica TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Casos de revisão de progressão são imutáveis';
  END IF;

  SELECT * INTO solicitacao FROM "SolicitacaoMudancaAcademica"
    WHERE id = NEW."solicitacaoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação da revisão não encontrada'; END IF;

  SELECT origem."matriculaId", origem."alunoId", turma."nivelId"
    INTO matricula_origem_pedido, aluno_origem_pedido, nivel_origem_pedido
    FROM "AlocacaoTurma" origem
    JOIN "Turma" turma ON turma.id = origem."turmaId"
    WHERE origem.id = solicitacao."alocacaoOrigemId" FOR SHARE OF origem, turma;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alocação de origem da solicitação não encontrada'; END IF;

  -- Mantém literalmente a regra histórica de 196 para as duas fontes já
  -- existentes. Reposição tem escopo próprio logo abaixo e não pode herdar a
  -- inferência por cadeia de equivalências.
  IF NEW."decisaoCorrecaoConclusaoReposicaoId" IS NULL THEN
    IF solicitacao."matriculaId" IS NULL THEN
      IF NEW."alocacaoFonteId" IS DISTINCT FROM solicitacao."alocacaoOrigemId" THEN
        RAISE EXCEPTION 'Solicitação legada só aceita correção da alocação de origem';
      END IF;
    ELSIF solicitacao."matriculaId" IS DISTINCT FROM NEW."matriculaId"
      OR matricula_origem_pedido IS DISTINCT FROM NEW."matriculaId" THEN
      RAISE EXCEPTION 'Solicitação e alocação de origem precisam pertencer à matrícula da revisão';
    END IF;
  END IF;

  IF NEW."decisaoCorrecaoNotaId" IS NOT NULL THEN
    SELECT d.aprovada, d.impactos, r."matriculaId", r."alocacaoId"
      INTO aprovada, impactos, matricula_fonte, alocacao_fonte
      FROM "DecisaoCorrecaoNota" d
      JOIN "PropostaCorrecaoNota" p ON p.id = d."propostaId"
      JOIN "VersaoLancamentoAvaliacao" v ON v.id = p."lancamentoId"
      JOIN "RegistroAvaliacaoMatricula" r ON r.id = v."registroId"
      WHERE d.id = NEW."decisaoCorrecaoNotaId" FOR SHARE OF d, p, v, r;
    IF NOT FOUND THEN RAISE EXCEPTION 'Decisão de correção regular não encontrada'; END IF;
    IF jsonb_typeof(impactos) IS DISTINCT FROM 'array' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(impactos) impacto
      WHERE impacto = NEW."snapshotImpacto" AND impacto ->> 'id' = NEW."solicitacaoId"
    ) THEN RAISE EXCEPTION 'O impacto regular conferido não corresponde à solicitação'; END IF;
  ELSIF NEW."decisaoCorrecaoRecuperacaoId" IS NOT NULL THEN
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
    IF NOT FOUND THEN RAISE EXCEPTION 'Decisão de correção de recuperação não encontrada'; END IF;
    IF jsonb_typeof(impactos) IS DISTINCT FROM 'object'
      OR jsonb_typeof(impactos -> 'mudancas') IS DISTINCT FROM 'array'
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(impactos -> 'mudancas') impacto
        WHERE impacto = NEW."snapshotImpacto" AND impacto ->> 'id' = NEW."solicitacaoId"
      ) THEN RAISE EXCEPTION 'O impacto de recuperação conferido não corresponde à solicitação'; END IF;
  ELSE
    SELECT decisao.aprovada, decisao."contextoAcademico", reposicao."matriculaId",
      matricula."alunoId", turma."nivelId", aula."turmaId", aula.inicio
      INTO aprovada, contexto, matricula_fonte, aluno_fonte, nivel_fonte, turma_fonte, inicio_aula
      FROM "DecisaoCorrecaoConclusaoReposicao" decisao
      JOIN "CorrecaoConclusaoReposicaoIndividual" correcao ON correcao.id = decisao."correcaoId"
      JOIN "ConclusaoReposicaoIndividual" conclusao ON conclusao.id = correcao."conclusaoId"
      JOIN "ReposicaoIndividual" reposicao ON reposicao.id = conclusao."reposicaoId"
      JOIN "Matricula" matricula ON matricula.id = reposicao."matriculaId"
      JOIN "EncontroAgenda" aula ON aula.id = reposicao."aulaOriginalId"
      JOIN "Turma" turma ON turma.id = aula."turmaId"
      WHERE decisao.id = NEW."decisaoCorrecaoConclusaoReposicaoId"
      FOR SHARE OF decisao, correcao, conclusao, reposicao, matricula, aula, turma;
    IF NOT FOUND THEN RAISE EXCEPTION 'Decisão de correção de reposição não encontrada'; END IF;
    IF jsonb_typeof(contexto) IS DISTINCT FROM 'object'
      OR jsonb_typeof(contexto -> 'impactos') IS DISTINCT FROM 'array'
      OR contexto ->> 'matriculaId' IS DISTINCT FROM matricula_fonte
      OR contexto ->> 'nivelId' IS DISTINCT FROM nivel_fonte
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(contexto -> 'impactos') impacto
        WHERE impacto = NEW."snapshotImpacto" AND impacto ->> 'id' = NEW."solicitacaoId"
      ) THEN RAISE EXCEPTION 'O impacto de reposição conferido não corresponde à solicitação'; END IF;
    SELECT count(*), min(alocacao.id) INTO alocacoes, alocacao_unica
      FROM "AlocacaoTurma" alocacao
      WHERE alocacao."matriculaId" = matricula_fonte
        AND alocacao."alunoId" = aluno_fonte
        AND alocacao."turmaId" = turma_fonte
        AND alocacao."criadoEm" <= inicio_aula
        AND (alocacao."encerradaEm" IS NULL OR inicio_aula < alocacao."encerradaEm");
    IF alocacoes IS DISTINCT FROM 1
      OR contexto ->> 'alocacaoFonteId' IS DISTINCT FROM alocacao_unica
      OR NOT EXISTS (
        SELECT 1 FROM "AlocacaoTurma" alocacao
        WHERE alocacao.id = alocacao_unica
          AND (alocacao.ativa OR alocacao."encerradaEm" IS NOT NULL)
          AND (alocacao."encerradaEm" IS NULL OR alocacao."encerradaEm" > alocacao."criadoEm")
      ) THEN
      RAISE EXCEPTION 'Contexto da reposição não possui alocação fonte única';
    END IF;
    alocacao_fonte := alocacao_unica;
    IF solicitacao."matriculaId" IS NULL
      OR solicitacao."matriculaId" IS DISTINCT FROM matricula_fonte
      OR matricula_origem_pedido IS DISTINCT FROM matricula_fonte
      OR aluno_origem_pedido IS DISTINCT FROM aluno_fonte
      OR nivel_origem_pedido IS DISTINCT FROM nivel_fonte THEN
      RAISE EXCEPTION 'A solicitação deve pertencer à mesma matrícula, aluno e nível da reposição';
    END IF;
  END IF;

  IF NOT aprovada THEN RAISE EXCEPTION 'Caso de revisão exige decisão de correção aprovada'; END IF;
  IF matricula_fonte IS DISTINCT FROM NEW."matriculaId"
    OR alocacao_fonte IS DISTINCT FROM NEW."alocacaoFonteId" THEN
    RAISE EXCEPTION 'A fonte da correção não corresponde à matrícula ou alocação informada';
  END IF;
  PERFORM 1 FROM "AlocacaoTurma"
    WHERE id = NEW."alocacaoFonteId" AND "matriculaId" = NEW."matriculaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alocação fonte não pertence à matrícula da revisão'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- O alcance por equivalência de 197 continua obrigatório para fontes de nota e
-- recuperação. Reposição já prova o escopo real por matrícula/aluno/nível no
-- guard acima; não depende de haver equivalência aplicada entre duas turmas.
CREATE OR REPLACE FUNCTION "validar_alcance_caso_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  matricula_pedido TEXT;
  alocacao_origem_pedido TEXT;
BEGIN
  IF NEW."decisaoCorrecaoConclusaoReposicaoId" IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT "matriculaId", "alocacaoOrigemId" INTO matricula_pedido, alocacao_origem_pedido
    FROM "SolicitacaoMudancaAcademica" WHERE id = NEW."solicitacaoId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação da revisão não encontrada'; END IF;
  PERFORM 1 FROM "AlocacaoTurma"
    WHERE id = NEW."alocacaoFonteId" AND "matriculaId" = NEW."matriculaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alocação fonte não pertence à matrícula da revisão'; END IF;
  IF matricula_pedido IS NULL THEN
    IF NEW."alocacaoFonteId" IS DISTINCT FROM alocacao_origem_pedido THEN
      RAISE EXCEPTION 'Solicitação legada só aceita correção da alocação de origem';
    END IF;
    RETURN NEW;
  END IF;
  IF matricula_pedido IS DISTINCT FROM NEW."matriculaId" THEN
    RAISE EXCEPTION 'Solicitação não pertence à matrícula da revisão';
  END IF;
  PERFORM 1 FROM "AlocacaoTurma"
    WHERE id = alocacao_origem_pedido AND "matriculaId" = NEW."matriculaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alocação de origem da solicitação não pertence à matrícula da revisão'; END IF;
  IF NOT EXISTS (
    WITH RECURSIVE alcance("alocacaoId") AS (
      SELECT NEW."alocacaoFonteId"
      UNION
      SELECT aplicacao."alocacaoDestinoId"
        FROM "AplicacaoEquivalenciaAvaliacao" aplicacao
        JOIN "DecisaoEquivalenciaAvaliacao" decisao ON decisao.id = aplicacao."decisaoId" AND decisao.aprovada
        JOIN "PropostaEquivalenciaAvaliacao" proposta ON proposta.id = decisao."propostaId"
        JOIN "AlocacaoTurma" origem ON origem.id = aplicacao."alocacaoOrigemId"
        JOIN "AlocacaoTurma" destino ON destino.id = aplicacao."alocacaoDestinoId"
        JOIN alcance anterior ON anterior."alocacaoId" = aplicacao."alocacaoOrigemId"
       WHERE aplicacao."matriculaId" = NEW."matriculaId"
         AND proposta."matriculaId" = NEW."matriculaId"
         AND proposta."alocacaoOrigemId" = aplicacao."alocacaoOrigemId"
         AND proposta."turmaOrigemId" = aplicacao."turmaOrigemId"
         AND proposta."turmaDestinoId" = aplicacao."turmaDestinoId"
         AND origem."matriculaId" = NEW."matriculaId"
         AND destino."matriculaId" = NEW."matriculaId"
         AND origem."turmaId" = aplicacao."turmaOrigemId"
         AND destino."turmaId" = aplicacao."turmaDestinoId"
    ) SELECT 1 FROM alcance WHERE "alocacaoId" = alocacao_origem_pedido
  ) THEN RAISE EXCEPTION 'A solicitação não é alcançada por equivalência aplicada da fonte corrigida'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
