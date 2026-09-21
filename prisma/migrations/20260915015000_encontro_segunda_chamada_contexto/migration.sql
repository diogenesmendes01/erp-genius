-- Segunda chamada pertence à matrícula e à turma da avaliação pendente.
-- Demais finalidades mantêm a exclusividade original.
ALTER TABLE "EncontroAgenda" DROP CONSTRAINT "EncontroAgenda_check";
ALTER TABLE "EncontroAgenda" ADD CONSTRAINT "EncontroAgenda_check" CHECK (
  (finalidade='SEGUNDA_CHAMADA' AND "turmaId" IS NOT NULL AND "matriculaId" IS NOT NULL)
  OR (finalidade<>'SEGUNDA_CHAMADA' AND (("turmaId" IS NOT NULL) <> ("matriculaId" IS NOT NULL)))
);
ALTER TABLE "EncontroAgenda" DROP CONSTRAINT "encontro_recuperacao_individual";
ALTER TABLE "EncontroAgenda" ADD CONSTRAINT "encontro_recuperacao_individual" CHECK (
  finalidade IN ('AULA','SEGUNDA_CHAMADA') OR ("matriculaId" IS NOT NULL AND "turmaId" IS NULL)
);
CREATE FUNCTION conferir_contexto_encontro_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.finalidade='SEGUNDA_CHAMADA' AND NOT EXISTS (
    SELECT 1 FROM "PropostaSegundaChamada" p
    JOIN "DecisaoSegundaChamada" d ON d."propostaId"=p.id AND d.aprovada
    JOIN "DisponibilizacaoSegundaChamada" s ON s."propostaId"=p.id
    WHERE p."matriculaId"=NEW."matriculaId" AND p."turmaId"=NEW."turmaId"
  ) THEN RAISE EXCEPTION 'Encontro de segunda chamada exige avaliação aprovada e disponibilizada da matrícula e turma'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conferir_contexto_encontro_segunda_chamada BEFORE INSERT OR UPDATE OF finalidade,"matriculaId","turmaId" ON "EncontroAgenda" FOR EACH ROW EXECUTE FUNCTION conferir_contexto_encontro_segunda_chamada();
