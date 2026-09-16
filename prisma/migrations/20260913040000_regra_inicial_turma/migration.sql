-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "regraAvaliacaoId" TEXT;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_regraAvaliacaoId_fkey" FOREIGN KEY ("regraAvaliacaoId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION vincular_regra_inicial_turma() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW."regraAvaliacaoId" IS NOT NULL THEN
   RAISE EXCEPTION 'Regra inicial é selecionada da publicação vigente, não informada livremente';
  END IF;
  -- Datas históricas, estado iniciado/concluído ou data desconhecida exigem conferência.
  IF NEW.status IN ('PLANEJADA', 'ABERTA') AND NEW."dataInicio" > CURRENT_TIMESTAMP THEN
   PERFORM pg_advisory_xact_lock(hashtextextended('regra-avaliacao-nivel:' || NEW."nivelId", 0));
   SELECT v.id INTO NEW."regraAvaliacaoId" FROM "VersaoRegraAvaliacao" v
    JOIN "DecisaoRegraAvaliacao" d ON d."regraId" = v.id AND d.aprovada
    WHERE v."nivelId" = NEW."nivelId" ORDER BY v.versao DESC LIMIT 1;
  END IF;
 ELSE
  IF NEW."regraAvaliacaoId" IS DISTINCT FROM OLD."regraAvaliacaoId" THEN
   RAISE EXCEPTION 'Mudança de regra da turma exige revisão e aprovação específica';
  END IF;
  IF OLD."regraAvaliacaoId" IS NOT NULL AND NEW."nivelId" <> OLD."nivelId" THEN
   RAISE EXCEPTION 'Nível com regra vinculada não pode mudar por edição direta';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER vincular_regra_inicial_turma BEFORE INSERT OR UPDATE ON "Turma" FOR EACH ROW EXECUTE FUNCTION vincular_regra_inicial_turma();
-- Não preencher turmas existentes com regras atuais: histórico exige conferência.
