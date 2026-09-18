-- 228: execução auditável do vencimento aprovado; revisar guardas antes de aplicar.
CREATE TABLE "AplicacaoVencimentoAditivo" (
 id TEXT PRIMARY KEY,
 "decisaoId" TEXT NOT NULL UNIQUE REFERENCES "DecisaoVencimentoAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "executorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "fotografiaHash" TEXT NOT NULL,
 "chaveIdempotencia" TEXT NOT NULL,
 "versaoCobrancaAntes" INTEGER NOT NULL,
 "versaoCobrancaDepois" INTEGER NOT NULL,
 "vencimentoAnterior" TIMESTAMP(3) NOT NULL,
 "vencimentoNovo" TIMESTAMP(3) NOT NULL,
 "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("executorId", "chaveIdempotencia"),
 CHECK ("versaoCobrancaDepois" = "versaoCobrancaAntes" + 1)
);
CREATE FUNCTION guardar_aplicacao_vencimento_228() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaVencimentoAditivo"%ROWTYPE; d "DecisaoVencimentoAditivo"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicação de vencimento é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO d FROM "DecisaoVencimentoAditivo" WHERE id=NEW."decisaoId";
 SELECT * INTO p FROM "PropostaVencimentoAditivo" WHERE id=d."propostaId";
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 IF d.aprovada IS DISTINCT FROM true OR u.ativo IS DISTINCT FROM true
 OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR NEW."executorId"=p."preparadorId"
 OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
 THEN RAISE EXCEPTION 'Execução exige o aprovador financeiro autorizado'; END IF;
 PERFORM conferir_fonte_vencimento_aditivo_225(p);
 IF NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR d."fotografiaHash" IS DISTINCT FROM p."fotografiaHash"
 OR NEW."versaoCobrancaAntes" IS DISTINCT FROM p."versaoCobranca"
 OR NEW."vencimentoAnterior" IS DISTINCT FROM p."vencimentoAnterior" OR NEW."vencimentoNovo" IS DISTINCT FROM p."vencimentoNovo"
 THEN RAISE EXCEPTION 'Aplicação diverge da proposta aprovada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guardar_aplicacao_vencimento_228 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoVencimentoAditivo"
 FOR EACH ROW EXECUTE FUNCTION guardar_aplicacao_vencimento_228();
