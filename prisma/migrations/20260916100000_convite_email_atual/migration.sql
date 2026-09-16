-- 146: convite inicial só pode ativar a conta se o e-mail ainda é o cadastro atual do Aluno.
CREATE OR REPLACE FUNCTION "proteger_email_conta_portal_aluno"() RETURNS TRIGGER AS $$
DECLARE permitido BOOLEAN;
DECLARE email_atual TEXT;
BEGIN
  IF NEW."emailVerificado" IS NOT DISTINCT FROM OLD."emailVerificado" THEN RETURN NEW; END IF;
  IF OLD."emailVerificado" IS NULL THEN
    SELECT a.email INTO email_atual FROM "Aluno" a WHERE a.id = OLD."alunoId" FOR SHARE;
    SELECT EXISTS (SELECT 1 FROM "TokenPortalAluno" t WHERE t."contaId" = OLD.id
      AND t.finalidade = 'CONVITE' AND t."consumidoEm" IS NOT NULL
      AND t.destinatario = NEW."emailVerificado") INTO permitido;
    IF email_atual IS NULL OR lower(btrim(email_atual)) IS DISTINCT FROM lower(NEW."emailVerificado") THEN
      RAISE EXCEPTION 'Convite não corresponde ao contato atual do aluno';
    END IF;
  ELSE
    SELECT EXISTS (SELECT 1 FROM "SolicitacaoTrocaEmailPortalAluno" s JOIN "DecisaoTrocaEmailPortalAluno" d ON d."solicitacaoId"=s.id AND d.aprovada=true WHERE s."contaId"=OLD.id AND s.situacao='APROVADA_APLICADA' AND s."emailAnterior" IS NOT DISTINCT FROM OLD."emailVerificado" AND s."novoEmail"=NEW."emailVerificado" AND s."versaoContaConferida"=OLD."versaoSessao") INTO permitido;
  END IF;
  IF permitido IS DISTINCT FROM true THEN RAISE EXCEPTION 'E-mail verificado da conta do portal só muda por fluxo autorizado'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
