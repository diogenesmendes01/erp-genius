-- Q23: a presença original não é reescrita. Esta projeção usa somente a
-- última correção publicada para uma AULA ministrada e conserva qualquer
-- outro diário (inclusive REPOSICAO) como foi registrado.
CREATE OR REPLACE FUNCTION participacao_aula_efetiva(registro_id TEXT)
RETURNS "ParticipacaoAula"
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  participacao_original "ParticipacaoAula";
  encontro_id TEXT;
  diario_id TEXT;
  aluno_id TEXT;
  matricula_id TEXT;
  nome_aluno TEXT;
  finalidade_atual "FinalidadeEncontroAgenda";
  status_atual "StatusEncontroAgenda";
  snapshot_publicado JSONB;
  registro_publicado JSONB;
  quantidade_registros INTEGER;
BEGIN
  SELECT registro.participacao, diario."encontroId", diario.id,
    registro."alunoId", registro."matriculaId", registro."nomeAluno",
    encontro.finalidade, encontro.status
    INTO participacao_original, encontro_id, diario_id, aluno_id,
      matricula_id, nome_aluno, finalidade_atual, status_atual
    FROM "RegistroAulaAluno" registro
    JOIN "AulaDiario" diario ON diario.id = registro."aulaId"
    LEFT JOIN "EncontroAgenda" encontro ON encontro.id = diario."encontroId"
    WHERE registro.id = registro_id;

  IF NOT FOUND
    OR finalidade_atual IS DISTINCT FROM 'AULA'::"FinalidadeEncontroAgenda"
    OR status_atual IS DISTINCT FROM 'MINISTRADO'::"StatusEncontroAgenda" THEN
    RETURN participacao_original;
  END IF;

  SELECT proposta."snapshotNovo"
    INTO snapshot_publicado
    FROM "PropostaCorrecaoAula" proposta
    JOIN "AprovacaoCorrecaoAula" aprovacao ON aprovacao."propostaId" = proposta.id
    WHERE proposta."encontroId" = encontro_id
      AND proposta."diarioId" = diario_id
    ORDER BY proposta.versao DESC, proposta.id DESC
    LIMIT 1;

  IF snapshot_publicado IS NULL THEN
    RETURN participacao_original;
  END IF;

  IF jsonb_typeof(snapshot_publicado) IS DISTINCT FROM 'object'
    OR snapshot_publicado ->> 'versao' IS DISTINCT FROM '1'
    OR snapshot_publicado ->> 'encontroId' IS DISTINCT FROM encontro_id
    OR snapshot_publicado ->> 'diarioId' IS DISTINCT FROM diario_id
    OR jsonb_typeof(snapshot_publicado -> 'registros') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Correção de aula publicada tem snapshot incompatível com a chamada original';
  END IF;

  SELECT count(*)
    INTO quantidade_registros
    FROM jsonb_array_elements(snapshot_publicado -> 'registros') item
    WHERE item ->> 'registroId' = registro_id;
  IF quantidade_registros IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Correção de aula publicada não preserva a identidade do registro';
  END IF;

  SELECT item
    INTO registro_publicado
    FROM jsonb_array_elements(snapshot_publicado -> 'registros') item
    WHERE item ->> 'registroId' = registro_id;

  IF jsonb_typeof(registro_publicado) IS DISTINCT FROM 'object'
    OR registro_publicado ->> 'registroId' IS DISTINCT FROM registro_id
    OR registro_publicado ->> 'alunoId' IS DISTINCT FROM aluno_id
    OR registro_publicado ->> 'matriculaId' IS DISTINCT FROM matricula_id
    OR registro_publicado ->> 'nomeAluno' IS DISTINCT FROM nome_aluno
    OR jsonb_typeof(registro_publicado -> 'participacao') IS DISTINCT FROM 'string'
    OR COALESCE((registro_publicado ->> 'participacao') IN (
      'PRESENTE', 'FALTA', 'IMPEDIDO_POR_RESTRICAO'
    ), FALSE) IS FALSE
    OR jsonb_typeof(registro_publicado -> 'presente') IS DISTINCT FROM 'boolean'
    OR (
      registro_publicado ->> 'participacao' = 'PRESENTE'
      AND (registro_publicado ->> 'presente') IS DISTINCT FROM 'true'
    )
    OR (
      registro_publicado ->> 'participacao' IN ('FALTA', 'IMPEDIDO_POR_RESTRICAO')
      AND (registro_publicado ->> 'presente') IS DISTINCT FROM 'false'
    ) THEN
    RAISE EXCEPTION 'Correção de aula publicada altera indevidamente a identidade ou a presença';
  END IF;

  RETURN (registro_publicado ->> 'participacao')::"ParticipacaoAula";
