CREATE TYPE "FinalidadeEncontroAgenda" AS ENUM ('AULA', 'RECUPERACAO');
ALTER TABLE "EncontroAgenda" ADD COLUMN finalidade "FinalidadeEncontroAgenda" NOT NULL DEFAULT 'AULA';
ALTER TABLE "EncontroAgenda" ADD CONSTRAINT encontro_recuperacao_individual CHECK (finalidade = 'AULA' OR ("matriculaId" IS NOT NULL AND "turmaId" IS NULL));

-- A publicação de recuperação será liberada somente pelo fluxo de aprovação
-- específico. Os consumidores de aula não podem servir como caminho alternativo.
CREATE FUNCTION preservar_finalidade_encontro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.finalidade <> OLD.finalidade THEN RAISE EXCEPTION 'Finalidade do encontro é imutável'; END IF;
 IF NEW.finalidade = 'RECUPERACAO' AND NEW.status <> 'RASCUNHO' THEN RAISE EXCEPTION 'Publicação de recuperação exige o fluxo específico de aprovação'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preservar_finalidade_encontro BEFORE INSERT OR UPDATE ON "EncontroAgenda" FOR EACH ROW EXECUTE FUNCTION preservar_finalidade_encontro();

CREATE FUNCTION exigir_encontro_de_aula() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE encontro_id TEXT; finalidade_atual "FinalidadeEncontroAgenda";
BEGIN
 encontro_id := CASE WHEN TG_TABLE_NAME = 'PropostaRemarcacaoParticular' THEN to_jsonb(NEW)->>'encontroOriginalId' ELSE to_jsonb(NEW)->>'encontroId' END;
 IF encontro_id IS NULL THEN RETURN NEW; END IF;
 SELECT finalidade INTO finalidade_atual FROM "EncontroAgenda" WHERE id = encontro_id FOR SHARE;
 IF finalidade_atual IS DISTINCT FROM 'AULA'::"FinalidadeEncontroAgenda" THEN RAISE EXCEPTION 'Operação exige encontro de aula; recuperação não gera diário, cobrança ou consumo de horas'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_finalidade_aula BEFORE INSERT OR UPDATE ON "AulaDiario" FOR EACH ROW EXECUTE FUNCTION exigir_encontro_de_aula();
CREATE TRIGGER a_finalidade_aula BEFORE INSERT OR UPDATE ON "ExcecaoGravacaoEncontro" FOR EACH ROW EXECUTE FUNCTION exigir_encontro_de_aula();
CREATE TRIGGER a_finalidade_aula BEFORE INSERT OR UPDATE ON "ReservaHorasCompradas" FOR EACH ROW EXECUTE FUNCTION exigir_encontro_de_aula();
CREATE TRIGGER a_finalidade_aula BEFORE INSERT OR UPDATE ON "OcorrenciaParticular" FOR EACH ROW EXECUTE FUNCTION exigir_encontro_de_aula();
CREATE TRIGGER a_finalidade_aula BEFORE INSERT OR UPDATE ON "PropostaCancelamentoParticular" FOR EACH ROW EXECUTE FUNCTION exigir_encontro_de_aula();
CREATE TRIGGER a_finalidade_aula BEFORE INSERT OR UPDATE ON "PropostaRemarcacaoParticular" FOR EACH ROW EXECUTE FUNCTION exigir_encontro_de_aula();
CREATE TRIGGER a_finalidade_aula BEFORE INSERT OR UPDATE ON "ItemSubstituicaoDocente" FOR EACH ROW EXECUTE FUNCTION exigir_encontro_de_aula();
