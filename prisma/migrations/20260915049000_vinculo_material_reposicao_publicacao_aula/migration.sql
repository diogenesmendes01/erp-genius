-- 215: a reposição pode reutilizar somente a publicação oficial da aula
-- que a originou. O vínculo é histórico e não pode ser trocado depois.
ALTER TABLE "MaterialReposicaoGravacao"
  ADD COLUMN "publicacaoAulaId" TEXT;

ALTER TABLE "MaterialReposicaoGravacao"
  ADD CONSTRAINT "MaterialReposicaoGravacao_publicacaoAulaId_fkey"
  FOREIGN KEY ("publicacaoAulaId") REFERENCES "PublicacaoGravacaoAula"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION validar_vinculo_material_reposicao_publicacao_aula_215()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  encontro_publicacao_id TEXT;
  arquivo_publicacao_id TEXT;
  aula_original_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."publicacaoAulaId" IS DISTINCT FROM NEW."publicacaoAulaId" THEN
    RAISE EXCEPTION 'O vínculo à publicação da aula é imutável';
  END IF;

  IF NEW."publicacaoAulaId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT publicacao."encontroId", publicacao."arquivoOficialId", reposicao."aulaOriginalId"
    INTO encontro_publicacao_id, arquivo_publicacao_id, aula_original_id
    FROM "PublicacaoGravacaoAula" publicacao
    JOIN "ReposicaoIndividual" reposicao ON reposicao.id = NEW."reposicaoId"
    WHERE publicacao.id = NEW."publicacaoAulaId"
    FOR SHARE OF publicacao, reposicao;

  IF NOT FOUND
    OR encontro_publicacao_id IS DISTINCT FROM aula_original_id
    OR arquivo_publicacao_id IS DISTINCT FROM NEW."arquivoOficialId"
    OR NEW.provedor IS DISTINCT FROM 'GOOGLE_DRIVE'::"ProvedorMaterialReposicao" THEN
    RAISE EXCEPTION 'Material de reposição exige publicação oficial da aula original no Google Drive';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "MaterialReposicaoGravacao_validar_publicacao_aula_215"
  BEFORE INSERT OR UPDATE ON "MaterialReposicaoGravacao"
  FOR EACH ROW EXECUTE FUNCTION validar_vinculo_material_reposicao_publicacao_aula_215();
