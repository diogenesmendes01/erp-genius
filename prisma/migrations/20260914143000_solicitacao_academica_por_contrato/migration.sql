ALTER TABLE "SolicitacaoMudancaAcademica" ADD COLUMN "matriculaId" TEXT;
-- Usar somente a identidade preservada na proposta, sem inferir por cadastro.
UPDATE "SolicitacaoMudancaAcademica"
 SET "matriculaId" = NULLIF(snapshot->>'matriculaOrigemId', '');
ALTER TABLE "SolicitacaoMudancaAcademica" ADD CONSTRAINT "SolicitacaoMudancaAcademica_matriculaId_alunoId_fkey"
 FOREIGN KEY ("matriculaId", "alunoId") REFERENCES "Matricula" (id, "alunoId")
 ON DELETE RESTRICT ON UPDATE NO ACTION;
DROP INDEX mudanca_academica_uma_aberta_por_aluno;
CREATE UNIQUE INDEX mudanca_academica_uma_aberta_por_matricula
 ON "SolicitacaoMudancaAcademica" ("matriculaId")
 WHERE status IN ('PENDENTE','APROVADA') AND "matriculaId" IS NOT NULL;
CREATE UNIQUE INDEX mudanca_academica_uma_aberta_legada
 ON "SolicitacaoMudancaAcademica" ("alunoId")
 WHERE status IN ('PENDENTE','APROVADA') AND "matriculaId" IS NULL;

CREATE FUNCTION conferir_contrato_solicitacao_academica() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origem "AlocacaoTurma"%ROWTYPE;
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId"
   OR NEW."alunoId" IS DISTINCT FROM OLD."alunoId"
   OR NEW."alocacaoOrigemId" IS DISTINCT FROM OLD."alocacaoOrigemId" THEN
   RAISE EXCEPTION 'Identidade da solicitação acadêmica deve ser preservada';
  END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO origem FROM "AlocacaoTurma" WHERE id = NEW."alocacaoOrigemId" FOR SHARE;
 IF NOT FOUND OR origem."alunoId" <> NEW."alunoId"
  OR origem."matriculaId" IS DISTINCT FROM NEW."matriculaId"
  OR NULLIF(NEW.snapshot->>'matriculaOrigemId','') IS DISTINCT FROM NEW."matriculaId" THEN
  RAISE EXCEPTION 'Contrato da solicitação deve corresponder à alocação e à memória preservada';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contrato_solicitacao_academica
 BEFORE INSERT OR UPDATE OF "matriculaId", "alunoId", "alocacaoOrigemId"
 ON "SolicitacaoMudancaAcademica" FOR EACH ROW EXECUTE FUNCTION conferir_contrato_solicitacao_academica();