END;
$$;

-- Pedido novo: serializa contra a publicação Q23 antes de travar a matrícula,
-- mas mantém a leitura da tentativa de REPOSICAO bruta no bloqueio de duplicata.
CREATE OR REPLACE FUNCTION validar_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origem "EncontroAgenda"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('reposicao-individual',0));
 PERFORM id FROM "Usuario" WHERE id=NEW."solicitanteId" AND ativo
   AND papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de reposição exige solicitante ativo da secretaria ou gestão'; END IF;
 PERFORM id FROM "Matricula" WHERE id=NEW."matriculaId" AND status='ATIVA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Novo pedido de reposição exige matrícula ativa'; END IF;
 SELECT * INTO origem FROM "EncontroAgenda" WHERE id=NEW."aulaOriginalId" FOR SHARE;
 IF origem.id IS NULL OR origem.finalidade<>'AULA' OR origem."turmaId" IS NULL OR origem.status<>'MINISTRADO' OR origem.fim >= (clock_timestamp() AT TIME ZONE 'UTC') THEN
  RAISE EXCEPTION 'Reposição exige aula coletiva ministrada e já encerrada';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "AulaDiario" diario JOIN "RegistroAulaAluno" registro ON registro."aulaId"=diario.id
  JOIN "Matricula" matricula ON matricula.id=NEW."matriculaId"
  WHERE diario."encontroId"=origem.id AND registro."matriculaId"=NEW."matriculaId"
    AND registro."alunoId"=matricula."alunoId"
    AND participacao_aula_efetiva(registro.id) IN ('FALTA','IMPEDIDO_POR_RESTRICAO')
 ) THEN RAISE EXCEPTION 'Reposição exige falta ou impedimento efetivo na matrícula exata da aula'; END IF;
 IF EXISTS (
  SELECT 1 FROM "ReposicaoIndividual" anterior
  LEFT JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId"=anterior.id
  LEFT JOIN "AgendaReposicaoIndividual" agenda ON agenda."reposicaoId"=anterior.id
  LEFT JOIN "AulaDiario" diario ON diario."encontroId"=agenda."encontroId"
  LEFT JOIN "RegistroAulaAluno" tentativa ON tentativa."aulaId"=diario.id AND tentativa."matriculaId"=anterior."matriculaId"
  WHERE anterior."matriculaId"=NEW."matriculaId" AND anterior."aulaOriginalId"=NEW."aulaOriginalId"
   AND (decisao.aprovada IS FALSE OR (
    agenda."statusBeneficio"='CONSUMIDA'::"StatusReservaBeneficioReposicao"
    AND tentativa.participacao='FALTA'::"ParticipacaoAula"
    AND NOT EXISTS (SELECT 1 FROM "ConclusaoReposicaoIndividual" c WHERE c."reposicaoId"=anterior.id)
   )) IS NOT TRUE
 ) THEN RAISE EXCEPTION 'A ausência já possui reposição pendente, autorizada ou concluída'; END IF;
 RETURN NEW;
END $$;

