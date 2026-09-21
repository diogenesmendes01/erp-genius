-- Corrige contagem de campos com função disponível no PostgreSQL.
-- Q23: amplia a fonte imutável da gravação sem alterar os demais guardas.

CREATE OR REPLACE FUNCTION "validar_proposta_correcao_aula"()
RETURNS TRIGGER AS $$
DECLARE
  encontro_turma_id TEXT;
  encontro_matricula_id TEXT;
  encontro_professor_id TEXT;
  turma_professor_id TEXT;
  encontro_finalidade TEXT;
  encontro_status TEXT;
  encontro_inicio TIMESTAMP(3);
  encontro_fim TIMESTAMP(3);
  diario_encontro_id TEXT;
  diario_professor_id TEXT;
  diario_turma_id TEXT;
  diario_ocorrida_em TIMESTAMP(3);
  diario_conteudo TEXT;
  autor_ativo BOOLEAN;
  autor_papeis "Papel"[];
  decisao_excecao_id TEXT;
  publicacao_oficial_id TEXT;
  snapshot_aprovado JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Propostas de correção de aula são imutáveis';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT encontro."turmaId", encontro."matriculaId", encontro."professorId", turma."professorId",
    encontro.finalidade::text, encontro.status::text, encontro.inicio, encontro.fim,
    diario."encontroId", diario."professorId", diario."turmaId", diario."ocorridaEm", diario.conteudo
    INTO encontro_turma_id, encontro_matricula_id, encontro_professor_id, turma_professor_id,
      encontro_finalidade, encontro_status, encontro_inicio, encontro_fim,
      diario_encontro_id, diario_professor_id, diario_turma_id, diario_ocorrida_em, diario_conteudo
    FROM "EncontroAgenda" encontro
    JOIN "AulaDiario" diario ON diario.id = NEW."diarioId"
    LEFT JOIN "Turma" turma ON turma.id = encontro."turmaId"
    WHERE encontro.id = NEW."encontroId"
    FOR UPDATE OF encontro, diario;
  IF NOT FOUND
    OR encontro_finalidade IS DISTINCT FROM 'AULA'
    OR encontro_status IS DISTINCT FROM 'MINISTRADO'
    OR encontro_fim > (clock_timestamp() AT TIME ZONE 'UTC')
    OR diario_encontro_id IS DISTINCT FROM NEW."encontroId"
    OR diario_professor_id IS DISTINCT FROM encontro_professor_id
    OR diario_turma_id IS DISTINCT FROM encontro_turma_id
    OR diario_ocorrida_em IS DISTINCT FROM encontro_inicio THEN
    RAISE EXCEPTION 'Correção exige aula ministrada e diário vinculado com autoria preservada';
  END IF;

  SELECT ativo, papeis INTO autor_ativo, autor_papeis
    FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT autor_ativo THEN
    RAISE EXCEPTION 'Autor da correção precisa estar ativo';
  END IF;
  IF 'GERENTE_PEDAGOGICO'::"Papel" <> ALL(autor_papeis)
    AND 'ADMINISTRADOR'::"Papel" <> ALL(autor_papeis) THEN
    IF 'PROFESSOR'::"Papel" <> ALL(autor_papeis)
      OR encontro_professor_id IS DISTINCT FROM NEW."autorId" THEN
      RAISE EXCEPTION 'Correção exige gestão ativa ou professor responsável ainda vinculado';
    END IF;
    IF encontro_turma_id IS NOT NULL THEN
      IF turma_professor_id IS DISTINCT FROM NEW."autorId" THEN
        RAISE EXCEPTION 'Professor não é o responsável atual da turma da aula';
      END IF;
      PERFORM 1 FROM "VinculoDocente" vinculo
        WHERE vinculo."turmaId" = encontro_turma_id
          AND vinculo."professorId" = NEW."autorId"
          AND vinculo.inicio <= encontro_inicio
          AND vinculo.inicio <= (clock_timestamp() AT TIME ZONE 'UTC')
          AND vinculo.fim IS NULL
        FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Professor não mantém vínculo vigente que cubra a aula';
      END IF;
    ELSIF encontro_matricula_id IS NOT NULL THEN
      PERFORM 1 FROM "Matricula" WHERE id = encontro_matricula_id FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Particular exige matrícula ainda identificada para o professor responsável';
      END IF;
    ELSE
      RAISE EXCEPTION 'Correção docente exige turma ou matrícula identificada';
    END IF;
  END IF;

  IF NEW.versao IS DISTINCT FROM COALESCE((
    SELECT MAX(versao) FROM "PropostaCorrecaoAula" WHERE "encontroId" = NEW."encontroId"
  ), 0) + 1 THEN
    RAISE EXCEPTION 'A proposta exige a próxima versão sequencial';
  END IF;

  IF jsonb_typeof(NEW."snapshotAnterior") IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW."snapshotNovo") IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW."snapshotAnterior" -> 'versao') IS DISTINCT FROM 'number'
    OR jsonb_typeof(NEW."snapshotNovo" -> 'versao') IS DISTINCT FROM 'number'
    OR NEW."snapshotAnterior" ->> 'versao' IS DISTINCT FROM '1'
    OR NEW."snapshotNovo" ->> 'versao' IS DISTINCT FROM '1'
    OR NEW."snapshotAnterior" ->> 'encontroId' IS DISTINCT FROM NEW."encontroId"
    OR NEW."snapshotNovo" ->> 'encontroId' IS DISTINCT FROM NEW."encontroId"
    OR NEW."snapshotAnterior" ->> 'diarioId' IS DISTINCT FROM NEW."diarioId"
    OR NEW."snapshotNovo" ->> 'diarioId' IS DISTINCT FROM NEW."diarioId"
    OR jsonb_typeof(NEW."snapshotAnterior" -> 'conteudo') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW."snapshotNovo" -> 'conteudo') IS DISTINCT FROM 'string'
    OR COALESCE(btrim(NEW."snapshotAnterior" ->> 'conteudo'), '') = ''
    OR COALESCE(btrim(NEW."snapshotNovo" ->> 'conteudo'), '') = ''
    OR jsonb_typeof(NEW."snapshotAnterior" -> 'registros') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW."snapshotNovo" -> 'registros') IS DISTINCT FROM 'array'
    OR COALESCE(CASE
      WHEN jsonb_typeof(NEW."snapshotAnterior" -> 'registros') = 'array'
      THEN jsonb_array_length(NEW."snapshotAnterior" -> 'registros')
      ELSE 0
    END, 0) = 0
    OR COALESCE(CASE
      WHEN jsonb_typeof(NEW."snapshotNovo" -> 'registros') = 'array'
      THEN jsonb_array_length(NEW."snapshotNovo" -> 'registros')
      ELSE 0
    END, 0) = 0
    OR (
      jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') IS DISTINCT FROM 'null'
      AND jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') IS DISTINCT FROM 'object'
    )
    OR (
      jsonb_typeof(NEW."snapshotNovo" -> 'gravacao') IS DISTINCT FROM 'null'
      AND jsonb_typeof(NEW."snapshotNovo" -> 'gravacao') IS DISTINCT FROM 'object'
    ) THEN
    RAISE EXCEPTION 'Snapshots da correção de aula estão estruturalmente inválidos';
  END IF;

  IF NEW."snapshotAnterior" = NEW."snapshotNovo" THEN
    RAISE EXCEPTION 'A proposta deve conter ao menos uma correção de conteúdo, presença ou observação';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW."snapshotAnterior" -> 'registros') registro
    WHERE jsonb_typeof(registro) IS DISTINCT FROM 'object'
      OR jsonb_typeof(registro -> 'registroId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro -> 'alunoId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro -> 'matriculaId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro -> 'nomeAluno') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro -> 'presente') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(registro -> 'participacao') IS DISTINCT FROM 'string'
      OR COALESCE((registro ->> 'participacao') IN ('PRESENTE', 'FALTA', 'IMPEDIDO_POR_RESTRICAO'), FALSE) IS FALSE
      OR (jsonb_typeof(registro -> 'observacao') IS DISTINCT FROM 'string'
        AND jsonb_typeof(registro -> 'observacao') IS DISTINCT FROM 'null')
      OR ((registro ->> 'participacao') = 'PRESENTE' AND (registro ->> 'presente') IS DISTINCT FROM 'true')
      OR ((registro ->> 'participacao') IN ('FALTA', 'IMPEDIDO_POR_RESTRICAO') AND (registro ->> 'presente') IS DISTINCT FROM 'false')
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW."snapshotNovo" -> 'registros') registro
    WHERE jsonb_typeof(registro) IS DISTINCT FROM 'object'
      OR jsonb_typeof(registro -> 'registroId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro -> 'alunoId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro -> 'matriculaId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro -> 'nomeAluno') IS DISTINCT FROM 'string'
      OR jsonb_typeof(registro -> 'presente') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(registro -> 'participacao') IS DISTINCT FROM 'string'
      OR COALESCE((registro ->> 'participacao') IN ('PRESENTE', 'FALTA', 'IMPEDIDO_POR_RESTRICAO'), FALSE) IS FALSE
      OR (jsonb_typeof(registro -> 'observacao') IS DISTINCT FROM 'string'
        AND jsonb_typeof(registro -> 'observacao') IS DISTINCT FROM 'null')
      OR ((registro ->> 'participacao') = 'PRESENTE' AND (registro ->> 'presente') IS DISTINCT FROM 'true')
      OR ((registro ->> 'participacao') IN ('FALTA', 'IMPEDIDO_POR_RESTRICAO') AND (registro ->> 'presente') IS DISTINCT FROM 'false')
  ) THEN
    RAISE EXCEPTION 'Registros da correção de aula estão inválidos';
  END IF;

  IF (SELECT count(*) FROM jsonb_array_elements(NEW."snapshotAnterior" -> 'registros')) IS DISTINCT FROM
       (SELECT count(DISTINCT registro ->> 'registroId') FROM jsonb_array_elements(NEW."snapshotAnterior" -> 'registros') registro)
    OR (SELECT count(*) FROM jsonb_array_elements(NEW."snapshotNovo" -> 'registros')) IS DISTINCT FROM
       (SELECT count(DISTINCT registro ->> 'registroId') FROM jsonb_array_elements(NEW."snapshotNovo" -> 'registros') registro)
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW."snapshotAnterior" -> 'registros') anterior
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW."snapshotNovo" -> 'registros') novo
        WHERE novo ->> 'registroId' = anterior ->> 'registroId'
          AND novo ->> 'alunoId' = anterior ->> 'alunoId'
          AND novo ->> 'matriculaId' = anterior ->> 'matriculaId'
          AND novo ->> 'nomeAluno' = anterior ->> 'nomeAluno'
      )
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW."snapshotNovo" -> 'registros') novo
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW."snapshotAnterior" -> 'registros') anterior
        WHERE anterior ->> 'registroId' = novo ->> 'registroId'
          AND anterior ->> 'alunoId' = novo ->> 'alunoId'
          AND anterior ->> 'matriculaId' = novo ->> 'matriculaId'
          AND anterior ->> 'nomeAluno' = novo ->> 'nomeAluno'
      )
    ) THEN
    RAISE EXCEPTION 'Correção não pode incluir, remover ou trocar a identidade da chamada';
  END IF;

  -- Depois de uma publicação, a próxima proposta parte da projeção aprovada,
  -- sem reescrever a fonte original protegida por 204. Propostas rejeitadas
  -- não substituem a base vigente.
  SELECT anterior."snapshotNovo" INTO snapshot_aprovado
  FROM "PropostaCorrecaoAula" anterior
  JOIN "AprovacaoCorrecaoAula" aprovacao ON aprovacao."propostaId" = anterior.id
  WHERE anterior."encontroId" = NEW."encontroId"
  ORDER BY anterior.versao DESC, anterior.id DESC
  LIMIT 1
  FOR SHARE OF anterior, aprovacao;

  IF snapshot_aprovado IS NULL THEN
  IF NEW."snapshotAnterior" ->> 'conteudo' IS DISTINCT FROM diario_conteudo
    OR (SELECT count(*) FROM jsonb_array_elements(NEW."snapshotAnterior" -> 'registros')) IS DISTINCT FROM
       (SELECT count(*) FROM "RegistroAulaAluno" WHERE "aulaId" = NEW."diarioId")
    OR EXISTS (
      SELECT 1 FROM "RegistroAulaAluno"
      WHERE "aulaId" = NEW."diarioId" AND "matriculaId" IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW."snapshotAnterior" -> 'registros') registro
      WHERE NOT EXISTS (
        SELECT 1 FROM "RegistroAulaAluno" atual
        WHERE atual.id = registro ->> 'registroId'
          AND atual."aulaId" = NEW."diarioId"
          AND atual."alunoId" = registro ->> 'alunoId'
          AND atual."matriculaId" = registro ->> 'matriculaId'
          AND atual."nomeAluno" = registro ->> 'nomeAluno'
          AND atual.presente IS NOT DISTINCT FROM (registro ->> 'presente')::boolean
          AND atual.participacao::text IS NOT DISTINCT FROM registro ->> 'participacao'
          AND atual.observacao IS NOT DISTINCT FROM CASE
            WHEN jsonb_typeof(registro -> 'observacao') = 'null' THEN NULL
            ELSE registro ->> 'observacao'
          END
      )
    ) THEN
    RAISE EXCEPTION 'Snapshot anterior não corresponde ao diário ministrado atual';
  END IF;

  ELSIF NEW."snapshotAnterior" IS DISTINCT FROM snapshot_aprovado THEN
    RAISE EXCEPTION 'Snapshot anterior deve corresponder à última correção de aula aprovada';
  END IF;
  IF NEW."snapshotAnterior" -> 'gravacao' IS DISTINCT FROM NEW."snapshotNovo" -> 'gravacao' THEN
    RAISE EXCEPTION 'Esta etapa preserva a fonte de gravação da aula';
  END IF;
  IF jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') = 'object'
    AND (
      (SELECT count(*) FROM jsonb_object_keys(CASE WHEN jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') = 'object' THEN NEW."snapshotAnterior" -> 'gravacao' ELSE '{}'::jsonb END)) IS DISTINCT FROM 2
      OR jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao' -> 'tipo') IS DISTINCT FROM 'string'
      OR (
        (NEW."snapshotAnterior" -> 'gravacao' ->> 'tipo' = 'EXCECAO'
          AND jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao' -> 'decisaoId') = 'string')
        OR (NEW."snapshotAnterior" -> 'gravacao' ->> 'tipo' = 'OFICIAL'
          AND jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao' -> 'publicacaoId') = 'string')
      ) IS NOT TRUE
    ) THEN
    RAISE EXCEPTION 'A gravação deve identificar exatamente a fonte aprovada ou oficial';
  END IF;
  SELECT decisao.id INTO decisao_excecao_id
    FROM "DecisaoExcecaoGravacao" decisao
    JOIN "ExcecaoGravacaoEncontro" excecao ON excecao.id = decisao."excecaoId"
    WHERE excecao."encontroId" = NEW."encontroId" AND decisao.aprovada
    ORDER BY excecao."criadoEm" DESC, excecao.id DESC
    LIMIT 1;
  SELECT publicacao.id INTO publicacao_oficial_id
    FROM "PublicacaoGravacaoAula" publicacao
    WHERE publicacao."encontroId" = NEW."encontroId"
    FOR SHARE;
  IF snapshot_aprovado IS NULL AND (
    (decisao_excecao_id IS NOT NULL AND (
      jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') IS DISTINCT FROM 'object'
      OR NEW."snapshotAnterior" -> 'gravacao' ->> 'tipo' IS DISTINCT FROM 'EXCECAO'
      OR NEW."snapshotAnterior" -> 'gravacao' ->> 'decisaoId' IS DISTINCT FROM decisao_excecao_id
    ))
    OR (decisao_excecao_id IS NULL AND publicacao_oficial_id IS NOT NULL AND (
      jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') IS DISTINCT FROM 'object'
      OR NEW."snapshotAnterior" -> 'gravacao' ->> 'tipo' IS DISTINCT FROM 'OFICIAL'
      OR NEW."snapshotAnterior" -> 'gravacao' ->> 'publicacaoId' IS DISTINCT FROM publicacao_oficial_id
    ))
    OR (decisao_excecao_id IS NULL AND publicacao_oficial_id IS NULL
      AND jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') IS DISTINCT FROM 'null')
  ) THEN
    RAISE EXCEPTION 'Snapshot deve preservar a fonte de gravação conferida da aula';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

