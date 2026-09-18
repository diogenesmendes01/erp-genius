-- Preferência pessoal de exibição: opcional para conservar os fusos de origem
-- já persistidos e não interferir em datas civis, financeiros ou WhatsApp.
ALTER TABLE "Usuario" ADD COLUMN "fusoExibicao" TEXT;
ALTER TABLE "ContaPortalAluno" ADD COLUMN "fusoExibicao" TEXT;

CREATE OR REPLACE FUNCTION validar_fuso_exibicao_266()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."fusoExibicao" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW."fusoExibicao") THEN
    RAISE EXCEPTION 'Fuso de exibição inválido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validar_fuso_exibicao_usuario_266
BEFORE INSERT OR UPDATE ON "Usuario"
FOR EACH ROW EXECUTE FUNCTION validar_fuso_exibicao_266();

CREATE TRIGGER validar_fuso_exibicao_portal_266
BEFORE INSERT OR UPDATE ON "ContaPortalAluno"
FOR EACH ROW EXECUTE FUNCTION validar_fuso_exibicao_266();
