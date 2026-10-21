-- 150: versões append-only da evidência e guardas de conciliação/reemissão.
ALTER TABLE "ConciliacaoEnvioPortalAluno" DROP CONSTRAINT "ConciliacaoEnvioPortalAluno_solicitacaoId_key";
ALTER TABLE "ConciliacaoEnvioPortalAluno" ADD COLUMN versao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ConciliacaoEnvioPortalAluno" ADD CONSTRAINT "ConciliacaoEnvioPortalAluno_solicitacao_versao_key" UNIQUE ("solicitacaoId", versao);
CREATE INDEX "ConciliacaoEnvioPortalAluno_solicitacao_versao_idx" ON "ConciliacaoEnvioPortalAluno" ("solicitacaoId", versao);
CREATE OR REPLACE FUNCTION "guardar_insert_conciliacao_envio_portal_aluno"() RETURNS TRIGGER AS $$
DECLARE situacao_atual TEXT; usuario_atual RECORD;
BEGIN
 SELECT situacao::text INTO situacao_atual FROM "SolicitacaoEnvioPortalAluno" WHERE id=NEW."solicitacaoId" FOR SHARE;
 SELECT ativo,papeis INTO usuario_atual FROM "Usuario" WHERE id=NEW."secretariaId" FOR SHARE;
 IF situacao_atual <> 'INCERTO' OR usuario_atual.ativo IS DISTINCT FROM true OR NOT ('SECRETARIA_ACADEMICA'=ANY(usuario_atual.papeis) OR 'ADMINISTRADOR'=ANY(usuario_atual.papeis)) THEN RAISE EXCEPTION 'Conciliação exige envio incerto e Secretaria ativa'; END IF;
 IF NEW.versao <> COALESCE((SELECT MAX(versao)+1 FROM "ConciliacaoEnvioPortalAluno" WHERE "solicitacaoId"=NEW."solicitacaoId"),1) THEN RAISE EXCEPTION 'Versão de conciliação inválida'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ConciliacaoEnvioPortalAluno_insert_guard" BEFORE INSERT ON "ConciliacaoEnvioPortalAluno" FOR EACH ROW EXECUTE FUNCTION "guardar_insert_conciliacao_envio_portal_aluno"();
CREATE OR REPLACE FUNCTION "guardar_decisao_reemissao_envio_portal_aluno"() RETURNS TRIGGER AS $$
DECLARE c RECORD; u RECORD; original RECORD; nova RECORD;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT c."secretariaId",c."estadoHash",c."solicitacaoId",e.situacao::text AS situacao INTO c FROM "ConciliacaoEnvioPortalAluno" c JOIN "SolicitacaoEnvioPortalAluno" e ON e.id=c."solicitacaoId" WHERE c.id=NEW."conciliacaoId" FOR SHARE;
  SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF c."secretariaId"=NEW."decisorId" OR c."estadoHash"<>NEW."estadoHash" OR c.situacao<>'INCERTO' OR u.ativo IS DISTINCT FROM true OR NOT ('ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Decisão de reemissão inválida'; END IF;
  IF NEW.aprovada AND EXISTS (SELECT 1 FROM "DecisaoReemissaoEnvioPortalAluno" d JOIN "ConciliacaoEnvioPortalAluno" a ON a.id=d."conciliacaoId" WHERE a."solicitacaoId"=c."solicitacaoId" AND d.aprovada) THEN RAISE EXCEPTION 'A tentativa já teve reemissão aprovada'; END IF;
  RETURN NEW;
 END IF;
 IF NEW."solicitacaoReemitidaId" IS DISTINCT FROM OLD."solicitacaoReemitidaId" AND OLD."solicitacaoReemitidaId" IS NULL AND NEW."solicitacaoReemitidaId" IS NOT NULL AND NEW.aprovada=OLD.aprovada AND NEW."conciliacaoId"=OLD."conciliacaoId" AND NEW."decisorId"=OLD."decisorId" AND NEW.motivo=OLD.motivo AND NEW."estadoHash"=OLD."estadoHash" THEN
  IF NOT NEW.aprovada THEN RAISE EXCEPTION 'Decisão não aprovada não cria emissão'; END IF;
  SELECT e."contaId",e.finalidade,e.destinatario,e."trocaEmailId" INTO original FROM "ConciliacaoEnvioPortalAluno" c JOIN "SolicitacaoEnvioPortalAluno" e ON e.id=c."solicitacaoId" WHERE c.id=NEW."conciliacaoId" FOR SHARE;
  SELECT "contaId",finalidade,destinatario,"trocaEmailId",situacao::text AS situacao INTO nova FROM "SolicitacaoEnvioPortalAluno" WHERE id=NEW."solicitacaoReemitidaId" FOR SHARE;
  IF nova.situacao<>'PREPARADO' OR nova."contaId"<>original."contaId" OR nova.finalidade<>original.finalidade OR nova.destinatario<>original.destinatario OR nova."trocaEmailId" IS DISTINCT FROM original."trocaEmailId" THEN RAISE EXCEPTION 'Nova emissão não corresponde à tentativa conciliada'; END IF;
  IF EXISTS (SELECT 1 FROM "TokenPortalAluno" WHERE "contaId"=original."contaId" AND finalidade=original.finalidade AND "consumidoEm" IS NULL AND "revogadoEm" IS NULL) THEN RAISE EXCEPTION 'Token anterior ainda está ativo'; END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Decisão de reemissão é imutável';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER "DecisaoReemissaoEnvioPortalAluno_imutavel" ON "DecisaoReemissaoEnvioPortalAluno";
CREATE TRIGGER "DecisaoReemissaoEnvioPortalAluno_guard" BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoReemissaoEnvioPortalAluno" FOR EACH ROW EXECUTE FUNCTION "guardar_decisao_reemissao_envio_portal_aluno"();