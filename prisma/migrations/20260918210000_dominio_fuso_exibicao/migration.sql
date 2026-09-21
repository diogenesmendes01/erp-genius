-- PostgreSQL reconhece Factory, mas a runtime Intl não. Preferência inválida
-- volta ao fallback de origem antes de reforçar a mesma regra no banco.
UPDATE "Usuario" SET "fusoExibicao" = NULL WHERE "fusoExibicao" = 'Factory';
UPDATE "ContaPortalAluno" SET "fusoExibicao" = NULL WHERE "fusoExibicao" = 'Factory';

CREATE OR REPLACE FUNCTION validar_fuso_exibicao_266()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."fusoExibicao" IS NOT NULL
    AND (NEW."fusoExibicao" = 'Factory'
      OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW."fusoExibicao")) THEN
    RAISE EXCEPTION 'Fuso de exibição inválido';
  END IF;
  RETURN NEW;
END;
$$;
