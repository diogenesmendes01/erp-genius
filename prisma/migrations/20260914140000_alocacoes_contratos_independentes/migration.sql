-- Matrículas distintas podem manter turmas independentes. A unicidade por
-- matrícula criada na expansão continua vigente; nenhum vínculo é inferido.
DROP INDEX "AlocacaoTurma_alunoId_ativa_key";
CREATE UNIQUE INDEX "AlocacaoTurma_legado_ativo_por_aluno"
 ON "AlocacaoTurma" ("alunoId") WHERE ativa AND "matriculaId" IS NULL;
CREATE UNIQUE INDEX "AlocacaoTurma_aluno_turma_ativa"
 ON "AlocacaoTurma" ("alunoId", "turmaId") WHERE ativa;

CREATE FUNCTION conferir_alocacao_legada_independente() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT NEW.ativa THEN RETURN NEW; END IF;
 PERFORM id FROM "Aluno" WHERE id = NEW."alunoId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "AlocacaoTurma" a WHERE a."alunoId" = NEW."alunoId"
   AND a.ativa AND a.id <> NEW.id
   AND (a."matriculaId" IS NULL OR NEW."matriculaId" IS NULL)) THEN
  RAISE EXCEPTION 'Confira o vínculo legado sem matrícula antes de manter contratos simultâneos';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a0_alocacao_legada_independente
 BEFORE INSERT OR UPDATE OF ativa, "alunoId", "matriculaId" ON "AlocacaoTurma"
 FOR EACH ROW EXECUTE FUNCTION conferir_alocacao_legada_independente();
