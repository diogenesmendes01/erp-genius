-- Q23: aprovação independente publica uma projeção imutável da correção.
-- AulaDiario e RegistroAulaAluno continuam sendo a fonte original protegida
-- pela migration 204; leitores passam a aplicar esta decisão explicitamente.

CREATE TABLE "AprovacaoCorrecaoAula" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  motivo TEXT NOT NULL,
  "propostaHash" TEXT NOT NULL,
  "impactosHash" TEXT NOT NULL,
  impactos JSONB NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "AprovacaoCorrecaoAula_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AprovacaoCorrecaoAula_propostaId_key" UNIQUE ("propostaId"),
  CONSTRAINT "AprovacaoCorrecaoAula_motivo_tamanho_check" CHECK (length(btrim(motivo)) BETWEEN 5 AND 3000),
  CONSTRAINT "AprovacaoCorrecaoAula_propostaHash_formato_check" CHECK ("propostaHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "AprovacaoCorrecaoAula_impactosHash_formato_check" CHECK ("impactosHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "AprovacaoCorrecaoAula_impactos_objeto_check" CHECK (jsonb_typeof(impactos) = 'object')
);

ALTER TABLE "AprovacaoCorrecaoAula"
  ADD CONSTRAINT "AprovacaoCorrecaoAula_propostaId_fkey"
    FOREIGN KEY ("propostaId") REFERENCES "PropostaCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "AprovacaoCorrecaoAula_decisorId_fkey"
    FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION "validar_aprovacao_correcao_aula"()
