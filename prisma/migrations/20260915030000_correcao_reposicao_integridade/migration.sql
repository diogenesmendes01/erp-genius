-- Q54: a correção é append-only, mas sua fonte deve continuar conferível no
-- instante da proposta e novamente ao publicar a aprovação. Não muda schema.

ALTER TABLE "CorrecaoConclusaoReposicaoIndividual"
  ALTER COLUMN "criadaEm" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text);
ALTER TABLE "DecisaoCorrecaoConclusaoReposicao"
  ALTER COLUMN "decididaEm" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text);

CREATE OR REPLACE FUNCTION conferir_fonte_correcao_conclusao_reposicao_200(
  reposicao_id TEXT,
  concluida BOOLEAN,
  encontro_reposicao_id TEXT,
  realizada_em TIMESTAMP(3),
  entrega_id TEXT,
  validada_em TIMESTAMP(3),
  validada_por_id TEXT
) RETURNS VOID AS $$
DECLARE
  reposicao "ReposicaoIndividual"%ROWTYPE;
  matricula "Matricula"%ROWTYPE;
  origem "EncontroAgenda"%ROWTYPE;
  encontro "EncontroAgenda"%ROWTYPE;
  entrega "EntregaReposicaoGravacao"%ROWTYPE;
  avaliador "Usuario"%ROWTYPE;
  agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  SELECT * INTO reposicao FROM "ReposicaoIndividual" WHERE id = reposicao_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reposição da correção não encontrada';
  END IF;
  SELECT * INTO matricula FROM "Matricula" WHERE id = reposicao."matriculaId" FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula da correção não encontrada';
  END IF;
  SELECT * INTO origem FROM "EncontroAgenda" WHERE id = reposicao."aulaOriginalId" FOR SHARE;
  IF NOT FOUND OR origem.finalidade IS DISTINCT FROM 'AULA'::"FinalidadeEncontroAgenda"
    OR origem."turmaId" IS NULL OR origem.status IS DISTINCT FROM 'MINISTRADO'::"StatusEncontroAgenda" THEN
    RAISE EXCEPTION 'A correção exige aula original coletiva já ministrada';
  END IF;

  -- Retirar uma conclusão não inventa nova fonte; os valores anteriores ficam
  -- preservados na conclusão imutável e a projeção passa a indicar pendência.
  IF concluida IS FALSE THEN
    IF encontro_reposicao_id IS NOT NULL OR realizada_em IS NOT NULL OR entrega_id IS NOT NULL
      OR validada_em IS NOT NULL OR validada_por_id IS NOT NULL THEN
      RAISE EXCEPTION 'Retirada de conclusão não aceita fonte de reposição';
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "DecisaoReposicaoIndividual"
    WHERE "reposicaoId" = reposicao.id AND aprovada
  ) THEN
    RAISE EXCEPTION 'Correção concluída exige reposição autorizada';
  END IF;

  IF reposicao.modalidade = 'PARTICULAR'::"ModalidadeReposicaoIndividual" THEN
    IF encontro_reposicao_id IS NULL OR realizada_em IS NULL OR entrega_id IS NOT NULL
      OR validada_em IS NOT NULL OR validada_por_id IS NOT NULL THEN
      RAISE EXCEPTION 'Correção particular exige somente encontro de reposição realizado';
    END IF;
    SELECT * INTO encontro FROM "EncontroAgenda" WHERE id = encontro_reposicao_id FOR SHARE;
    IF NOT FOUND OR encontro.finalidade IS DISTINCT FROM 'REPOSICAO'::"FinalidadeEncontroAgenda"
      OR encontro."turmaId" IS NOT NULL OR encontro."matriculaId" IS DISTINCT FROM reposicao."matriculaId"
      OR encontro."reposicaoIndividualId" IS DISTINCT FROM reposicao.id
      OR encontro.status IS DISTINCT FROM 'MINISTRADO'::"StatusEncontroAgenda"
      OR encontro.fim > agora OR encontro.fim < origem.fim OR realizada_em IS DISTINCT FROM encontro.fim
      OR NOT EXISTS (
        SELECT 1
        FROM "AgendaReposicaoIndividual" agenda
        WHERE agenda."reposicaoId" = reposicao.id AND agenda."encontroId" = encontro.id
      )
      OR NOT EXISTS (
        SELECT 1
        FROM "AulaDiario" diario
        JOIN "RegistroAulaAluno" registro ON registro."aulaId" = diario.id
        WHERE diario."encontroId" = encontro.id
          AND registro."matriculaId" = reposicao."matriculaId"
          AND registro."alunoId" = matricula."alunoId"
          AND registro.participacao = 'PRESENTE'::"ParticipacaoAula"
      ) THEN
      RAISE EXCEPTION 'Correção particular exige agenda própria, matrícula, encontro ministrado e presença';
    END IF;
    RETURN;
  END IF;

  IF reposicao.modalidade IS DISTINCT FROM 'GRAVACAO'::"ModalidadeReposicaoIndividual"
    OR encontro_reposicao_id IS NOT NULL OR realizada_em IS NOT NULL OR entrega_id IS NULL
    OR validada_em IS NULL OR validada_por_id IS NULL OR validada_em > agora OR validada_em < origem.fim THEN
    RAISE EXCEPTION 'Correção gravada exige entrega e validação posterior compatíveis';
  END IF;
  SELECT * INTO entrega FROM "EntregaReposicaoGravacao" WHERE id = entrega_id FOR SHARE;
  SELECT * INTO avaliador FROM "Usuario" WHERE id = validada_por_id FOR SHARE;
  IF NOT FOUND OR NOT avaliador.ativo OR NOT ('PROFESSOR'::"Papel" = ANY(avaliador.papeis))
    OR entrega.id IS NULL OR entrega."reposicaoId" IS DISTINCT FROM reposicao.id
    OR entrega."alunoId" IS DISTINCT FROM matricula."alunoId"
    OR COALESCE(btrim(entrega.resumo), '') = '' OR COALESCE(btrim(entrega.atividade), '') = ''
    OR entrega."entregueEm" > validada_em
    OR (SELECT COUNT(*) FROM "DesignacaoAvaliadorReposicaoIndividual" designacao
        WHERE designacao."reposicaoId" = reposicao.id
          AND designacao.inicio <= validada_em
          AND (designacao.fim IS NULL OR designacao.fim > validada_em)) IS DISTINCT FROM 1
    OR NOT EXISTS (
      SELECT 1 FROM "DesignacaoAvaliadorReposicaoIndividual" designacao
      WHERE designacao."reposicaoId" = reposicao.id
        AND designacao."professorId" = avaliador.id
        AND designacao.inicio <= validada_em
        AND (designacao.fim IS NULL OR designacao.fim > validada_em)
    ) THEN
    RAISE EXCEPTION 'Correção gravada exige entrega da matrícula e docente ativo designado na validação';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validar_correcao_conclusao_reposicao() RETURNS TRIGGER AS $$
