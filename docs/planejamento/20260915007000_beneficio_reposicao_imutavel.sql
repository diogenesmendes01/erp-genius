-- ABANDONADO: este rascunho posterga a transição até a fronteira da regra nova.
-- A versão alinhada a Q50/Q61 está em 20260915010000_transicao_beneficio_reposicao.sql.
-- Não promover este arquivo a migration.
--
-- Q50/Q61: um snapshot não pode ter vigência, cota ou referência reabertas
-- por SQL direto. A data é calculada no fuso institucional, igual ao app.
CREATE OR REPLACE FUNCTION validar_vigencia_beneficio_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anterior "BeneficioReposicaoParticularMatricula"%ROWTYPE;
  fuso TEXT; hoje DATE; base DATE; fim_anterior DATE; inicio_novo DATE; fim_novo DATE; esperado DATE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('beneficio-reposicao-vigencia:'||NEW."matriculaId",0));
  SELECT "fusoInstitucional" INTO fuso FROM "ConfiguracaoOperacional" WHERE id='escola' FOR SHARE;
  IF fuso IS NULL OR btrim(fuso)='' THEN RAISE EXCEPTION 'Snapshot exige fuso institucional configurado'; END IF;
  hoje := (CURRENT_TIMESTAMP AT TIME ZONE fuso)::date;
  SELECT * INTO anterior FROM "BeneficioReposicaoParticularMatricula"
    WHERE "matriculaId"=NEW."matriculaId" ORDER BY "vigenteAPartirDe" DESC LIMIT 1 FOR UPDATE;
  IF anterior.id IS NULL THEN
    SELECT inicio INTO esperado FROM periodo_beneficio_reposicao(hoje, NEW);
  ELSE
    base := GREATEST(hoje, anterior."vigenteAPartirDe");
    SELECT fim INTO fim_anterior FROM periodo_beneficio_reposicao(base, anterior);
    SELECT inicio, fim INTO inicio_novo, fim_novo FROM periodo_beneficio_reposicao(fim_anterior, NEW);
    esperado := CASE WHEN inicio_novo < fim_anterior THEN fim_novo ELSE inicio_novo END;
  END IF;
  IF NEW."vigenteAPartirDe" IS DISTINCT FROM esperado THEN
    RAISE EXCEPTION 'Vigência do snapshot deve iniciar no limite de benefício permitido';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_vigencia_beneficio_reposicao
  BEFORE INSERT ON "BeneficioReposicaoParticularMatricula"
  FOR EACH ROW EXECUTE FUNCTION validar_vigencia_beneficio_reposicao();

CREATE OR REPLACE FUNCTION preservar_beneficio_reposicao_particular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Snapshot de benefício de reposição é histórico e não pode ser alterado ou apagado';
END $$;

CREATE TRIGGER preservar_beneficio_reposicao_particular
  BEFORE UPDATE OR DELETE ON "BeneficioReposicaoParticularMatricula"
  FOR EACH ROW EXECUTE FUNCTION preservar_beneficio_reposicao_particular();
