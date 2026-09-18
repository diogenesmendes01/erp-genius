CREATE TYPE "EstadoReconferenciaDeltaDesistencia" AS ENUM ('PENDENTE','PENDENCIA_FINANCEIRA','APLICADA');
CREATE TABLE "PropostaReconferenciaDeltaDesistencia" (
 "id" TEXT NOT NULL,"aplicacaoBaseId" TEXT NOT NULL,"aplicacaoDeltaAnteriorId" TEXT,"versao" INTEGER NOT NULL,"pedidoId" TEXT NOT NULL,"condicoesId" TEXT NOT NULL,"preparadorId" TEXT NOT NULL,"estadoHash" TEXT NOT NULL,"condicoesHash" TEXT NOT NULL,"fotografiaAnteriorHash" TEXT NOT NULL,"fotografiaHash" TEXT NOT NULL,"fotografia" JSONB NOT NULL,"memoriaDelta" JSONB NOT NULL,"estado" "EstadoReconferenciaDeltaDesistencia" NOT NULL DEFAULT 'PENDENTE',"chaveIdempotencia" TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PropostaReconferenciaDeltaDesistencia_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PropostaReconferenciaDeltaDesistencia_base_fkey" FOREIGN KEY ("aplicacaoBaseId") REFERENCES "AplicacaoAcertoDesistenciaContratual"("id") ON DELETE RESTRICT,
 CONSTRAINT "PropostaReconferenciaDeltaDesistencia_pedido_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoDesistenciaPreparacao"("id") ON DELETE RESTRICT,
 CONSTRAINT "PropostaReconferenciaDeltaDesistencia_condicoes_fkey" FOREIGN KEY ("condicoesId") REFERENCES "CondicoesEncerramentoMatricula"("id") ON DELETE RESTRICT,
 CONSTRAINT "PropostaReconferenciaDeltaDesistencia_preparador_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT);
CREATE UNIQUE INDEX "PropostaReconferenciaDeltaDesistencia_base_versao_key" ON "PropostaReconferenciaDeltaDesistencia"("aplicacaoBaseId","versao");
CREATE UNIQUE INDEX "PropostaReconferenciaDeltaDesistencia_preparador_chave_key" ON "PropostaReconferenciaDeltaDesistencia"("preparadorId","chaveIdempotencia");
CREATE TABLE "DecisaoReconferenciaDeltaDesistencia" ("id" TEXT NOT NULL,"propostaId" TEXT NOT NULL,"decisorId" TEXT NOT NULL,"aprovada" BOOLEAN NOT NULL,"motivo" TEXT NOT NULL,"fotografiaHash" TEXT NOT NULL,"chaveIdempotencia" TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DecisaoReconferenciaDeltaDesistencia_pkey" PRIMARY KEY ("id"),CONSTRAINT "DecisaoReconferenciaDeltaDesistencia_proposta_key" UNIQUE ("propostaId"),CONSTRAINT "DecisaoReconferenciaDeltaDesistencia_chave_key" UNIQUE ("decisorId","chaveIdempotencia"),CONSTRAINT "DecisaoReconferenciaDeltaDesistencia_proposta_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT,CONSTRAINT "DecisaoReconferenciaDeltaDesistencia_decisor_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT);
CREATE TABLE "DecisaoAdministrativaReconferenciaDeltaDesistencia" ("id" TEXT NOT NULL,"propostaId" TEXT NOT NULL,"decisorId" TEXT NOT NULL,"aprovada" BOOLEAN NOT NULL,"motivo" TEXT NOT NULL,"fotografiaHash" TEXT NOT NULL,"chaveIdempotencia" TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DecisaoAdministrativaReconferenciaDeltaDesistencia_pkey" PRIMARY KEY ("id"),CONSTRAINT "DecisaoAdministrativaReconferenciaDeltaDesistencia_proposta_key" UNIQUE ("propostaId"),CONSTRAINT "DecisaoAdministrativaReconferenciaDeltaDesistencia_chave_key" UNIQUE ("decisorId","chaveIdempotencia"),CONSTRAINT "DecisaoAdministrativaReconferenciaDeltaDesistencia_proposta_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT,CONSTRAINT "DecisaoAdministrativaReconferenciaDeltaDesistencia_decisor_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT);
CREATE TABLE "AplicacaoReconferenciaDeltaDesistencia" ("id" TEXT NOT NULL,"propostaId" TEXT NOT NULL,"decisaoFinanceiraId" TEXT NOT NULL,"aplicacaoBaseId" TEXT NOT NULL,"aplicacaoDeltaAnteriorId" TEXT,"executorId" TEXT NOT NULL,"fotografiaHash" TEXT NOT NULL,"fotografia" JSONB NOT NULL,"memoriaDelta" JSONB NOT NULL,"chaveIdempotencia" TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_pkey" PRIMARY KEY("id"),CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_proposta_key" UNIQUE("propostaId"),CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_decisao_key" UNIQUE("decisaoFinanceiraId"),CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_chave_key" UNIQUE("executorId","chaveIdempotencia"),CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_proposta_fkey" FOREIGN KEY("propostaId") REFERENCES "PropostaReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT,CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_decisao_fkey" FOREIGN KEY("decisaoFinanceiraId") REFERENCES "DecisaoReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT,CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_base_fkey" FOREIGN KEY("aplicacaoBaseId") REFERENCES "AplicacaoAcertoDesistenciaContratual"("id") ON DELETE RESTRICT,CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_anterior_fkey" FOREIGN KEY("aplicacaoDeltaAnteriorId") REFERENCES "AplicacaoReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT,CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_executor_fkey" FOREIGN KEY("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT);
ALTER TABLE "PropostaReconferenciaDeltaDesistencia" ADD CONSTRAINT "PropostaReconferenciaDeltaDesistencia_anterior_fkey" FOREIGN KEY ("aplicacaoDeltaAnteriorId") REFERENCES "AplicacaoReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT;
CREATE TABLE "OrigemCreditoReconferenciaDeltaDesistencia" ("id" TEXT NOT NULL,"aplicacaoId" TEXT NOT NULL,"matriculaId" TEXT NOT NULL,"cobrancaId" TEXT NOT NULL,"valor" DECIMAL(12,2) NOT NULL,"moeda" TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "OrigemCreditoReconferenciaDeltaDesistencia_pkey" PRIMARY KEY("id"),CONSTRAINT "OrigemCreditoReconferenciaDeltaDesistencia_app_cobranca_key" UNIQUE("aplicacaoId","cobrancaId"),CONSTRAINT "OrigemCreditoReconferenciaDeltaDesistencia_app_fkey" FOREIGN KEY("aplicacaoId") REFERENCES "AplicacaoReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT,CONSTRAINT "OrigemCreditoReconferenciaDeltaDesistencia_matricula_fkey" FOREIGN KEY("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT,CONSTRAINT "OrigemCreditoReconferenciaDeltaDesistencia_cobranca_fkey" FOREIGN KEY("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT);
CREATE TABLE "ReconhecimentoCreditoReconferenciaDeltaDesistencia" ("id" TEXT NOT NULL,"aplicacaoId" TEXT NOT NULL,"creditoId" TEXT NOT NULL,"valor" DECIMAL(12,2) NOT NULL,"criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ReconhecimentoCreditoReconferenciaDeltaDesistencia_pkey" PRIMARY KEY("id"),CONSTRAINT "ReconhecimentoCreditoReconferenciaDeltaDesistencia_app_credito_key" UNIQUE("aplicacaoId","creditoId"),CONSTRAINT "ReconhecimentoCreditoReconferenciaDeltaDesistencia_credito_key" UNIQUE("creditoId"),CONSTRAINT "ReconhecimentoCreditoReconferenciaDeltaDesistencia_app_fkey" FOREIGN KEY("aplicacaoId") REFERENCES "AplicacaoReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT,CONSTRAINT "ReconhecimentoCreditoReconferenciaDeltaDesistencia_credito_fkey" FOREIGN KEY("creditoId") REFERENCES "CreditoMatricula"("id") ON DELETE RESTRICT);
ALTER TABLE "CreditoMatricula" ADD COLUMN "origemReconferenciaDeltaDesistenciaId" TEXT UNIQUE, ADD CONSTRAINT "CreditoMatricula_origemReconferenciaDeltaDesistencia_fkey" FOREIGN KEY("origemReconferenciaDeltaDesistenciaId") REFERENCES "OrigemCreditoReconferenciaDeltaDesistencia"("id") ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION q165_guard_reconferencia_delta_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "PropostaReconferenciaDeltaDesistencia"%ROWTYPE; u RECORD; anterior "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='PropostaReconferenciaDeltaDesistencia' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de reconferência delta é imutável'; END IF;
  IF NOT EXISTS(SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" a JOIN "DecisaoAcertoDesistenciaContratual" d ON d.id=a."decisaoId" AND d.aprovada JOIN "PropostaAcertoDesistenciaContratual" b ON b.id=d."propostaId" WHERE a.id=NEW."aplicacaoBaseId" AND b."pedidoId"=NEW."pedidoId" AND b."condicoesId"=NEW."condicoesId" AND b."estadoHash"=NEW."estadoHash" AND b."condicoesHash"=NEW."condicoesHash") THEN RAISE EXCEPTION 'Reconferência exige aplicação Q165 base correspondente'; END IF;
  SELECT * INTO anterior FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=NEW."aplicacaoDeltaAnteriorId";
  IF (NEW."aplicacaoDeltaAnteriorId" IS NOT NULL AND (anterior.id IS NULL OR anterior."aplicacaoBaseId"<>NEW."aplicacaoBaseId")) OR NEW.versao<>COALESCE((SELECT max(x.versao)+1 FROM "PropostaReconferenciaDeltaDesistencia" x WHERE x."aplicacaoBaseId"=NEW."aplicacaoBaseId"),1) THEN RAISE EXCEPTION 'Reconferência não corresponde à cadeia aplicada'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO p FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=NEW."propostaId" FOR SHARE;
 SELECT ativo,papeis,permissoes INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
 IF TG_TABLE_NAME='DecisaoReconferenciaDeltaDesistencia' THEN
  IF TG_OP<>'INSERT' OR p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."fotografiaHash"<>p."fotografiaHash" OR u.ativo IS NOT TRUE OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Decisão financeira delta inválida'; END IF;
 ELSE
  IF TG_OP<>'INSERT' OR p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."fotografiaHash"<>p."fotografiaHash" OR u.ativo IS NOT TRUE OR NOT 'ADMINISTRADOR'=ANY(u.papeis) THEN RAISE EXCEPTION 'Decisão administrativa delta inválida'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER q165_guard_proposta_delta_249 BEFORE INSERT OR UPDATE OR DELETE ON "PropostaReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_guard_reconferencia_delta_249();
CREATE TRIGGER q165_guard_decisao_delta_249 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_guard_reconferencia_delta_249();
CREATE TRIGGER q165_guard_admin_delta_249 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAdministrativaReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_guard_reconferencia_delta_249();
CREATE OR REPLACE FUNCTION q165_guard_aplicacao_delta_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação delta é imutável'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PropostaReconferenciaDeltaDesistencia" p JOIN "DecisaoReconferenciaDeltaDesistencia" f ON f."propostaId"=p.id AND f.aprovada JOIN "DecisaoAdministrativaReconferenciaDeltaDesistencia" a ON a."propostaId"=p.id AND a.aprovada WHERE p.id=NEW."propostaId" AND f.id=NEW."decisaoFinanceiraId" AND p."aplicacaoBaseId"=NEW."aplicacaoBaseId" AND p."aplicacaoDeltaAnteriorId" IS NOT DISTINCT FROM NEW."aplicacaoDeltaAnteriorId" AND f."decisorId"=NEW."executorId" AND f."fotografiaHash"=NEW."fotografiaHash") THEN RAISE EXCEPTION 'Aplicação delta exige decisões aprovadas e cadeia correspondente'; END IF; RETURN NEW; END $$;
CREATE TRIGGER q165_guard_aplicacao_delta_249 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_guard_aplicacao_delta_249();

-- A aplicação 249 cria uma nova origem de crédito. A exclusividade das
-- origens de CréditoMatricula precisa conhecê-la para impedir crédito sem
-- proveniência ou com duas proveniências.
ALTER TABLE "CreditoMatricula" DROP CONSTRAINT "credito_matricula_origem_unica_check";
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "credito_matricula_origem_unica_check"
  CHECK(num_nonnulls("origemLiberacaoId","origemAcertoId","origemPeriodoIntegralId","origemDestinacaoRecebimentoId","origemAcertoTaxaAditivoId","origemAcertoDesistenciaContratualId","origemReconferenciaDeltaDesistenciaId")=1);

ALTER TABLE "PropostaReconferenciaDeltaDesistencia"
  ADD CONSTRAINT "PropostaReconferenciaDeltaDesistencia_hashes" CHECK("estadoHash"~'^[a-f0-9]{64}$' AND "condicoesHash"~'^[a-f0-9]{64}$' AND "fotografiaAnteriorHash"~'^[a-f0-9]{64}$' AND "fotografiaHash"~'^[a-f0-9]{64}$'),
  ADD CONSTRAINT "PropostaReconferenciaDeltaDesistencia_json" CHECK(jsonb_typeof(fotografia)='object' AND jsonb_typeof("memoriaDelta")='object'),
  ADD CONSTRAINT "PropostaReconferenciaDeltaDesistencia_versao" CHECK(versao>0),
  ADD CONSTRAINT "PropostaReconferenciaDeltaDesistencia_chave" CHECK(length(btrim("chaveIdempotencia")) BETWEEN 8 AND 100);
ALTER TABLE "AplicacaoReconferenciaDeltaDesistencia"
  ADD CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_hash" CHECK("fotografiaHash"~'^[a-f0-9]{64}$'),
  ADD CONSTRAINT "AplicacaoReconferenciaDeltaDesistencia_json" CHECK(jsonb_typeof(fotografia)='object' AND jsonb_typeof("memoriaDelta")='object');
ALTER TABLE "OrigemCreditoReconferenciaDeltaDesistencia"
  ADD CONSTRAINT "OrigemCreditoReconferenciaDeltaDesistencia_valor" CHECK(valor>0),
  ADD CONSTRAINT "OrigemCreditoReconferenciaDeltaDesistencia_moeda" CHECK(moeda~'^[A-Z]{3}$');
ALTER TABLE "ReconhecimentoCreditoReconferenciaDeltaDesistencia"
  ADD CONSTRAINT "ReconhecimentoCreditoReconferenciaDeltaDesistencia_valor" CHECK(valor>0);

-- A proposta é ancorada na aplicação base e na última aplicação delta já
-- materializada. A decisão posterior pode ser administrativa e financeira
-- pela mesma pessoa, mas nenhuma delas pode ser do preparador.
CREATE OR REPLACE FUNCTION q165_delta_contexto_249(proposta_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE p "PropostaReconferenciaDeltaDesistencia"%ROWTYPE; base "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; decisao_base "DecisaoAcertoDesistenciaContratual"%ROWTYPE; proposta_base "PropostaAcertoDesistenciaContratual"%ROWTYPE; ultimo "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; cond "CondicoesEncerramentoMatricula"%ROWTYPE; m "Matricula"%ROWTYPE;
BEGIN
 SELECT * INTO p FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=proposta_id FOR UPDATE;
 SELECT * INTO base FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=p."aplicacaoBaseId" FOR SHARE;
 SELECT * INTO decisao_base FROM "DecisaoAcertoDesistenciaContratual" WHERE id=base."decisaoId" FOR SHARE;
 SELECT * INTO proposta_base FROM "PropostaAcertoDesistenciaContratual" WHERE id=decisao_base."propostaId" FOR SHARE;
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=proposta_base."pedidoId" FOR UPDATE;
 SELECT * INTO cond FROM "CondicoesEncerramentoMatricula" WHERE id=proposta_base."condicoesId" FOR SHARE;
 SELECT * INTO m FROM "Matricula" WHERE id=pe."matriculaId" FOR UPDATE;
 SELECT * INTO ultimo FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE "aplicacaoBaseId"=base.id ORDER BY "criadaEm" DESC,id DESC LIMIT 1 FOR UPDATE;
 PERFORM id FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE;
 IF p.id IS NULL OR base.id IS NULL OR decisao_base.id IS NULL OR proposta_base.id IS NULL OR pe.id IS NULL OR cond.id IS NULL OR m.id IS NULL
   OR NOT decisao_base.aprovada OR p."pedidoId" IS DISTINCT FROM proposta_base."pedidoId" OR p."condicoesId" IS DISTINCT FROM proposta_base."condicoesId"
   OR p."estadoHash" IS DISTINCT FROM proposta_base."estadoHash" OR p."condicoesHash" IS DISTINCT FROM base."condicoesHash"
   OR p."aplicacaoDeltaAnteriorId" IS DISTINCT FROM ultimo.id OR p."fotografiaAnteriorHash" IS DISTINCT FROM COALESCE(ultimo."fotografiaHash",base."fotografiaHash")
   OR p.versao <> COALESCE((SELECT max(x.versao)+1 FROM "PropostaReconferenciaDeltaDesistencia" x WHERE x."aplicacaoBaseId"=base.id AND x.id<>p.id),1)
   OR m.status NOT IN ('RASCUNHO','AGUARDANDO') OR m."ativadaEm" IS NOT NULL OR EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=m.id AND x.versao>pe.versao)
   OR EXISTS(SELECT 1 FROM "CondicoesEncerramentoMatricula" x WHERE x."matriculaId"=m.id AND x.versao>cond.versao)
   OR NOT q165_fonte_condicoes_valida(cond.id,true) THEN RAISE EXCEPTION 'Reconferência delta não corresponde à cadeia, fonte contratual ou matrícula atual'; END IF;
END $$;

CREATE OR REPLACE FUNCTION q165_delta_memoria_249(proposta_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE p "PropostaReconferenciaDeltaDesistencia"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; base "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; proposta_base "PropostaAcertoDesistenciaContratual"%ROWTYPE; cobranca RECORD; item JSONB; devido NUMERIC; liquidado NUMERIC; credito_apurado NUMERIC; saldo_alvo NUMERIC; credito_delta NUMERIC; reducao_credito NUMERIC;
BEGIN
 SELECT * INTO p FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=proposta_id FOR SHARE;
 SELECT * INTO base FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=p."aplicacaoBaseId" FOR SHARE;
 SELECT pb.* INTO proposta_base FROM "PropostaAcertoDesistenciaContratual" pb JOIN "DecisaoAcertoDesistenciaContratual" db ON db."propostaId"=pb.id JOIN "AplicacaoAcertoDesistenciaContratual" ab ON ab."decisaoId"=db.id WHERE ab.id=base.id;
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=proposta_base."pedidoId" FOR SHARE;
 IF p."fotografiaHash" IS DISTINCT FROM encode(digest(q165_json_canon(p.fotografia),'sha256'),'hex') OR jsonb_typeof(p."memoriaDelta"->'itens') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Fotografia ou memória delta inválida'; END IF;
 IF p.estado='PENDENCIA_FINANCEIRA' AND p."memoriaDelta"->>'tipo' IS DISTINCT FROM 'PENDENCIA' THEN RAISE EXCEPTION 'Estado pendente exige memória delta pendente'; END IF;
 IF p.estado='PENDENCIA_FINANCEIRA' AND (EXISTS(SELECT 1 FROM "PagamentoInformado" i JOIN "Cobranca" c ON c.id=i."cobrancaId" WHERE c."matriculaId"=pe."matriculaId" AND i.status='A_CONFERIR') OR EXISTS(SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=pe."matriculaId" AND c."valorCompensadoPermuta">0)) AND jsonb_array_length(p."memoriaDelta"->'itens')=0 THEN RETURN; END IF;
 IF jsonb_array_length(p."memoriaDelta"->'itens')<>(SELECT count(*) FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId") THEN RAISE EXCEPTION 'Memória delta não contém todas as cobranças'; END IF;
 FOR cobranca IN SELECT * FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id LOOP
   SELECT x INTO item FROM jsonb_array_elements(p."memoriaDelta"->'itens') x WHERE x->>'cobrancaId'=cobranca.id;
   SELECT x->>'devido' INTO STRICT devido FROM jsonb_array_elements(proposta_base.memoria->'itens') x WHERE x->>'cobrancaId'=cobranca.id;
   SELECT coalesce(sum(d.valor),0)+cobranca."valorLiquidadoCredito" INTO liquidado FROM "DestinacaoRecebimento" d JOIN "Recebimento" r ON r.id=d."recebimentoId" WHERE d."cobrancaId"=cobranca.id AND r.moeda=cobranca.moeda;
   SELECT coalesce(sum(o.valor),0) INTO credito_apurado FROM (
     SELECT valor FROM "OrigemCreditoAcertoDesistenciaContratual" WHERE "cobrancaId"=cobranca.id
     UNION ALL SELECT valor FROM "OrigemCreditoReconferenciaDeltaDesistencia" WHERE "cobrancaId"=cobranca.id
   ) o;
   saldo_alvo:=greatest(devido-liquidado,0); credito_delta:=greatest(liquidado-devido-credito_apurado,0); reducao_credito:=greatest(credito_apurado-greatest(liquidado-devido,0),0);
   IF item IS NULL OR item->>'moeda' IS DISTINCT FROM cobranca.moeda OR (item->>'devidoAlvo')::numeric IS DISTINCT FROM devido OR (item->>'saldoAlvo')::numeric IS DISTINCT FROM saldo_alvo OR (item->>'ajusteDevido')::numeric IS DISTINCT FROM devido-cobranca."valorNegociado" OR (item->>'ajusteSaldo')::numeric IS DISTINCT FROM saldo_alvo-coalesce(cobranca.saldo,0) OR (item->>'creditoDelta')::numeric IS DISTINCT FROM credito_delta OR coalesce((item->>'reducaoCredito')::numeric,0) IS DISTINCT FROM reducao_credito THEN RAISE EXCEPTION 'Memória delta diverge das fontes financeiras reais'; END IF;
   IF p.estado='PENDENTE' AND reducao_credito>0 THEN RAISE EXCEPTION 'Redução de crédito exige pendência financeira auditável'; END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.fotografia->'cobrancas') f WHERE f->>'id'=cobranca.id AND f->>'moeda'=cobranca.moeda AND (f->>'valorNegociado')::numeric=cobranca."valorNegociado" AND coalesce((f->>'saldo')::numeric,0)=coalesce(cobranca.saldo,0) AND (f->>'valorLiquidadoCredito')::numeric=cobranca."valorLiquidadoCredito") THEN RAISE EXCEPTION 'Fotografia delta não corresponde à cobrança real'; END IF;
 END LOOP;
 IF jsonb_array_length(coalesce(p.fotografia->'creditos','[]'::jsonb))<>(SELECT count(*) FROM "CreditoMatricula" WHERE "matriculaId"=pe."matriculaId") OR EXISTS(
   SELECT 1 FROM "CreditoMatricula" cr WHERE cr."matriculaId"=pe."matriculaId" AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(p.fotografia->'creditos') f WHERE f->>'id'=cr.id AND f->>'moeda'=cr.moeda
       AND (f->>'valorInicial')::numeric=cr."valorInicial"
       AND (f->>'saldoDisponivel')::numeric=(cr."valorInicial"-coalesce((SELECT sum(u.valor) FROM "PropostaUsoCredito" u JOIN "DecisaoUsoCredito" d ON d."propostaId"=u.id AND d.aprovada WHERE u."creditoId"=cr.id),0)-coalesce((SELECT sum(r.valor) FROM "ReservaDevolucaoCredito" r WHERE r."creditoId"=cr.id AND r.estado<>'LIBERADA'),0))
   )
 ) THEN RAISE EXCEPTION 'Crédito ou saldo disponível mudou desde a reconferência'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p.fotografia->'cobrancas') f LEFT JOIN "Cobranca" c ON c.id=f->>'id' AND c."matriculaId"=pe."matriculaId" WHERE c.id IS NULL) OR (p.estado='PENDENTE' AND (EXISTS(SELECT 1 FROM "PagamentoInformado" i JOIN "Cobranca" c ON c.id=i."cobrancaId" WHERE c."matriculaId"=pe."matriculaId" AND i.status='A_CONFERIR') OR EXISTS(SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=pe."matriculaId" AND c."valorCompensadoPermuta">0))) OR (p.estado='PENDENTE' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p."memoriaDelta"->'itens') x WHERE coalesce((x->>'reducaoCredito')::numeric,0)>0)) THEN RAISE EXCEPTION 'Pendência, redução de crédito ou fotografia financeira impede a reconferência'; END IF;
END $$;

CREATE OR REPLACE FUNCTION q165_delta_guard_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "PropostaReconferenciaDeltaDesistencia"%ROWTYPE; u RECORD;
BEGIN
 IF TG_TABLE_NAME='PropostaReconferenciaDeltaDesistencia' THEN
   IF TG_OP='UPDATE' THEN
     IF OLD.estado='PENDENTE' AND NEW.estado='APLICADA'
       AND (to_jsonb(NEW)-'estado') IS NOT DISTINCT FROM (to_jsonb(OLD)-'estado')
       AND EXISTS(SELECT 1 FROM "AplicacaoReconferenciaDeltaDesistencia" a WHERE a."propostaId"=NEW.id) THEN RETURN NEW; END IF;
     RAISE EXCEPTION 'Proposta delta é imutável';
   ELSIF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta delta é imutável'; END IF;
   PERFORM q165_autorizado(NEW."preparadorId",false); PERFORM q165_delta_contexto_249(NEW.id); PERFORM q165_delta_memoria_249(NEW.id); RETURN NEW;
 END IF;
 SELECT * INTO p FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=NEW."propostaId" FOR UPDATE;
 SELECT ativo,papeis,permissoes INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
 IF TG_OP<>'INSERT' OR p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR u.ativo IS DISTINCT FROM true OR (NEW.aprovada AND p.estado<>'PENDENTE') THEN RAISE EXCEPTION 'Decisão delta inválida'; END IF;
 IF TG_TABLE_NAME='DecisaoReconferenciaDeltaDesistencia' THEN
   IF NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Alçada financeira delta insuficiente'; END IF;
 ELSEIF NOT ('ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Alçada administrativa delta insuficiente'; END IF;
 IF NEW.aprovada THEN PERFORM q165_delta_contexto_249(p.id); PERFORM q165_delta_memoria_249(p.id); END IF; RETURN NEW;
END $$;
DROP TRIGGER q165_guard_proposta_delta_249 ON "PropostaReconferenciaDeltaDesistencia";
DROP TRIGGER q165_guard_decisao_delta_249 ON "DecisaoReconferenciaDeltaDesistencia";
DROP TRIGGER q165_guard_admin_delta_249 ON "DecisaoAdministrativaReconferenciaDeltaDesistencia";
CREATE TRIGGER q165_delta_proposta_249 AFTER INSERT ON "PropostaReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_delta_guard_249();
CREATE TRIGGER q165_delta_proposta_imutavel_249 BEFORE UPDATE OR DELETE ON "PropostaReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_delta_guard_249();
CREATE TRIGGER q165_delta_decisao_financeira_249 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_delta_guard_249();
CREATE TRIGGER q165_delta_decisao_admin_249 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAdministrativaReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_delta_guard_249();

CREATE OR REPLACE FUNCTION q165_guard_aplicacao_delta_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "PropostaReconferenciaDeltaDesistencia"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação delta é imutável'; END IF;
 SELECT * INTO p FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=NEW."propostaId" FOR UPDATE;
 IF p.id IS NULL OR p.estado<>'PENDENTE' OR NOT EXISTS(SELECT 1 FROM "DecisaoReconferenciaDeltaDesistencia" f JOIN "DecisaoAdministrativaReconferenciaDeltaDesistencia" a ON a."propostaId"=f."propostaId" AND a.aprovada WHERE f.id=NEW."decisaoFinanceiraId" AND f."propostaId"=p.id AND f.aprovada AND f."decisorId"=NEW."executorId" AND f."fotografiaHash"=NEW."fotografiaHash" AND p."aplicacaoBaseId"=NEW."aplicacaoBaseId" AND p."aplicacaoDeltaAnteriorId" IS NOT DISTINCT FROM NEW."aplicacaoDeltaAnteriorId") THEN RAISE EXCEPTION 'Aplicação delta exige proposta aplicável e decisões aprovadas'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION q165_delta_efeitos_249(aplicacao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE; p "PropostaReconferenciaDeltaDesistencia"%ROWTYPE; base "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; pb "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; item JSONB; f JSONB;
BEGIN
 SELECT * INTO a FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=aplicacao_id FOR SHARE;
 SELECT * INTO p FROM "PropostaReconferenciaDeltaDesistencia" WHERE id=a."propostaId" FOR SHARE;
 SELECT * INTO base FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=a."aplicacaoBaseId" FOR SHARE;
 SELECT proposta.* INTO pb FROM "PropostaAcertoDesistenciaContratual" proposta JOIN "DecisaoAcertoDesistenciaContratual" decisao ON decisao."propostaId"=proposta.id WHERE decisao.id=base."decisaoId";
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=pb."pedidoId" FOR SHARE;
 IF a.id IS NULL OR p.id IS NULL OR base.id IS NULL OR pb.id IS NULL OR pe.id IS NULL OR a."aplicacaoBaseId" IS DISTINCT FROM p."aplicacaoBaseId" OR a."aplicacaoDeltaAnteriorId" IS DISTINCT FROM p."aplicacaoDeltaAnteriorId" OR a."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR a.fotografia IS DISTINCT FROM p.fotografia OR a."memoriaDelta" IS DISTINCT FROM p."memoriaDelta" OR NOT EXISTS(SELECT 1 FROM "DecisaoReconferenciaDeltaDesistencia" d WHERE d.id=a."decisaoFinanceiraId" AND d."propostaId"=p.id AND d.aprovada AND d."decisorId"=a."executorId") OR NOT EXISTS(SELECT 1 FROM "DecisaoAdministrativaReconferenciaDeltaDesistencia" d WHERE d."propostaId"=p.id AND d.aprovada) THEN RAISE EXCEPTION 'Aplicação delta não corresponde às decisões e fotografia aprovadas'; END IF;
 IF EXISTS(SELECT 1 FROM "AplicacaoReconferenciaDeltaDesistencia" posterior WHERE posterior."aplicacaoDeltaAnteriorId"=a.id) THEN RAISE EXCEPTION 'A efetivação deve usar somente a última aplicação delta'; END IF;
 FOR item IN SELECT x FROM jsonb_array_elements(p."memoriaDelta"->'itens') x LOOP
   IF NOT EXISTS(SELECT 1 FROM "Cobranca" c WHERE c.id=item->>'cobrancaId' AND c."matriculaId"=pe."matriculaId" AND c.moeda=item->>'moeda' AND c."valorNegociado"=(item->>'devidoAlvo')::numeric AND coalesce(c.saldo,0)=(item->>'saldoAlvo')::numeric) THEN RAISE EXCEPTION 'Cobrança não recebeu o efeito delta aprovado'; END IF;
   IF (item->>'creditoDelta')::numeric>0 THEN
     IF NOT EXISTS(SELECT 1 FROM "OrigemCreditoReconferenciaDeltaDesistencia" o JOIN "CreditoMatricula" cr ON cr."origemReconferenciaDeltaDesistenciaId"=o.id WHERE o."aplicacaoId"=a.id AND o."cobrancaId"=item->>'cobrancaId' AND o.valor=(item->>'creditoDelta')::numeric AND o.moeda=item->>'moeda' AND cr."matriculaId"=pe."matriculaId" AND cr."valorInicial"=o.valor AND cr.moeda=o.moeda) THEN RAISE EXCEPTION 'Crédito delta não corresponde à origem por cobrança'; END IF;
   ELSIF EXISTS(SELECT 1 FROM "OrigemCreditoReconferenciaDeltaDesistencia" o WHERE o."aplicacaoId"=a.id AND o."cobrancaId"=item->>'cobrancaId') THEN RAISE EXCEPTION 'Origem delta sem crédito aprovado'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM "OrigemCreditoReconferenciaDeltaDesistencia" WHERE "aplicacaoId"=a.id)<>(SELECT count(*) FROM jsonb_array_elements(p."memoriaDelta"->'itens') x WHERE (x->>'creditoDelta')::numeric>0) THEN RAISE EXCEPTION 'Origens delta não comprovam todos os efeitos'; END IF;
 FOR f IN SELECT x FROM jsonb_array_elements(p.fotografia->'cobrancas') x LOOP
   IF NOT EXISTS(SELECT 1 FROM "Cobranca" c WHERE c.id=f->>'id' AND c."matriculaId"=pe."matriculaId" AND c.moeda=f->>'moeda' AND c."valorOriginal"=(f->>'valorOriginal')::numeric AND c."valorRecebido" IS NOT DISTINCT FROM (f->>'valorRecebido')::numeric AND c."valorLiquidadoCredito"=(f->>'valorLiquidadoCredito')::numeric)
     OR jsonb_array_length(coalesce(f->'informes','[]'::jsonb))<>(SELECT count(*) FROM "PagamentoInformado" i WHERE i."cobrancaId"=f->>'id')
     OR jsonb_array_length(coalesce(f->'recebimentos','[]'::jsonb))<>(SELECT count(*) FROM "DestinacaoRecebimento" d WHERE d."cobrancaId"=f->>'id') THEN RAISE EXCEPTION 'Fonte financeira mudou depois da reconferência delta'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=pe."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.fotografia->'cobrancas') f WHERE f->>'id'=c.id)) OR EXISTS(SELECT 1 FROM "PagamentoInformado" i JOIN "Cobranca" c ON c.id=i."cobrancaId" WHERE c."matriculaId"=pe."matriculaId" AND i.status='A_CONFERIR') OR EXISTS(SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=pe."matriculaId" AND c."valorCompensadoPermuta">0) THEN RAISE EXCEPTION 'Pendência ou fonte financeira posterior impede efetivação'; END IF;
END $$;

CREATE OR REPLACE FUNCTION q165_delta_origem_guard_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE; item JSONB;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Origem delta é imutável'; END IF;
 SELECT * INTO a FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=NEW."aplicacaoId" FOR SHARE;
 SELECT x INTO item FROM jsonb_array_elements(a."memoriaDelta"->'itens') x WHERE x->>'cobrancaId'=NEW."cobrancaId";
 IF a.id IS NULL OR item IS NULL OR NEW."matriculaId" IS DISTINCT FROM a.fotografia->>'matriculaId' OR NEW.valor IS DISTINCT FROM (item->>'creditoDelta')::numeric OR NEW.moeda IS DISTINCT FROM item->>'moeda' THEN RAISE EXCEPTION 'Origem delta diverge do cálculo aprovado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER q165_delta_origem_249 BEFORE INSERT OR UPDATE OR DELETE ON "OrigemCreditoReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_delta_origem_guard_249();
CREATE OR REPLACE FUNCTION q165_delta_credito_guard_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE o "OrigemCreditoReconferenciaDeltaDesistencia"%ROWTYPE;
BEGIN
 SELECT * INTO o FROM "OrigemCreditoReconferenciaDeltaDesistencia" WHERE id=NEW."origemReconferenciaDeltaDesistenciaId" FOR SHARE;
 IF o.id IS NULL OR NEW."matriculaId" IS DISTINCT FROM o."matriculaId" OR NEW.moeda IS DISTINCT FROM o.moeda OR NEW."valorInicial" IS DISTINCT FROM o.valor THEN RAISE EXCEPTION 'Crédito delta diverge da origem auditável'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER q165_delta_credito_249 BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW WHEN (NEW."origemReconferenciaDeltaDesistenciaId" IS NOT NULL) EXECUTE FUNCTION q165_delta_credito_guard_249();
CREATE OR REPLACE FUNCTION q165_delta_reconhecimento_guard_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE; cr "CreditoMatricula"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Reconhecimento de crédito é imutável'; END IF;
 SELECT * INTO a FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=NEW."aplicacaoId" FOR SHARE;
 SELECT * INTO cr FROM "CreditoMatricula" WHERE id=NEW."creditoId" FOR SHARE;
 IF a.id IS NULL OR cr.id IS NULL OR cr."matriculaId" IS DISTINCT FROM a.fotografia->>'matriculaId' OR num_nonnulls(cr."origemLiberacaoId",cr."origemAcertoId",cr."origemPeriodoIntegralId",cr."origemDestinacaoRecebimentoId",cr."origemAcertoTaxaAditivoId",cr."origemAcertoDesistenciaContratualId",cr."origemReconferenciaDeltaDesistenciaId")<>1 OR cr."origemAcertoDesistenciaContratualId" IS NOT NULL OR cr."origemReconferenciaDeltaDesistenciaId" IS NOT NULL OR NEW.valor IS DISTINCT FROM (cr."valorInicial"-coalesce((SELECT sum(u.valor) FROM "PropostaUsoCredito" u JOIN "DecisaoUsoCredito" d ON d."propostaId"=u.id AND d.aprovada WHERE u."creditoId"=cr.id),0)-coalesce((SELECT sum(r.valor) FROM "ReservaDevolucaoCredito" r WHERE r."creditoId"=cr.id AND r.estado<>'LIBERADA'),0)) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a."memoriaDelta"->'creditosExternos') x WHERE x->>'id'=cr.id AND (x->>'saldoDisponivel')::numeric=NEW.valor AND x->>'moeda'=cr.moeda) THEN RAISE EXCEPTION 'Reconhecimento exige crédito externo da fotografia delta'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER q165_delta_reconhecimento_249 BEFORE INSERT OR UPDATE OR DELETE ON "ReconhecimentoCreditoReconferenciaDeltaDesistencia" FOR EACH ROW EXECUTE FUNCTION q165_delta_reconhecimento_guard_249();
CREATE OR REPLACE FUNCTION q165_delta_aplicacao_efeitos_trigger_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN PERFORM q165_delta_efeitos_249(NEW.id); RETURN NEW; END $$;
CREATE CONSTRAINT TRIGGER q165_delta_aplicacao_efeitos_249 AFTER INSERT ON "AplicacaoReconferenciaDeltaDesistencia" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION q165_delta_aplicacao_efeitos_trigger_249();

-- A efetivação existente continua recebendo a aplicação base como referência,
-- mas, quando houver deltas, confere os efeitos da última aplicação da cadeia
-- em vez de rejeitar créditos delta como se fossem acréscimos externos.
ALTER FUNCTION q165_validar_efeitos_aplicacao(TEXT) RENAME TO q165_validar_efeitos_base_249;
CREATE FUNCTION q165_validar_efeitos_aplicacao(aplicacao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE ultima TEXT;
BEGIN
 SELECT d.id INTO ultima FROM "AplicacaoReconferenciaDeltaDesistencia" d WHERE d."aplicacaoBaseId"=aplicacao_id ORDER BY d."criadaEm" DESC,d.id DESC LIMIT 1;
 IF ultima IS NULL THEN PERFORM q165_validar_efeitos_base_249(aplicacao_id); ELSE PERFORM q165_delta_efeitos_249(ultima); END IF;
END $$;
