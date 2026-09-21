-- Relógio real em UTC para coluna timestamp; uma resposta por solicitação de correção.
DROP INDEX "EntregaReposicaoGravacao_solicitacaoCorrecaoId_key";
CREATE UNIQUE INDEX "EntregaReposicaoGravacao_solicitacaoCorrecaoId_key" ON "EntregaReposicaoGravacao"("solicitacaoCorrecaoId");

CREATE OR REPLACE FUNCTION validar_entrega_reposicao_gravacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matricula_aluno TEXT; modalidade "ModalidadeReposicaoIndividual"; anterior INTEGER;
BEGIN
  SELECT m."alunoId", r.modalidade INTO matricula_aluno, modalidade FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id = r."matriculaId" WHERE r.id = NEW."reposicaoId";
  SELECT COALESCE(MAX(versao), 0) INTO anterior FROM "EntregaReposicaoGravacao" WHERE "reposicaoId" = NEW."reposicaoId";
  IF modalidade IS DISTINCT FROM 'GRAVACAO' OR matricula_aluno IS DISTINCT FROM NEW."alunoId" OR NEW.versao <> anterior + 1
    OR btrim(NEW.resumo) = '' OR btrim(NEW.atividade) = '' OR btrim(NEW.evidencia) = '' OR NEW."entregueEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Entrega gravada exige aluno da matrícula, conteúdo, evidência, versão sequencial e data não futura';
  END IF;
  RETURN NEW;
END $$;