RETURNS TRIGGER AS $$
DECLARE
  proposta_encontro_id TEXT;
  proposta_autor_id TEXT;
  proposta_versao INTEGER;
  proposta_entrada_hash TEXT;
  proposta_estado_hash TEXT;
  decisor_ativo BOOLEAN;
  decisor_papeis "Papel"[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Aprovações de correção de aula são imutáveis';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  SELECT proposta."encontroId", proposta."autorId", proposta.versao,
    proposta."entradaHash", proposta."estadoHash"
    INTO proposta_encontro_id, proposta_autor_id, proposta_versao,
      proposta_entrada_hash, proposta_estado_hash
    FROM "PropostaCorrecaoAula" proposta
    JOIN "EncontroAgenda" encontro ON encontro.id = proposta."encontroId"
    WHERE proposta.id = NEW."propostaId"
    FOR UPDATE OF proposta, encontro;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta de correção de aula não encontrada';
  END IF;

  IF NEW."propostaHash" IS DISTINCT FROM proposta_entrada_hash THEN
    RAISE EXCEPTION 'Hash da proposta de correção não confere';
  END IF;

  IF proposta_versao IS DISTINCT FROM (
    SELECT MAX(versao)
    FROM "PropostaCorrecaoAula"
    WHERE "encontroId" = proposta_encontro_id
  ) THEN
    RAISE EXCEPTION 'Somente a proposta mais recente da aula pode ser aprovada';
  END IF;

  IF EXISTS (SELECT 1 FROM "RejeicaoCorrecaoAula" WHERE "propostaId" = NEW."propostaId") THEN
    RAISE EXCEPTION 'Proposta de correção rejeitada não pode ser aprovada';
  END IF;

  SELECT ativo, papeis INTO decisor_ativo, decisor_papeis
    FROM "Usuario"
    WHERE id = NEW."decisorId"
    FOR SHARE;
  IF NOT FOUND OR NOT decisor_ativo
    OR ('GERENTE_PEDAGOGICO'::"Papel" <> ALL(decisor_papeis)
      AND 'ADMINISTRADOR'::"Papel" <> ALL(decisor_papeis)) THEN
    RAISE EXCEPTION 'Aprovação exige gestor pedagógico ou administrador ativo';
  END IF;

  IF NEW."decisorId" IS NOT DISTINCT FROM proposta_autor_id THEN
    RAISE EXCEPTION 'Autor da proposta não pode aprová-la, mesmo com múltiplos papéis';
  END IF;

  IF jsonb_typeof(NEW.impactos) IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.impactos -> 'propostaId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW.impactos -> 'propostaHash') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW.impactos -> 'estadoHash') IS DISTINCT FROM 'string'
    OR NEW.impactos ->> 'propostaId' IS DISTINCT FROM NEW."propostaId"
    OR NEW.impactos ->> 'propostaHash' IS DISTINCT FROM NEW."propostaHash"
    OR NEW.impactos ->> 'estadoHash' IS DISTINCT FROM proposta_estado_hash THEN
    RAISE EXCEPTION 'Impactos devem estar vinculados à proposta e ao estado conferido';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AprovacaoCorrecaoAula_validar"
  BEFORE INSERT OR UPDATE OR DELETE ON "AprovacaoCorrecaoAula"
  FOR EACH ROW EXECUTE FUNCTION "validar_aprovacao_correcao_aula"();
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
      NEW."snapshotAnterior" -> 'gravacao' ->> 'tipo' IS DISTINCT FROM 'EXCECAO'
      OR jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao' -> 'decisaoId') IS DISTINCT FROM 'string'
    ) THEN
    RAISE EXCEPTION 'A gravação da etapa inicial deve identificar a exceção aprovada';
  END IF;
  SELECT decisao.id INTO decisao_excecao_id
    FROM "DecisaoExcecaoGravacao" decisao
    JOIN "ExcecaoGravacaoEncontro" excecao ON excecao.id = decisao."excecaoId"
    WHERE excecao."encontroId" = NEW."encontroId" AND decisao.aprovada
    ORDER BY excecao."criadoEm" DESC, excecao.id DESC
    LIMIT 1;
  IF snapshot_aprovado IS NULL AND (
    (decisao_excecao_id IS NULL AND jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') IS DISTINCT FROM 'null')
    OR (decisao_excecao_id IS NOT NULL AND (
      jsonb_typeof(NEW."snapshotAnterior" -> 'gravacao') IS DISTINCT FROM 'object'
      OR NEW."snapshotAnterior" -> 'gravacao' ->> 'decisaoId' IS DISTINCT FROM decisao_excecao_id
    ))
  ) THEN
    RAISE EXCEPTION 'Snapshot deve preservar a fonte de gravação conferida da aula';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validar_rejeicao_correcao_aula"()
RETURNS TRIGGER AS $$
DECLARE
  proposta_encontro_id TEXT;
  proposta_autor_id TEXT;
  proposta_versao INTEGER;
  proposta_entrada_hash TEXT;
  decisor_ativo BOOLEAN;
  decisor_papeis "Papel"[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Rejeições de correção de aula são imutáveis';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  SELECT proposta."encontroId", proposta."autorId", proposta.versao, proposta."entradaHash"
    INTO proposta_encontro_id, proposta_autor_id, proposta_versao, proposta_entrada_hash
    FROM "PropostaCorrecaoAula" proposta
    JOIN "EncontroAgenda" encontro ON encontro.id = proposta."encontroId"
    WHERE proposta.id = NEW."propostaId"
    FOR UPDATE OF proposta, encontro;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta de correção de aula não encontrada';
  END IF;

  IF NEW."propostaHash" IS DISTINCT FROM proposta_entrada_hash THEN
    RAISE EXCEPTION 'Hash da proposta de correção não confere';
  END IF;

  IF EXISTS (SELECT 1 FROM "AprovacaoCorrecaoAula" WHERE "propostaId" = NEW."propostaId") THEN
    RAISE EXCEPTION 'Proposta de correção já foi aprovada e não pode ser rejeitada';
  END IF;

  IF proposta_versao IS DISTINCT FROM (
    SELECT MAX(versao)
    FROM "PropostaCorrecaoAula"
    WHERE "encontroId" = proposta_encontro_id
  ) THEN
    RAISE EXCEPTION 'Somente a proposta mais recente da aula pode ser rejeitada';
  END IF;

  SELECT ativo, papeis INTO decisor_ativo, decisor_papeis
    FROM "Usuario"
    WHERE id = NEW."decisorId"
    FOR SHARE;
  IF NOT FOUND OR NOT decisor_ativo
    OR ('GERENTE_PEDAGOGICO'::"Papel" <> ALL(decisor_papeis)
      AND 'ADMINISTRADOR'::"Papel" <> ALL(decisor_papeis)) THEN
    RAISE EXCEPTION 'Rejeição exige gestor pedagógico ou administrador ativo';
  END IF;

  IF NEW."decisorId" IS NOT DISTINCT FROM proposta_autor_id THEN
    RAISE EXCEPTION 'Autor da proposta não pode rejeitá-la, mesmo com múltiplos papéis';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
