-- Incremento 599: atendimento financeiro é sempre atribuído a um contrato explícito.
-- Legado sem matrícula permanece consultável; a regra só impede sua criação nova.
ALTER TABLE "AtendimentoWhatsApp" ADD COLUMN "matriculaId" TEXT;

ALTER TABLE "AtendimentoWhatsApp"
  ADD CONSTRAINT "AtendimentoWhatsApp_matriculaId_alunoId_fkey"
  FOREIGN KEY ("matriculaId", "alunoId") REFERENCES "Matricula"("id", "alunoId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "AtendimentoWhatsApp_matriculaId_idx" ON "AtendimentoWhatsApp"("matriculaId");

CREATE OR REPLACE FUNCTION validar_contexto_financeiro_atendimento_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."finalidade" = 'FINANCEIRO' AND NEW."matriculaId" IS NOT NULL AND NEW."alunoId" IS NULL THEN
    RAISE EXCEPTION 'Atendimento financeiro com matrícula exige aluno correspondente.';
  END IF;

  IF TG_OP = 'INSERT' AND NEW."finalidade" = 'FINANCEIRO' AND NEW."matriculaId" IS NULL THEN
    RAISE EXCEPTION 'Novo atendimento financeiro exige matrícula explícita.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."finalidade" = 'FINANCEIRO'
    AND (NEW."finalidade", NEW."conversaId", NEW."contextoChave", NEW."leadId", NEW."alunoId", NEW."turmaId", NEW."matriculaId")
      IS DISTINCT FROM (OLD."finalidade", OLD."conversaId", OLD."contextoChave", OLD."leadId", OLD."alunoId", OLD."turmaId", OLD."matriculaId") THEN
    RAISE EXCEPTION 'Contexto de atendimento financeiro é imutável.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."finalidade" <> 'FINANCEIRO' AND NEW."finalidade" = 'FINANCEIRO' THEN
    RAISE EXCEPTION 'Atendimento histórico não pode ser reclassificado como financeiro.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validar_contexto_financeiro_atendimento_whatsapp_trigger
BEFORE INSERT OR UPDATE ON "AtendimentoWhatsApp"
FOR EACH ROW EXECUTE FUNCTION validar_contexto_financeiro_atendimento_whatsapp();
