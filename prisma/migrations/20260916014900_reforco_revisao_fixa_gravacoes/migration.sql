-- 149: reforços para a cadeia criada na 147.
CREATE OR REPLACE FUNCTION validar_fonte_revisao_gravacao_149() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE origem RECORD;
BEGIN
  IF NEW.alvo = 'MATERIAL_REPOSICAO' AND EXISTS (SELECT 1 FROM "MaterialReposicaoGravacao" WHERE id = NEW."materialReposicaoId" AND "publicacaoAulaId" IS NOT NULL) THEN
    SELECT f."arquivoOficialId", f."driveOrganizacaoId", f."driveRevisionId", f."driveRevisionMd5", f."driveRevisionSize", f."mimeType" INTO origem
    FROM "MaterialReposicaoGravacao" m JOIN "FonteRevisaoGravacao" f ON f."publicacaoAulaId" = m."publicacaoAulaId"
    WHERE m.id = NEW."materialReposicaoId" ORDER BY f.versao DESC LIMIT 1;
    IF NOT FOUND OR origem."arquivoOficialId" IS DISTINCT FROM NEW."arquivoOficialId" OR origem."driveOrganizacaoId" IS DISTINCT FROM NEW."driveOrganizacaoId" OR origem."driveRevisionId" IS DISTINCT FROM NEW."driveRevisionId" OR origem."driveRevisionMd5" IS DISTINCT FROM NEW."driveRevisionMd5" OR origem."driveRevisionSize" IS DISTINCT FROM NEW."driveRevisionSize" OR origem."mimeType" IS DISTINCT FROM NEW."mimeType" THEN RAISE EXCEPTION 'Fonte derivada não corresponde à publicação'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "FonteRevisaoGravacao_derivada_149" BEFORE INSERT ON "FonteRevisaoGravacao" FOR EACH ROW EXECUTE FUNCTION validar_fonte_revisao_gravacao_149();

CREATE OR REPLACE FUNCTION validar_proposta_regularizacao_fonte_gravacao_149() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."preparadorId" AND u.ativo AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(u.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(u.papeis))) THEN RAISE EXCEPTION 'Preparador sem papel de gestão ativo'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "PropostaRegularizacaoFonteGravacao_validar_149" BEFORE INSERT ON "PropostaRegularizacaoFonteGravacao" FOR EACH ROW EXECUTE FUNCTION validar_proposta_regularizacao_fonte_gravacao_149();