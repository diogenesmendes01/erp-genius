-- Novas entregas exigem conta de aluno; mantém o histórico anterior intacto.
DROP TRIGGER "EntregaReposicaoGravacao_validar_origem_portal" ON "EntregaReposicaoGravacao";
CREATE TRIGGER "EntregaReposicaoGravacao_validar_origem_portal"
BEFORE INSERT ON "EntregaReposicaoGravacao"
FOR EACH ROW EXECUTE FUNCTION "validar_origem_entrega_reposicao_portal"();
