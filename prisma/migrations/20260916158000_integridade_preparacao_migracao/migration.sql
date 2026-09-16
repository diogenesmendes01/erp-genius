-- M01 corretiva: a fotografia e suas evidências não podem ser reescritas ou apagadas.
CREATE FUNCTION "proteger_lote_preparacao_migracao_158"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origem IS DISTINCT FROM OLD.origem
     OR NEW."chaveLote" IS DISTINCT FROM OLD."chaveLote"
     OR NEW."entradaHash" IS DISTINCT FROM OLD."entradaHash"
     OR NEW."preparadoPorId" IS DISTINCT FROM OLD."preparadoPorId" THEN
    RAISE EXCEPTION 'Lote de preparação de migração é imutável';
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NOT (OLD.estado = 'PREPARADO'::"EstadoLotePreparacaoMigracao" AND NEW.estado = 'COM_PENDENCIAS'::"EstadoLotePreparacaoMigracao") THEN
    RAISE EXCEPTION 'Transição de estado do lote de preparação não permitida';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LotePreparacaoMigracao_imutavel_158"
  BEFORE UPDATE ON "LotePreparacaoMigracao"
  FOR EACH ROW EXECUTE FUNCTION "proteger_lote_preparacao_migracao_158"();

CREATE FUNCTION "proteger_estado_linha_preparacao_migracao_158"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NEW.estado <> 'COLISAO_ORIGEM'::"EstadoLinhaPreparacaoMigracao" THEN
    RAISE EXCEPTION 'Linha de preparação só pode avançar para colisão de origem';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LinhaPreparacaoMigracao_estado_158"
  BEFORE UPDATE ON "LinhaPreparacaoMigracao"
  FOR EACH ROW EXECUTE FUNCTION "proteger_estado_linha_preparacao_migracao_158"();

CREATE FUNCTION "proibir_exclusao_preparacao_migracao_158"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evidência de preparação de migração não pode ser excluída';
END $$;
CREATE TRIGGER "LotePreparacaoMigracao_sem_delete_158" BEFORE DELETE ON "LotePreparacaoMigracao" FOR EACH ROW EXECUTE FUNCTION "proibir_exclusao_preparacao_migracao_158"();
CREATE TRIGGER "LinhaPreparacaoMigracao_sem_delete_158" BEFORE DELETE ON "LinhaPreparacaoMigracao" FOR EACH ROW EXECUTE FUNCTION "proibir_exclusao_preparacao_migracao_158"();
CREATE TRIGGER "PendenciaCampoPreparacaoMigracao_sem_delete_158" BEFORE DELETE ON "PendenciaCampoPreparacaoMigracao" FOR EACH ROW EXECUTE FUNCTION "proibir_exclusao_preparacao_migracao_158"();
CREATE TRIGGER "ColisaoOrigemPreparacaoMigracao_sem_delete_158" BEFORE DELETE ON "ColisaoOrigemPreparacaoMigracao" FOR EACH ROW EXECUTE FUNCTION "proibir_exclusao_preparacao_migracao_158"();
CREATE TRIGGER "ConflitoLinhaPreparacaoMigracao_sem_delete_158" BEFORE DELETE ON "ConflitoLinhaPreparacaoMigracao" FOR EACH ROW EXECUTE FUNCTION "proibir_exclusao_preparacao_migracao_158"();

CREATE FUNCTION "proibir_atualizacao_evidencia_preparacao_migracao_158"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evidência de preparação de migração é imutável';
END $$;
CREATE TRIGGER "PendenciaCampoPreparacaoMigracao_sem_update_158" BEFORE UPDATE ON "PendenciaCampoPreparacaoMigracao" FOR EACH ROW EXECUTE FUNCTION "proibir_atualizacao_evidencia_preparacao_migracao_158"();
CREATE TRIGGER "ColisaoOrigemPreparacaoMigracao_sem_update_158" BEFORE UPDATE ON "ColisaoOrigemPreparacaoMigracao" FOR EACH ROW EXECUTE FUNCTION "proibir_atualizacao_evidencia_preparacao_migracao_158"();
CREATE TRIGGER "ConflitoLinhaPreparacaoMigracao_sem_update_158" BEFORE UPDATE ON "ConflitoLinhaPreparacaoMigracao" FOR EACH ROW EXECUTE FUNCTION "proibir_atualizacao_evidencia_preparacao_migracao_158"();
