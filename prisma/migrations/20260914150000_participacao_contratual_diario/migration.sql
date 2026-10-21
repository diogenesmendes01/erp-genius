CREATE TYPE "ParticipacaoAula" AS ENUM ('PRESENTE', 'FALTA', 'IMPEDIDO_POR_RESTRICAO');
ALTER TABLE "RegistroAulaAluno" ADD COLUMN "matriculaId" TEXT, ADD COLUMN participacao "ParticipacaoAula";
-- Não inferir identidade contratual ou natureza de ausências nos registros antigos.
ALTER TABLE "RegistroAulaAluno" ADD CONSTRAINT registro_aula_contrato_fkey
 FOREIGN KEY ("matriculaId", "alunoId") REFERENCES "Matricula" (id, "alunoId") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "RegistroAulaAluno" ADD CONSTRAINT registro_aula_participacao_coerente CHECK (
 participacao IS NULL OR ("matriculaId" IS NOT NULL AND presente IS NOT NULL AND
 ((participacao = 'PRESENTE' AND presente) OR (participacao IN ('FALTA','IMPEDIDO_POR_RESTRICAO') AND NOT presente))));
CREATE FUNCTION preservar_contrato_registro_aula() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."matriculaId" IS NOT NULL AND (NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId" OR NEW."alunoId" <> OLD."alunoId" OR NEW."aulaId" <> OLD."aulaId") THEN
  RAISE EXCEPTION 'Preserve a identidade contratual do registro da aula';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preservar_contrato_registro_aula BEFORE UPDATE ON "RegistroAulaAluno"
 FOR EACH ROW EXECUTE FUNCTION preservar_contrato_registro_aula();
