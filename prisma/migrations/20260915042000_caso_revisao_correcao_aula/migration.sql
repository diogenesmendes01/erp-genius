ALTER TABLE "CasoRevisaoProgressao"
  ADD COLUMN "aprovacaoCorrecaoAulaId" TEXT,
  DROP CONSTRAINT "CasoRevisaoProgressao_fonte_exclusiva_check",
  ADD CONSTRAINT "CasoRevisaoProgressao_fonte_exclusiva_check"
    CHECK (num_nonnulls("decisaoCorrecaoNotaId", "decisaoCorrecaoRecuperacaoId",
      "decisaoCorrecaoConclusaoReposicaoId", "aprovacaoCorrecaoAulaId") = 1);
CREATE UNIQUE INDEX "CasoRevisaoProgressao_solicitacao_aprovacaoAula_key"
  ON "CasoRevisaoProgressao" ("solicitacaoId", "aprovacaoCorrecaoAulaId");
ALTER TABLE "CasoRevisaoProgressao"
  ADD CONSTRAINT "CasoRevisaoProgressao_aprovacaoCorrecaoAulaId_fkey"
  FOREIGN KEY ("aprovacaoCorrecaoAulaId") REFERENCES "AprovacaoCorrecaoAula"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

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
  aprovacao_aula TEXT;
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
  IF NEW."decisaoCorrecaoConclusaoReposicaoId" IS NULL AND NEW."aprovacaoCorrecaoAulaId" IS NULL THEN
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
  ELSIF NEW."aprovacaoCorrecaoAulaId" IS NOT NULL THEN
    SELECT aprovacao.impactos, encontro.inicio, encontro."turmaId", turma."nivelId", matricula."alunoId"
      INTO impactos, inicio_aula, turma_fonte, nivel_fonte, aluno_fonte
      FROM "AprovacaoCorrecaoAula" aprovacao
      JOIN "PropostaCorrecaoAula" proposta ON proposta.id=aprovacao."propostaId"
      JOIN "EncontroAgenda" encontro ON encontro.id=proposta."encontroId"
      JOIN "Turma" turma ON turma.id=encontro."turmaId"
      JOIN "Matricula" matricula ON matricula.id=NEW."matriculaId"
      WHERE aprovacao.id=NEW."aprovacaoCorrecaoAulaId"
      FOR SHARE OF aprovacao, proposta, encontro, turma, matricula;
    IF NOT FOUND THEN RAISE EXCEPTION 'Aprovação de correção de aula não encontrada'; END IF;
    IF jsonb_typeof(impactos) IS DISTINCT FROM 'object'
      OR jsonb_typeof(impactos->'progressao') IS DISTINCT FROM 'array'
      OR jsonb_typeof(impactos->'comparacao'->'registros') IS DISTINCT FROM 'array'
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(impactos->'progressao') fonte
        WHERE fonte->>'matriculaId'=NEW."matriculaId" AND fonte->>'nivelId'=nivel_fonte
          AND fonte->>'alocacaoFonteId'=NEW."alocacaoFonteId" AND jsonb_typeof(fonte->'impactos')='array'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(fonte->'impactos') impacto WHERE impacto=NEW."snapshotImpacto" AND impacto->>'id'=NEW."solicitacaoId"))
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(impactos->'comparacao'->'registros') registro
        WHERE registro->>'matriculaId'=NEW."matriculaId" AND (registro->>'participacaoAlterada')='true')
      OR NOT EXISTS (
        SELECT 1 FROM "SolicitacaoMudancaAcademica" atual
        WHERE atual.id=NEW."solicitacaoId"
          AND atual.status::text=NEW."snapshotImpacto"->>'status'
          AND atual.status IN ('APROVADA'::"StatusMudancaAcademica", 'EXECUTADA'::"StatusMudancaAcademica")
          AND atual."turmaDestinoId"=NEW."snapshotImpacto"->>'turmaDestinoId'
          AND (
            (atual."decididoEm" IS NULL AND jsonb_typeof(NEW."snapshotImpacto"->'decididoEm')='null')
            OR NEW."snapshotImpacto"->>'decididoEm'=to_char(atual."decididoEm",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          )
          AND (
            (atual."executadoEm" IS NULL AND jsonb_typeof(NEW."snapshotImpacto"->'executadoEm')='null')
            OR NEW."snapshotImpacto"->>'executadoEm'=to_char(atual."executadoEm",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          )
      ) THEN
      RAISE EXCEPTION 'Caso Q23 exige impacto de frequência e participação efetivamente alterada'; END IF;
    SELECT count(*), min(alocacao.id) INTO alocacoes, alocacao_unica FROM "AlocacaoTurma" alocacao
      WHERE alocacao."matriculaId"=NEW."matriculaId" AND alocacao."alunoId"=aluno_fonte
        AND alocacao."turmaId"=turma_fonte AND alocacao."criadoEm"<=inicio_aula
        AND (alocacao."encerradaEm" IS NULL OR inicio_aula<alocacao."encerradaEm");
    IF alocacoes IS DISTINCT FROM 1 OR alocacao_unica IS DISTINCT FROM NEW."alocacaoFonteId"
      OR solicitacao."matriculaId" IS NULL OR solicitacao."matriculaId" IS DISTINCT FROM NEW."matriculaId"
      OR matricula_origem_pedido IS DISTINCT FROM NEW."matriculaId"
      OR aluno_origem_pedido IS DISTINCT FROM aluno_fonte OR nivel_origem_pedido IS DISTINCT FROM nivel_fonte THEN
      RAISE EXCEPTION 'Caso Q23 não corresponde à matrícula, vínculo, aluno ou nível afetado'; END IF;
    aprovada:=TRUE; matricula_fonte:=NEW."matriculaId"; alocacao_fonte:=NEW."alocacaoFonteId";
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


CREATE OR REPLACE FUNCTION "validar_alcance_caso_revisao_progressao"()
RETURNS TRIGGER AS $$
DECLARE
  matricula_pedido TEXT;
  alocacao_origem_pedido TEXT;
BEGIN
  IF NEW."decisaoCorrecaoConclusaoReposicaoId" IS NOT NULL OR NEW."aprovacaoCorrecaoAulaId" IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION "validar_impactos_correcao_aula_208"() RETURNS TRIGGER AS $$
DECLARE
  anterior JSONB;
  novo JSONB;
BEGIN
  SELECT proposta."snapshotAnterior", proposta."snapshotNovo" INTO anterior, novo
    FROM "PropostaCorrecaoAula" proposta
    WHERE proposta.id=NEW."propostaId" FOR SHARE;
  IF jsonb_typeof(NEW.impactos->'progressao') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW.impactos->'comparacao'->'registros') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Impactos Q23 exigem progresso e comparação estruturados';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.impactos->'comparacao'->'registros') registro
    WHERE jsonb_typeof(registro) IS DISTINCT FROM 'object'
      OR jsonb_typeof(registro->'registroId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro->'matriculaId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro->'participacaoAlterada') IS DISTINCT FROM 'boolean'
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.impactos->'progressao') fonte
    WHERE jsonb_typeof(fonte) IS DISTINCT FROM 'object'
      OR jsonb_typeof(fonte->'matriculaId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(fonte->'nivelId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(fonte->'alocacaoFonteId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(fonte->'impactos') IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'Identidades e indicadores dos impactos Q23 devem ter tipos válidos';
  END IF;
  -- Recalcula a alteração a partir dos snapshots imutáveis, para que uma flag
  -- falsa não oculte uma mudança de presença e nenhuma mudança textual abra caso.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(anterior->'registros') antes
    JOIN jsonb_array_elements(novo->'registros') depois ON depois->>'registroId'=antes->>'registroId'
    WHERE (antes->>'participacao' IS DISTINCT FROM depois->>'participacao')
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.impactos->'comparacao'->'registros') informado
        WHERE informado->>'registroId'=antes->>'registroId'
          AND informado->>'matriculaId'=antes->>'matriculaId'
          AND (informado->>'participacaoAlterada')='true'
      )
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.impactos->'comparacao'->'registros') informado
    WHERE (informado->>'participacaoAlterada')='true'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(anterior->'registros') antes
        JOIN jsonb_array_elements(novo->'registros') depois ON depois->>'registroId'=antes->>'registroId'
        WHERE antes->>'registroId'=informado->>'registroId'
          AND antes->>'matriculaId'=informado->>'matriculaId'
          AND antes->>'participacao' IS DISTINCT FROM depois->>'participacao'
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(anterior->'registros') antes
    JOIN jsonb_array_elements(novo->'registros') depois ON depois->>'registroId'=antes->>'registroId'
    JOIN "Matricula" matricula ON matricula.id=antes->>'matriculaId'
    JOIN "PropostaCorrecaoAula" proposta ON proposta.id=NEW."propostaId"
    JOIN "EncontroAgenda" encontro ON encontro.id=proposta."encontroId"
    JOIN "Turma" turma ON turma.id=encontro."turmaId"
    JOIN "SolicitacaoMudancaAcademica" solicitacao
      ON solicitacao."matriculaId"=matricula.id
      AND solicitacao.status IN ('APROVADA'::"StatusMudancaAcademica", 'EXECUTADA'::"StatusMudancaAcademica")
    JOIN "AlocacaoTurma" origem ON origem.id=solicitacao."alocacaoOrigemId"
    JOIN "Turma" turma_origem ON turma_origem.id=origem."turmaId"
    WHERE antes->>'participacao' IS DISTINCT FROM depois->>'participacao'
      AND origem."matriculaId"=matricula.id
      AND origem."alunoId"=matricula."alunoId"
      AND turma_origem."nivelId"=turma."nivelId"
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.impactos->'progressao') fonte
        CROSS JOIN LATERAL jsonb_array_elements(fonte->'impactos') impacto
        WHERE fonte->>'matriculaId'=matricula.id AND impacto->>'id'=solicitacao.id
      )
  ) THEN
    RAISE EXCEPTION 'Impactos Q23 omitem ou falsificam alteração de participação';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AprovacaoCorrecaoAula_validar_impactos_208"
BEFORE INSERT ON "AprovacaoCorrecaoAula"
FOR EACH ROW EXECUTE FUNCTION "validar_impactos_correcao_aula_208"();

CREATE OR REPLACE FUNCTION "materializar_casos_revisao_correcao_aula"() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "CasoRevisaoProgressao" (id, "matriculaId", "solicitacaoId", "aprovacaoCorrecaoAulaId", "alocacaoFonteId", "snapshotImpacto")
  SELECT gen_random_uuid()::text, fonte->>'matriculaId', impacto->>'id', NEW.id, fonte->>'alocacaoFonteId', impacto
  FROM jsonb_array_elements(NEW.impactos->'progressao') fonte
  CROSS JOIN LATERAL jsonb_array_elements(fonte->'impactos') impacto
  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.impactos->'comparacao'->'registros') registro
    WHERE registro->>'matriculaId'=fonte->>'matriculaId' AND (registro->>'participacaoAlterada')='true');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AprovacaoCorrecaoAula_materializar_casos_progressao"
AFTER INSERT ON "AprovacaoCorrecaoAula"
FOR EACH ROW EXECUTE FUNCTION "materializar_casos_revisao_correcao_aula"();
