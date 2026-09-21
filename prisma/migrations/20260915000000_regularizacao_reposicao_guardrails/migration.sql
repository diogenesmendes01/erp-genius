-- Reforços após a primeira aplicação de regularização individual.
ALTER TABLE "ConclusaoReposicaoIndividual" ADD COLUMN "concluidaPorId" TEXT;
ALTER TABLE "ConclusaoReposicaoIndividual" ADD CONSTRAINT "ConclusaoReposicaoIndividual_concluidaPorId_fkey" FOREIGN KEY ("concluidaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ConclusaoReposicaoIndividual" ALTER COLUMN "concluidaPorId" SET NOT NULL;
DROP INDEX "CorrecaoConclusaoReposicaoIndividual_entregaId_key";
ALTER INDEX "DesignacaoAvaliadorReposicaoIndividual_reposicaoId_professorId_" RENAME TO "DesignacaoAvaliadorReposicaoIndividual_reposicaoId_professo_idx";

CREATE TRIGGER proteger_designacao_reposicao BEFORE UPDATE OR DELETE ON "DesignacaoAvaliadorReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();

-- Diário é permitido exclusivamente no encontro acadêmico REPOSICAO; os
-- demais consumidores continuam exigindo AULA e não podem usar este desvio.
CREATE OR REPLACE FUNCTION exigir_encontro_de_aula() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE encontro_id TEXT; finalidade_atual "FinalidadeEncontroAgenda";
BEGIN
  encontro_id := CASE WHEN TG_TABLE_NAME = 'PropostaRemarcacaoParticular' THEN to_jsonb(NEW)->>'encontroOriginalId' ELSE to_jsonb(NEW)->>'encontroId' END;
  IF encontro_id IS NULL THEN RETURN NEW; END IF;
  SELECT finalidade INTO finalidade_atual FROM "EncontroAgenda" WHERE id = encontro_id FOR SHARE;
  IF TG_TABLE_NAME = 'AulaDiario' AND finalidade_atual = 'REPOSICAO'::"FinalidadeEncontroAgenda" THEN RETURN NEW; END IF;
  IF finalidade_atual IS DISTINCT FROM 'AULA'::"FinalidadeEncontroAgenda" THEN RAISE EXCEPTION 'Operação exige encontro de aula; recuperação não gera diário, cobrança ou consumo de horas'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION usuario_gestao_ativo(usuario TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM "Usuario" WHERE id = usuario AND ativo AND (papeis @> ARRAY['GERENTE_PEDAGOGICO']::"Papel"[] OR papeis @> ARRAY['ADMINISTRADOR']::"Papel"[]))
$$;
CREATE OR REPLACE FUNCTION usuario_professor_ativo(usuario TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM "Usuario" WHERE id = usuario AND ativo AND papeis @> ARRAY['PROFESSOR']::"Papel"[])
$$;

CREATE OR REPLACE FUNCTION validar_decisao_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT usuario_gestao_ativo(NEW."decisorId") THEN RAISE EXCEPTION 'Decisão de reposição exige gestão pedagógica ativa'; END IF;
  IF EXISTS (SELECT 1 FROM "ReposicaoIndividual" WHERE id = NEW."reposicaoId" AND "solicitanteId" = NEW."decisorId") THEN RAISE EXCEPTION 'Solicitante não pode decidir a própria reposição'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id=r."matriculaId" WHERE r.id=NEW."reposicaoId" AND m.status='ATIVA') THEN RAISE EXCEPTION 'Decisão exige matrícula ativa'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_conclusao_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE modalidade "ModalidadeReposicaoIndividual"; aluno_contrato TEXT; fim_origem TIMESTAMP(3); fim_encontro TIMESTAMP(3); presente "ParticipacaoAula";