DECLARE
  reposicao_id TEXT;
  conclusao "ConclusaoReposicaoIndividual"%ROWTYPE;
  autor "Usuario"%ROWTYPE;
  agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Correções de conclusão são imutáveis';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  -- A leitura inicial só descobre a chave. A ordem efetiva de locks é
  -- calendário, reposição e conclusão, igual à decisão abaixo.
  SELECT "reposicaoId" INTO reposicao_id FROM "ConclusaoReposicaoIndividual" WHERE id = NEW."conclusaoId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conclusão de reposição não encontrada';
  END IF;
  PERFORM 1 FROM "ReposicaoIndividual" WHERE id = reposicao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reposição da conclusão não encontrada';
  END IF;
  SELECT * INTO conclusao FROM "ConclusaoReposicaoIndividual" WHERE id = NEW."conclusaoId" FOR UPDATE;
  IF NOT FOUND OR conclusao."reposicaoId" IS DISTINCT FROM reposicao_id THEN
    RAISE EXCEPTION 'Conclusão de reposição não corresponde ao contexto';
  END IF;
  SELECT * INTO autor FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT autor.ativo OR (
    NOT ('GERENTE_PEDAGOGICO'::"Papel" = ANY(autor.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(autor.papeis))
    AND (
      NOT ('PROFESSOR'::"Papel" = ANY(autor.papeis))
      OR NOT EXISTS (
        SELECT 1 FROM "DesignacaoAvaliadorReposicaoIndividual" designacao
        WHERE designacao."reposicaoId" = reposicao_id AND designacao."professorId" = autor.id
          AND designacao.inicio <= agora AND (designacao.fim IS NULL OR designacao.fim > agora)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Correção exige gestão ativa ou professor designado vigente';
  END IF;
  IF NEW.versao IS DISTINCT FROM COALESCE((
    SELECT MAX(versao) FROM "CorrecaoConclusaoReposicaoIndividual" WHERE "conclusaoId" = conclusao.id
  ), 0) + 1 OR COALESCE(btrim(NEW.evidencia), '') = '' OR COALESCE(btrim(NEW.motivo), '') = '' THEN
    RAISE EXCEPTION 'Correção exige versão sequencial, motivo e evidência';
  END IF;
  PERFORM conferir_fonte_correcao_conclusao_reposicao_200(
    reposicao_id, NEW.concluida, NEW."encontroReposicaoId", NEW."realizadaEm",
    NEW."entregaId", NEW."validadaEm", NEW."validadaPorId"
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validar_decisao_correcao_reposicao() RETURNS TRIGGER AS $$
DECLARE
  conclusao_id TEXT;
  reposicao_id TEXT;
  conclusao "ConclusaoReposicaoIndividual"%ROWTYPE;
  correcao "CorrecaoConclusaoReposicaoIndividual"%ROWTYPE;
  decisor "Usuario"%ROWTYPE;
  autor "Usuario"%ROWTYPE;
  agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Decisões de correção de reposição são imutáveis';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  SELECT "conclusaoId" INTO conclusao_id FROM "CorrecaoConclusaoReposicaoIndividual" WHERE id = NEW."correcaoId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Correção de conclusão não encontrada';
  END IF;
  SELECT "reposicaoId" INTO reposicao_id FROM "ConclusaoReposicaoIndividual" WHERE id = conclusao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conclusão da correção não encontrada';
  END IF;
  PERFORM 1 FROM "ReposicaoIndividual" WHERE id = reposicao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reposição da correção não encontrada';
  END IF;
  SELECT * INTO conclusao FROM "ConclusaoReposicaoIndividual" WHERE id = conclusao_id FOR UPDATE;
  SELECT * INTO correcao FROM "CorrecaoConclusaoReposicaoIndividual" WHERE id = NEW."correcaoId" FOR UPDATE;
  IF NOT FOUND OR correcao."conclusaoId" IS DISTINCT FROM conclusao.id THEN
    RAISE EXCEPTION 'Correção não pertence à conclusão informada';
  END IF;
  SELECT * INTO decisor FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF NOT FOUND OR NOT decisor.ativo
    OR NOT ('GERENTE_PEDAGOGICO'::"Papel" = ANY(decisor.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(decisor.papeis))
    OR correcao."autorId" = decisor.id THEN
    RAISE EXCEPTION 'Correção exige decisão de outra pessoa da gestão ativa';
  END IF;

  -- Recusas permanecem históricas: não substituem fonte nem revalidam fatos
  -- que só seriam relevantes para uma publicação aprovada.
  IF NEW.aprovada IS FALSE THEN
    RETURN NEW;
  END IF;
  IF correcao.versao IS DISTINCT FROM (
    SELECT MAX(versao) FROM "CorrecaoConclusaoReposicaoIndividual" WHERE "conclusaoId" = conclusao.id
  ) OR conclusao.versao IS DISTINCT FROM (
    SELECT MAX(versao) FROM "ConclusaoReposicaoIndividual" WHERE "reposicaoId" = reposicao_id
  ) THEN
    RAISE EXCEPTION 'A correção ou a conclusão foi superada; prepare nova proposta';
  END IF;
  SELECT * INTO autor FROM "Usuario" WHERE id = correcao."autorId" FOR SHARE;
  IF NOT FOUND OR NOT autor.ativo OR (
    NOT ('GERENTE_PEDAGOGICO'::"Papel" = ANY(autor.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(autor.papeis))
    AND (
      NOT ('PROFESSOR'::"Papel" = ANY(autor.papeis))
      OR NOT EXISTS (
        SELECT 1 FROM "DesignacaoAvaliadorReposicaoIndividual" designacao
        WHERE designacao."reposicaoId" = reposicao_id AND designacao."professorId" = autor.id
          AND designacao.inicio <= agora AND (designacao.fim IS NULL OR designacao.fim > agora)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Autor da correção não possui mais autorização vigente';
  END IF;
  PERFORM conferir_fonte_correcao_conclusao_reposicao_200(
    reposicao_id, correcao.concluida, correcao."encontroReposicaoId", correcao."realizadaEm",
    correcao."entregaId", correcao."validadaEm", correcao."validadaPorId"
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
