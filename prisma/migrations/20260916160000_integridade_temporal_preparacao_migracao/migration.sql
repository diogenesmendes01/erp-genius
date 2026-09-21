-- M01 corretiva temporal: id e instante de captura integram a fotografia imutável.
CREATE OR REPLACE FUNCTION "proteger_lote_preparacao_migracao_158"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.origem IS DISTINCT FROM OLD.origem
     OR NEW."chaveLote" IS DISTINCT FROM OLD."chaveLote"
     OR NEW."entradaHash" IS DISTINCT FROM OLD."entradaHash"
     OR NEW."preparadoPorId" IS DISTINCT FROM OLD."preparadoPorId"
     OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" THEN
    RAISE EXCEPTION 'Lote de preparação de migração é imutável';
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NOT (OLD.estado = 'PREPARADO'::"EstadoLotePreparacaoMigracao" AND NEW.estado = 'COM_PENDENCIAS'::"EstadoLotePreparacaoMigracao") THEN
    RAISE EXCEPTION 'Transição de estado do lote de preparação não permitida';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "proteger_linha_preparacao_migracao_155"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."loteId" IS DISTINCT FROM OLD."loteId"
     OR NEW."linhaOrigem" IS DISTINCT FROM OLD."linhaOrigem"
     OR NEW."alunoOrigemId" IS DISTINCT FROM OLD."alunoOrigemId"
     OR NEW."turmaOrigemId" IS DISTINCT FROM OLD."turmaOrigemId"
     OR NEW."matriculaOrigemId" IS DISTINCT FROM OLD."matriculaOrigemId"
     OR NEW."financeiroOrigemId" IS DISTINCT FROM OLD."financeiroOrigemId"
     OR NEW."dadosOrigem" IS DISTINCT FROM OLD."dadosOrigem"
     OR NEW."entradaHash" IS DISTINCT FROM OLD."entradaHash"
     OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" THEN
    RAISE EXCEPTION 'Linha de preparação de migração é imutável';
  END IF;
  RETURN NEW;
END $$;
