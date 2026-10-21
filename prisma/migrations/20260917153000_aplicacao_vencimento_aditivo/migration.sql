-- 228: execução auditável e atômica do vencimento aprovado.
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
 IF EXISTS (SELECT 1 FROM "Cobranca" c WHERE c.id=p."cobrancaId" AND (c."suspensaPorItemPausaId" IS NOT NULL OR c."canceladaPorPausaId" IS NOT NULL))
 OR EXISTS (SELECT 1 FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId"=p."cobrancaId")
 THEN RAISE EXCEPTION 'Cobrança em pausa ou acerto exige conferência específica'; END IF;
 NEW."aplicadaEm" := CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER guardar_aplicacao_vencimento_228 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoVencimentoAditivo"
 FOR EACH ROW EXECUTE FUNCTION guardar_aplicacao_vencimento_228();

CREATE FUNCTION efetivar_vencimento_aditivo_228() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaVencimentoAditivo"%ROWTYPE;
BEGIN
 SELECT p0.* INTO p FROM "PropostaVencimentoAditivo" p0
 JOIN "DecisaoVencimentoAditivo" d ON d."propostaId"=p0.id WHERE d.id=NEW."decisaoId";
 UPDATE "Cobranca" SET vencimento=NEW."vencimentoNovo", versao=NEW."versaoCobrancaDepois",
 status=CASE WHEN status='PAGO' THEN status
   WHEN (NEW."vencimentoNovo" AT TIME ZONE 'UTC' AT TIME ZONE p.fuso)::date < (CURRENT_TIMESTAMP AT TIME ZONE p.fuso)::date
   THEN 'ATRASADO'::"StatusCobranca" ELSE 'PENDENTE'::"StatusCobranca" END
 WHERE id=p."cobrancaId" AND versao=NEW."versaoCobrancaAntes";
 IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança mudou antes da aplicação do vencimento'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER efetivar_vencimento_aditivo_228 AFTER INSERT ON "AplicacaoVencimentoAditivo"
 FOR EACH ROW EXECUTE FUNCTION efetivar_vencimento_aditivo_228();