BEGIN
  SELECT r.modalidade, m."alunoId", origem.fim INTO modalidade, aluno_contrato, fim_origem FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id=r."matriculaId" JOIN "EncontroAgenda" origem ON origem.id=r."aulaOriginalId" WHERE r.id=NEW."reposicaoId" AND m.status='ATIVA';
  IF modalidade IS NULL OR NOT EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=NEW."reposicaoId" AND aprovada) OR NEW.concluida IS NOT TRUE THEN RAISE EXCEPTION 'Conclusão exige matrícula ativa, autorização aprovada e resultado concluído'; END IF;
  IF modalidade='PARTICULAR' THEN
    SELECT e.fim, registro.participacao INTO fim_encontro, presente FROM "EncontroAgenda" e LEFT JOIN "AulaDiario" diario ON diario."encontroId"=e.id LEFT JOIN "RegistroAulaAluno" registro ON registro."aulaId"=diario.id AND registro."alunoId"=aluno_contrato WHERE e.id=NEW."encontroReposicaoId" AND e.finalidade='REPOSICAO' AND e."turmaId" IS NULL AND e."matriculaId"=(SELECT "matriculaId" FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId") AND e.status='MINISTRADO';
    IF NOT usuario_professor_ativo(NEW."concluidaPorId") OR NEW."concluidaPorId" <> (SELECT "professorId" FROM "EncontroAgenda" WHERE id=NEW."encontroReposicaoId") OR NEW."encontroReposicaoId" IS NULL OR NEW."realizadaEm" IS NULL OR NEW."entregaId" IS NOT NULL OR NEW."validadaEm" IS NOT NULL OR NEW."validadaPorId" IS NOT NULL OR fim_encontro IS NULL OR fim_encontro<>NEW."realizadaEm" OR fim_encontro<fim_origem OR presente<>'PRESENTE' THEN RAISE EXCEPTION 'Particular exige docente ativo responsável, encontro REPOSICAO realizado e presença'; END IF;
  ELSE
    IF NOT usuario_professor_ativo(NEW."concluidaPorId") OR NEW."concluidaPorId"<>NEW."validadaPorId" OR NEW."entregaId" IS NULL OR NEW."validadaEm" IS NULL OR NEW."validadaPorId" IS NULL OR NEW."encontroReposicaoId" IS NOT NULL OR NEW."realizadaEm" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "EntregaReposicaoGravacao" WHERE id=NEW."entregaId" AND "reposicaoId"=NEW."reposicaoId" AND "entregueEm"<=NEW."validadaEm") OR NEW."validadaEm"<fim_origem OR NOT EXISTS (SELECT 1 FROM "DesignacaoAvaliadorReposicaoIndividual" d WHERE d."reposicaoId"=NEW."reposicaoId" AND d."professorId"=NEW."validadaPorId" AND d.inicio<=NEW."validadaEm" AND (d.fim IS NULL OR d.fim>NEW."validadaEm")) THEN RAISE EXCEPTION 'Gravação exige entrega, docente ativo designado e validação posterior'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_correcao_conclusao_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reposicao TEXT; anterior INTEGER;
BEGIN
  SELECT "reposicaoId" INTO reposicao FROM "ConclusaoReposicaoIndividual" WHERE id=NEW."conclusaoId";
  SELECT COALESCE(MAX(versao),0) INTO anterior FROM "CorrecaoConclusaoReposicaoIndividual" WHERE "conclusaoId"=NEW."conclusaoId";
  IF reposicao IS NULL OR NEW.versao<>anterior+1 OR btrim(NEW.evidencia)='' OR btrim(NEW.motivo)='' OR NOT EXISTS (SELECT 1 FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id=r."matriculaId" WHERE r.id=reposicao AND m.status='ATIVA') THEN RAISE EXCEPTION 'Correção exige matrícula ativa, versão, motivo e evidência'; END IF;
  IF NOT usuario_gestao_ativo(NEW."autorId") AND (NOT usuario_professor_ativo(NEW."autorId") OR NOT EXISTS (SELECT 1 FROM "DesignacaoAvaliadorReposicaoIndividual" d WHERE d."reposicaoId"=reposicao AND d."professorId"=NEW."autorId" AND d.inicio<=CURRENT_TIMESTAMP AND (d.fim IS NULL OR d.fim>CURRENT_TIMESTAMP))) THEN RAISE EXCEPTION 'Correção exige gestão ou professor designado ativo'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_decisao_correcao_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE autor TEXT;
BEGIN
  SELECT "autorId" INTO autor FROM "CorrecaoConclusaoReposicaoIndividual" WHERE id=NEW."correcaoId";
  IF NOT usuario_gestao_ativo(NEW."decisorId") OR autor IS NULL OR autor=NEW."decisorId" THEN RAISE EXCEPTION 'Correção exige decisão de outra pessoa da gestão ativa'; END IF;
  RETURN NEW;
END $$;