-- Uma rejeição resolve o pedido histórico mesmo que a chamada tenha sido
-- corrigida para presente ou a matrícula tenha sido pausada. Só a aprovação
-- cria novo atendimento e por isso revalida matrícula e ausência efetiva.
CREATE OR REPLACE FUNCTION validar_decisao_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pedido "ReposicaoIndividual"%ROWTYPE; origem "EncontroAgenda"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('reposicao-individual',0));
 SELECT * INTO pedido FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId" FOR SHARE;
 IF pedido.id IS NULL THEN RAISE EXCEPTION 'Pedido de reposição não encontrado'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo
   AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decisão de reposição exige gestão ativa'; END IF;
 IF pedido."solicitanteId"=NEW."decisorId" THEN RAISE EXCEPTION 'Solicitante não pode decidir a própria reposição'; END IF;
 PERFORM id FROM "Matricula"
   WHERE id=pedido."matriculaId" AND (NEW.aprovada IS FALSE OR status='ATIVA') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'A matrícula da reposição não permite aprovação'; END IF;
 SELECT * INTO origem FROM "EncontroAgenda" WHERE id=pedido."aulaOriginalId" FOR SHARE;
 IF origem.id IS NULL OR origem.finalidade<>'AULA' OR origem."turmaId" IS NULL OR origem.status<>'MINISTRADO' OR origem.fim >= (clock_timestamp() AT TIME ZONE 'UTC') THEN
  RAISE EXCEPTION 'A aula original não permite decisão de reposição';
 END IF;
 IF NEW.aprovada AND NOT EXISTS (
  SELECT 1 FROM "AulaDiario" diario JOIN "RegistroAulaAluno" registro ON registro."aulaId"=diario.id
  JOIN "Matricula" matricula ON matricula.id=pedido."matriculaId"
  WHERE diario."encontroId"=origem.id AND registro."matriculaId"=pedido."matriculaId"
    AND registro."alunoId"=matricula."alunoId"
    AND participacao_aula_efetiva(registro.id) IN ('FALTA','IMPEDIDO_POR_RESTRICAO')
 ) THEN RAISE EXCEPTION 'A ausência original efetiva não corresponde à matrícula da reposição'; END IF;
 RETURN NEW;
END $$;

-- A agenda já existente é histórica. O teste abaixo só intercepta uma nova
-- associação (ou troca de pedido), sem apagar nem invalidar agendamentos
-- preparados antes de uma correção publicada.
CREATE OR REPLACE FUNCTION validar_origem_efetiva_agenda_reposicao_207()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."reposicaoId" IS NOT DISTINCT FROM OLD."reposicaoId" THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  IF NOT EXISTS (
    SELECT 1
    FROM "ReposicaoIndividual" reposicao
    JOIN "Matricula" matricula ON matricula.id = reposicao."matriculaId"
    JOIN "EncontroAgenda" origem ON origem.id = reposicao."aulaOriginalId"
    JOIN "AulaDiario" diario ON diario."encontroId" = origem.id
    JOIN "RegistroAulaAluno" registro ON registro."aulaId" = diario.id
    WHERE reposicao.id = NEW."reposicaoId"
      AND reposicao.modalidade = 'PARTICULAR'::"ModalidadeReposicaoIndividual"
      AND origem.finalidade = 'AULA'::"FinalidadeEncontroAgenda"
      AND origem.status = 'MINISTRADO'::"StatusEncontroAgenda"
      AND origem."turmaId" IS NOT NULL
      AND origem.fim < (clock_timestamp() AT TIME ZONE 'UTC')
      AND registro."matriculaId" = reposicao."matriculaId"
      AND registro."alunoId" = matricula."alunoId"
      AND participacao_aula_efetiva(registro.id) IN (
        'FALTA'::"ParticipacaoAula", 'IMPEDIDO_POR_RESTRICAO'::"ParticipacaoAula"
      )
  ) THEN
    RAISE EXCEPTION 'Agenda exige falta ou impedimento efetivo na aula original';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validar_origem_efetiva_agenda_reposicao_207
BEFORE INSERT OR UPDATE OF "reposicaoId" ON "AgendaReposicaoIndividual"
FOR EACH ROW EXECUTE FUNCTION validar_origem_efetiva_agenda_reposicao_207();
