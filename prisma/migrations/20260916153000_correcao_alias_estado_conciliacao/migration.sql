-- 153: corrige aliases camelCase do estado canônico no guard 152.
CREATE OR REPLACE FUNCTION "guardar_decisao_reemissao_envio_portal_aluno"() RETURNS TRIGGER AS $$
DECLARE conciliacao_linha RECORD; usuario_linha RECORD; original_linha RECORD; nova_linha RECORD; troca_valida BOOLEAN;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT ce."secretariaId",ce."estadoHash",ce."solicitacaoId",e.situacao::text AS situacao,e."contaId",e.finalidade::text AS finalidade,e.destinatario,e."trocaEmailId",cp.ativa,cp."senhaHash",cp."emailVerificado",cp."versaoSessao" AS "versaoSessao",ce."versaoConta" AS "versaoConta",a.email AS "emailAluno" INTO conciliacao_linha FROM "ConciliacaoEnvioPortalAluno" ce JOIN "SolicitacaoEnvioPortalAluno" e ON e.id=ce."solicitacaoId" JOIN "ContaPortalAluno" cp ON cp.id=e."contaId" JOIN "Aluno" a ON a.id=cp."alunoId" WHERE ce.id=NEW."conciliacaoId" FOR SHARE;
  SELECT ativo,papeis INTO usuario_linha FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF conciliacao_linha."secretariaId"=NEW."decisorId" OR conciliacao_linha."estadoHash"<>NEW."estadoHash" OR conciliacao_linha.situacao<>'INCERTO' OR conciliacao_linha.ativa IS DISTINCT FROM true OR conciliacao_linha."versaoSessao"<>conciliacao_linha."versaoConta" OR usuario_linha.ativo IS DISTINCT FROM true OR NOT ('ADMINISTRADOR'=ANY(usuario_linha.papeis)) THEN RAISE EXCEPTION 'DecisÃ£o de reemissÃ£o invÃ¡lida'; END IF;
  IF NEW.aprovada THEN
    IF conciliacao_linha.finalidade='CONVITE' AND (conciliacao_linha."senhaHash" IS NOT NULL OR conciliacao_linha."emailAluno" IS NULL OR lower(btrim(conciliacao_linha."emailAluno"))<>conciliacao_linha.destinatario) THEN RAISE EXCEPTION 'Contato ou credencial do convite mudou'; END IF;
    IF conciliacao_linha.finalidade='RECUPERACAO' THEN
      SELECT EXISTS (SELECT 1 FROM "SolicitacaoTrocaEmailPortalAluno" s JOIN "DecisaoTrocaEmailPortalAluno" d ON d."solicitacaoId"=s.id AND d.aprovada WHERE s."contaId"=conciliacao_linha."contaId" AND s.situacao='APROVADA_APLICADA' AND s."novoEmail"=conciliacao_linha.destinatario) INTO troca_valida;
      IF conciliacao_linha."emailVerificado"<>conciliacao_linha.destinatario OR (conciliacao_linha."senhaHash" IS NULL AND NOT troca_valida) THEN RAISE EXCEPTION 'DestinatÃ¡rio de recuperaÃ§Ã£o nÃ£o autorizado'; END IF;
    END IF;
    IF conciliacao_linha.finalidade='VALIDAR_TROCA_EMAIL' AND NOT EXISTS (SELECT 1 FROM "SolicitacaoTrocaEmailPortalAluno" s WHERE s.id=conciliacao_linha."trocaEmailId" AND s."contaId"=conciliacao_linha."contaId" AND s.situacao='PENDENTE_VALIDACAO' AND s."novoEmail"=conciliacao_linha.destinatario) THEN RAISE EXCEPTION 'ValidaÃ§Ã£o de troca nÃ£o disponÃ­vel'; END IF;
  END IF;
  IF NEW.aprovada AND EXISTS (SELECT 1 FROM "DecisaoReemissaoEnvioPortalAluno" d JOIN "ConciliacaoEnvioPortalAluno" anteriores ON anteriores.id=d."conciliacaoId" WHERE anteriores."solicitacaoId"=conciliacao_linha."solicitacaoId" AND d.aprovada) THEN RAISE EXCEPTION 'A tentativa jÃ¡ teve reemissÃ£o aprovada'; END IF;
  RETURN NEW;
 END IF;
 IF NEW."solicitacaoReemitidaId" IS DISTINCT FROM OLD."solicitacaoReemitidaId" AND OLD."solicitacaoReemitidaId" IS NULL AND NEW."solicitacaoReemitidaId" IS NOT NULL AND NEW.aprovada=OLD.aprovada AND NEW."conciliacaoId"=OLD."conciliacaoId" AND NEW."decisorId"=OLD."decisorId" AND NEW.motivo=OLD.motivo AND NEW."estadoHash"=OLD."estadoHash" THEN
  IF NOT NEW.aprovada THEN RAISE EXCEPTION 'DecisÃ£o nÃ£o aprovada nÃ£o cria emissÃ£o'; END IF;
  SELECT e."contaId",e.finalidade,e.destinatario,e."trocaEmailId" INTO original_linha FROM "ConciliacaoEnvioPortalAluno" ce JOIN "SolicitacaoEnvioPortalAluno" e ON e.id=ce."solicitacaoId" WHERE ce.id=NEW."conciliacaoId" FOR SHARE;
  SELECT "contaId",finalidade,destinatario,"trocaEmailId",situacao::text AS situacao INTO nova_linha FROM "SolicitacaoEnvioPortalAluno" WHERE id=NEW."solicitacaoReemitidaId" FOR SHARE;
  IF nova_linha.situacao<>'PREPARADO' OR nova_linha."contaId"<>original_linha."contaId" OR nova_linha.finalidade<>original_linha.finalidade OR nova_linha.destinatario<>original_linha.destinatario OR nova_linha."trocaEmailId" IS DISTINCT FROM original_linha."trocaEmailId" THEN RAISE EXCEPTION 'Nova emissÃ£o nÃ£o corresponde Ã  tentativa conciliada'; END IF;
  IF EXISTS (SELECT 1 FROM "TokenPortalAluno" WHERE "contaId"=original_linha."contaId" AND finalidade=original_linha.finalidade AND "consumidoEm" IS NULL AND "revogadoEm" IS NULL) THEN RAISE EXCEPTION 'Token anterior ainda estÃ¡ ativo'; END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'DecisÃ£o de reemissÃ£o Ã© imutÃ¡vel';
END; $$ LANGUAGE plpgsql;