-- 225: preparação e decisão independentes; não aplica vencimentos.
CREATE TABLE "PropostaVencimentoAditivo" (
 "id" TEXT PRIMARY KEY, "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id),
 "propostaAditivoId" TEXT NOT NULL REFERENCES "PropostaAditivoContratual"(id),
 "versaoCondicoesId" TEXT NOT NULL REFERENCES "VersaoCondicoesAditivo"(id),
 "cobrancaId" TEXT NOT NULL REFERENCES "Cobranca"(id), "preparadorId" TEXT NOT NULL REFERENCES "Usuario"(id),
 "versaoCobranca" INTEGER NOT NULL CHECK ("versaoCobranca">0),
 "vencimentoAnterior" TIMESTAMP(3) NOT NULL, "vencimentoNovo" TIMESTAMP(3) NOT NULL,
 "fuso" TEXT NOT NULL, "fotografia" JSONB NOT NULL, "fotografiaHash" TEXT NOT NULL CHECK ("fotografiaHash" ~ '^[a-f0-9]{64}$'),
 "motivo" TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000),
 "evidencia" TEXT NOT NULL CHECK (length(btrim(evidencia)) BETWEEN 5 AND 4000),
 "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 1 AND 200),
 "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("preparadorId","chaveIdempotencia")
);
CREATE INDEX "PropostaVencimentoAditivo_matriculaId_criadaEm_idx" ON "PropostaVencimentoAditivo"("matriculaId","criadaEm");
CREATE TABLE "DecisaoVencimentoAditivo" (
 "id" TEXT PRIMARY KEY, "propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaVencimentoAditivo"(id),
 "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id), "aprovada" BOOLEAN NOT NULL,
 "motivo" TEXT NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000),
 "fotografiaHash" TEXT NOT NULL CHECK ("fotografiaHash" ~ '^[a-f0-9]{64}$'),
 "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) BETWEEN 1 AND 200),
 "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("decisorId","chaveIdempotencia")
);
CREATE FUNCTION conferir_fonte_vencimento_aditivo_225(p "PropostaVencimentoAditivo") RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE c "Cobranca"%ROWTYPE; v "VersaoCondicoesAditivo"%ROWTYPE; quantidade INTEGER; data_nova TEXT;
BEGIN
 PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
 SELECT * INTO c FROM "Cobranca" WHERE id=p."cobrancaId" FOR UPDATE;
 SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id=p."versaoCondicoesId";
 IF c."matriculaId" IS DISTINCT FROM p."matriculaId" OR c.tipo<>'MENSALIDADE' OR c.status='CANCELADA'
 OR c.versao IS DISTINCT FROM p."versaoCobranca" OR c.vencimento IS DISTINCT FROM p."vencimentoAnterior"
 OR v."matriculaId" IS DISTINCT FROM p."matriculaId" OR v."propostaId" IS DISTINCT FROM p."propostaAditivoId"
 THEN RAISE EXCEPTION 'Origem ou fotografia do vencimento divergente'; END IF;
 SELECT count(*) INTO quantidade FROM "ItemEmissaoEntrada" i JOIN "Cobranca" x ON x.id=i."cobrancaId"
 WHERE i."matriculaId"=p."matriculaId" AND x.tipo='MENSALIDADE';
 IF quantidade<>1 OR NOT EXISTS (SELECT 1 FROM "ItemEmissaoEntrada" WHERE "matriculaId"=p."matriculaId" AND "cobrancaId"=c.id)
 THEN RAISE EXCEPTION 'Primeira mensalidade exige origem de emissão inequívoca'; END IF;
 IF EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" WHERE "matriculaId"=p."matriculaId" AND versao>v.versao)
 THEN RAISE EXCEPTION 'Versão contratual superada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=p.fuso) THEN RAISE EXCEPTION 'Fuso inválido'; END IF;
 data_nova := v.condicoes->'PRIMEIRA_MENSALIDADE_VENCIMENTO'->>'data';
 IF v.condicoes->'PRIMEIRA_MENSALIDADE_VENCIMENTO'->>'tipo' IS DISTINCT FROM 'DATA' OR data_nova IS NULL
 OR to_char(p."vencimentoNovo" AT TIME ZONE 'UTC' AT TIME ZONE p.fuso,'YYYY-MM-DD') IS DISTINCT FROM data_nova
 THEN RAISE EXCEPTION 'Vencimento diverge da condição contratual formalizada'; END IF;
 IF p.fotografia->>'condicoesHash' IS DISTINCT FROM v."condicoesHash"
 OR p.fotografia->>'cobrancaId' IS DISTINCT FROM c.id
 OR p.fotografia->>'versaoCobranca' IS DISTINCT FROM c.versao::TEXT
 THEN RAISE EXCEPTION 'Fotografia financeira incompatível'; END IF;
END;
$$;
CREATE FUNCTION guardar_vencimento_aditivo_225() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; p "PropostaVencimentoAditivo"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta e decisão de vencimento são imutáveis'; END IF;
 IF TG_TABLE_NAME='PropostaVencimentoAditivo' THEN
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
  IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Financeiro ativo'; END IF;
  PERFORM conferir_fonte_vencimento_aditivo_225(NEW);
 ELSE
  SELECT * INTO p FROM "PropostaVencimentoAditivo" WHERE id=NEW."propostaId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash"
  OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
  THEN RAISE EXCEPTION 'Decisão exige aprovador financeiro independente'; END IF;
  IF NEW.aprovada THEN PERFORM conferir_fonte_vencimento_aditivo_225(p); END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guardar_proposta_vencimento_225 BEFORE INSERT OR UPDATE OR DELETE ON "PropostaVencimentoAditivo" FOR EACH ROW EXECUTE FUNCTION guardar_vencimento_aditivo_225();
CREATE TRIGGER guardar_decisao_vencimento_225 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoVencimentoAditivo" FOR EACH ROW EXECUTE FUNCTION guardar_vencimento_aditivo_225();
