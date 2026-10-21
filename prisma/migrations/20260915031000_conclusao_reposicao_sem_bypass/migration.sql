-- Q54: uma conclusão efetiva só muda por correção aprovada. Uma nova
-- conclusão é permitida exclusivamente depois de a última correção aprovada
-- ter retirado a fonte anterior, para registrar a nova avaliação sem apagar o
-- histórico. Este reforço não altera a regra de fonte já aplicada em 03000.

CREATE OR REPLACE FUNCTION validar_conclusao_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reposicao "ReposicaoIndividual"%ROWTYPE;
  ultima_conclusao "ConclusaoReposicaoIndividual"%ROWTYPE;
  ultima_correcao_concluida BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Conclusões de reposição são imutáveis';
  END IF;

  -- Ordem compartilhada por correções/decisões: calendário, reposição,
  -- conclusão. O lock antecede toda consulta de versão para serializar o
  -- caminho normal e o INSERT SQL direto.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO reposicao
  FROM "ReposicaoIndividual"
  WHERE id = NEW."reposicaoId"
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reposição da conclusão não encontrada';
  END IF;

  SELECT * INTO ultima_conclusao
  FROM "ConclusaoReposicaoIndividual"
  WHERE "reposicaoId" = reposicao.id
  ORDER BY versao DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF NEW.versao IS DISTINCT FROM ultima_conclusao.versao + 1 THEN
      RAISE EXCEPTION 'Conclusão exige a próxima versão sequencial';
    END IF;
    SELECT correcao.concluida INTO ultima_correcao_concluida
    FROM "CorrecaoConclusaoReposicaoIndividual" correcao
    JOIN "DecisaoCorrecaoConclusaoReposicao" decisao
      ON decisao."correcaoId" = correcao.id AND decisao.aprovada
    WHERE correcao."conclusaoId" = ultima_conclusao.id
    ORDER BY correcao.versao DESC, correcao.id DESC
    LIMIT 1
    FOR SHARE OF correcao, decisao;

    -- Sem correção aprovada, a conclusão anterior continua verdadeira. Uma
    -- correção aprovada que a mantém concluída também preserva sua vigência.
    IF NOT FOUND OR ultima_correcao_concluida IS TRUE THEN
      RAISE EXCEPTION 'A conclusão efetiva exige correção independente; nova conclusão só cabe após retirada aprovada';
    END IF;
  ELSIF NEW.versao IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'A primeira conclusão exige versão 1';
  END IF;

  IF NEW.concluida IS NOT TRUE OR NOT usuario_professor_ativo(NEW."concluidaPorId") THEN
    RAISE EXCEPTION 'Conclusão exige resultado concluído e docente ativo responsável';
  END IF;
  -- Centraliza a prova de aula original, matrícula/aluno, agenda/diário ou
  -- entrega, datas e designação. A mesma função protege as correções.
  PERFORM conferir_fonte_correcao_conclusao_reposicao_200(
    reposicao.id, NEW.concluida, NEW."encontroReposicaoId", NEW."realizadaEm",
    NEW."entregaId", NEW."validadaEm", NEW."validadaPorId"
  );
  IF reposicao.modalidade = 'PARTICULAR'::"ModalidadeReposicaoIndividual"
    AND NEW."concluidaPorId" IS DISTINCT FROM (
      SELECT "professorId" FROM "EncontroAgenda" WHERE id = NEW."encontroReposicaoId"
    ) THEN
    RAISE EXCEPTION 'Conclusão particular exige o professor responsável pelo encontro';
  ELSIF reposicao.modalidade = 'GRAVACAO'::"ModalidadeReposicaoIndividual"
    AND NEW."concluidaPorId" IS DISTINCT FROM NEW."validadaPorId" THEN
    RAISE EXCEPTION 'Conclusão gravada exige que o validador seja o docente responsável';
  END IF;
  IF btrim(NEW.evidencia) = '' THEN
    RAISE EXCEPTION 'Conclusão exige evidência';
  END IF;
  RETURN NEW;
END;
$$;
