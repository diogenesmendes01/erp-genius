BEGIN;

-- FIN-04/Q87: caixa é um fato único; baixa de cobrança e crédito são suas
-- destinações. O vínculo singular permanece apenas para leitura de legado.
CREATE TYPE "TipoDestinacaoRecebimento" AS ENUM ('COBRANCA', 'CREDITO_SEM_DESTINO');

ALTER TABLE "Recebimento" ALTER COLUMN "cobrancaId" DROP NOT NULL;
ALTER TABLE "Recebimento" ADD COLUMN "titularMatriculaId" text, ADD COLUMN "pagadorId" text;
ALTER TABLE "Recebimento"
  ADD CONSTRAINT "Recebimento_titularMatriculaId_fkey" FOREIGN KEY ("titularMatriculaId") REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "Recebimento_pagadorId_fkey" FOREIGN KEY ("pagadorId") REFERENCES "PagadorPreparacaoMatricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- O titular vem somente da cobrança que já era registrada. Pagador e evidência
-- não eram fatos do legado e permanecem ausentes em vez de serem inventados.
UPDATE "Recebimento" r SET "titularMatriculaId" = c."matriculaId" FROM "Cobranca" c WHERE c.id = r."cobrancaId";
ALTER TABLE "Recebimento" ALTER COLUMN "titularMatriculaId" SET NOT NULL;
CREATE INDEX "Recebimento_titularMatriculaId_idx" ON "Recebimento"("titularMatriculaId");
CREATE INDEX "Recebimento_pagadorId_idx" ON "Recebimento"("pagadorId");

CREATE TABLE "DestinacaoRecebimento" (
  id text PRIMARY KEY,
  "recebimentoId" text NOT NULL REFERENCES "Recebimento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "cobrancaId" text REFERENCES "Cobranca"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "autorId" text NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  tipo "TipoDestinacaoRecebimento" NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  evidencia text,
  "origemLegada" boolean NOT NULL DEFAULT false,
  "chaveIdempotencia" text NOT NULL,
  "criadaEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DestinacaoRecebimento_tipo_destino_check" CHECK ((tipo = 'COBRANCA' AND "cobrancaId" IS NOT NULL) OR (tipo = 'CREDITO_SEM_DESTINO' AND "cobrancaId" IS NULL)),
  CONSTRAINT "DestinacaoRecebimento_evidencia_nova_check" CHECK ("origemLegada" OR (evidencia IS NOT NULL AND length(btrim(evidencia)) >= 5)),
  CONSTRAINT "DestinacaoRecebimento_recebimento_chave_key" UNIQUE ("recebimentoId", "chaveIdempotencia")
);
CREATE INDEX "DestinacaoRecebimento_cobrancaId_idx" ON "DestinacaoRecebimento"("cobrancaId");
CREATE UNIQUE INDEX "DestinacaoRecebimento_recebimento_cobranca_unica"
  ON "DestinacaoRecebimento"("recebimentoId", "cobrancaId")
  WHERE "cobrancaId" IS NOT NULL;
INSERT INTO "DestinacaoRecebimento" (id, "recebimentoId", "cobrancaId", "autorId", tipo, valor, evidencia, "origemLegada", "chaveIdempotencia", "criadaEm")
SELECT 'legado-211:' || r.id, r.id, r."cobrancaId", r."autorId", 'COBRANCA', r.valor, NULL, true, 'legado-211:' || r.id, r."criadoEm"
FROM "Recebimento" r WHERE r."cobrancaId" IS NOT NULL;

ALTER TABLE "CreditoMatricula" ADD COLUMN "origemDestinacaoRecebimentoId" text UNIQUE REFERENCES "DestinacaoRecebimento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = '"CreditoMatricula"'::regclass AND pg_get_constraintdef(oid) LIKE '%num_nonnulls%' LOOP
    EXECUTE format('ALTER TABLE "CreditoMatricula" DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "credito_matricula_origem_unica_check" CHECK (num_nonnulls("origemLiberacaoId", "origemAcertoId", "origemPeriodoIntegralId", "origemDestinacaoRecebimentoId") = 1);

-- A aplicação M01 é única por parcela, não por fato de caixa: um mesmo
-- recebimento pode conciliar duas cobranças sem duplicar o caixa. A referência
-- raiz é preservada para auditoria e dados antigos; a unicidade nova é material.
ALTER TABLE "ConciliacaoFinanceiraMigracao" DROP CONSTRAINT IF EXISTS "ConciliacaoFinanceiraMigracao_recebimentoId_key";
CREATE INDEX "ConciliacaoFinanceiraMigracao_recebimentoId_idx" ON "ConciliacaoFinanceiraMigracao"("recebimentoId");
ALTER TABLE "ConciliacaoFinanceiraMigracao" ADD COLUMN "destinacaoRecebimentoId" text REFERENCES "DestinacaoRecebimento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
-- A coluna não existia quando as aplicações históricas foram protegidas como
-- append-only. O único UPDATE controlado da migração preenche a projeção; a
-- mesma guarda é restaurada antes de qualquer transação de domínio.
ALTER TABLE "ConciliacaoFinanceiraMigracao" DISABLE TRIGGER "aplicacao_conciliacao_financeira_migracao_guard";
UPDATE "ConciliacaoFinanceiraMigracao" a SET "destinacaoRecebimentoId"=d.id
FROM "PropostaConciliacaoFinanceiraMigracao" p, "DestinacaoRecebimento" d
WHERE p.id=a."propostaId" AND d."recebimentoId"=a."recebimentoId" AND d."cobrancaId"=p."cobrancaId" AND a."recebimentoId" IS NOT NULL;
ALTER TABLE "ConciliacaoFinanceiraMigracao" ENABLE TRIGGER "aplicacao_conciliacao_financeira_migracao_guard";
CREATE UNIQUE INDEX "ConciliacaoFinanceiraMigracao_destinacaoRecebimentoId_key" ON "ConciliacaoFinanceiraMigracao"("destinacaoRecebimentoId") WHERE "destinacaoRecebimentoId" IS NOT NULL;

CREATE OR REPLACE FUNCTION "conferir_recebimento_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; p "PagadorPreparacaoMatricula"%ROWTYPE; i "PagamentoInformado"%ROWTYPE; c "Cobranca"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Recebimento original é imutável; use destinações, crédito ou devolução.'; END IF;
  IF NEW."cobrancaId" IS NOT NULL THEN RAISE EXCEPTION 'Novo recebimento não usa cobrança singular; registre as destinações.'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR NOT u.ativo OR NOT ('ADMINISTRADOR' = ANY(u.papeis) OR 'FINANCEIRO' = ANY(u.papeis) OR 'pagamento.caixa' = ANY(u.permissoes)) THEN RAISE EXCEPTION 'Recebimento exige autor financeiro ativo ou capacidade de caixa vigente.'; END IF;
  IF NEW.valor <= 0 OR NEW.moeda !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Recebimento exige valor positivo e moeda ISO preservada.'; END IF;
  IF NEW."pagadorId" IS NOT NULL THEN
    SELECT * INTO p FROM "PagadorPreparacaoMatricula" WHERE id = NEW."pagadorId" FOR SHARE;
    IF NOT FOUND OR p."matriculaId" IS DISTINCT FROM NEW."titularMatriculaId" THEN RAISE EXCEPTION 'Pagador do recebimento deve pertencer ao titular explícito.'; END IF;
  END IF;
  IF NEW."informeId" IS NOT NULL THEN
    SELECT * INTO i FROM "PagamentoInformado" WHERE id = NEW."informeId" FOR SHARE;
    SELECT * INTO c FROM "Cobranca" WHERE id = i."cobrancaId" FOR SHARE;
    IF NOT FOUND OR c."matriculaId" IS DISTINCT FROM NEW."titularMatriculaId" OR i.valor IS DISTINCT FROM NEW.valor OR i.moeda IS DISTINCT FROM NEW.moeda OR i.forma IS DISTINCT FROM NEW.forma OR i."dataPagamento" IS DISTINCT FROM NEW."dataPagamento" THEN RAISE EXCEPTION 'Informe não corresponde ao recebimento original preservado.'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "recebimento_fin04_211_guard" BEFORE INSERT OR UPDATE OR DELETE ON "Recebimento" FOR EACH ROW EXECUTE FUNCTION "conferir_recebimento_fin04_211"();

CREATE OR REPLACE FUNCTION "conferir_destinacao_recebimento_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "Recebimento"%ROWTYPE; c "Cobranca"%ROWTYPE; u "Usuario"%ROWTYPE; destinado numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Destinação de recebimento é imutável.'; END IF;
  IF NEW."origemLegada" THEN RAISE EXCEPTION 'Origem legada só pode ser criada pela migração.'; END IF;
  SELECT * INTO r FROM "Recebimento" WHERE id = NEW."recebimentoId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR r."titularMatriculaId" IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR' = ANY(u.papeis) OR 'FINANCEIRO' = ANY(u.papeis) OR 'pagamento.caixa' = ANY(u.permissoes)) THEN RAISE EXCEPTION 'Destinação exige recebimento com titular e autor de caixa vigente.'; END IF;
  IF NEW.evidencia IS NULL OR length(btrim(NEW.evidencia)) < 5 THEN RAISE EXCEPTION 'Destinação nova exige evidência identificada.'; END IF;
  IF NEW.tipo = 'COBRANCA' THEN
    SELECT * INTO c FROM "Cobranca" WHERE id = NEW."cobrancaId" FOR UPDATE;
    IF NOT FOUND OR c."matriculaId" IS DISTINCT FROM r."titularMatriculaId" OR c.moeda IS DISTINCT FROM r.moeda THEN RAISE EXCEPTION 'Destinação não pode trocar titular ou converter moeda.'; END IF;
  END IF;
  SELECT coalesce(sum(d.valor), 0) INTO destinado FROM "DestinacaoRecebimento" d WHERE d."recebimentoId" = NEW."recebimentoId";
  IF destinado + NEW.valor > r.valor THEN RAISE EXCEPTION 'Destinações excedem o valor do recebimento original.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "destinacao_recebimento_fin04_211_guard" BEFORE INSERT OR UPDATE OR DELETE ON "DestinacaoRecebimento" FOR EACH ROW EXECUTE FUNCTION "conferir_destinacao_recebimento_fin04_211"();

-- As guardas de 156/173 ainda recebem `NEW.cobrancaId`; uma destinação de
-- cobrança possui a mesma coluna e passa a ser bloqueada pelas mesmas regras.
-- O recebimento novo não tem cobrança singular, portanto sem estes triggers
-- seria possível baixar uma cobrança cancelada ou regularizada por crédito.
CREATE TRIGGER "z_destinacao_recebimento_impedir_periodo_integral"
BEFORE INSERT ON "DestinacaoRecebimento" FOR EACH ROW
WHEN (NEW.tipo = 'COBRANCA')
EXECUTE FUNCTION impedir_recebimento_periodo_integral();
CREATE TRIGGER "z_destinacao_recebimento_impedir_desistencia"
BEFORE INSERT ON "DestinacaoRecebimento" FOR EACH ROW
WHEN (NEW.tipo = 'COBRANCA')
EXECUTE FUNCTION impedir_baixa_cobranca_desistencia();

-- A prévia/efetivação de desistência deve detectar também a baixa que já não
-- fica materializada em Recebimento.cobrancaId.
CREATE OR REPLACE FUNCTION validar_fontes_cobrancas_desistencia(matricula_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Cobranca" WHERE "matriculaId"=matricula_id) THEN RAISE EXCEPTION 'Não há cobranças para tratamento financeiro'; END IF;
 IF EXISTS(SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND (
 c.status NOT IN ('PENDENTE','ATRASADO','CANCELADA') OR coalesce(c."valorRecebido",0)<>0 OR c."valorLiquidadoCredito"<>0 OR c."pagoEm" IS NOT NULL
 OR c.saldo IS NULL OR c.saldo IS DISTINCT FROM c."valorNegociado" OR c."valorOriginal"<0 OR c."valorNegociado"<0
 OR c."canceladaPorPausaId" IS NOT NULL OR c."suspensaPorItemPausaId" IS NOT NULL OR c."acertoMultaDecisaoId" IS NOT NULL
 OR EXISTS(SELECT 1 FROM "DestinacaoRecebimento" d WHERE d."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "PagamentoInformado" i WHERE i."cobrancaId"=c.id AND i.status<>'REJEITADO')
 OR EXISTS(SELECT 1 FROM "PropostaUsoCredito" u WHERE u."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "CompensacaoCoberturaMatricula" a WHERE a."cobrancaOrigemId"=c.id)
 OR EXISTS(SELECT 1 FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "AplicacaoPeriodoIntegral" a WHERE a."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "EmissaoFechamentoHoras" a WHERE a."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "CompraHorasAntecipadas" a WHERE a."cobrancaId"=c.id))) THEN RAISE EXCEPTION 'Cobrança exige acerto financeiro específico'; END IF;
END $$;

CREATE OR REPLACE FUNCTION "conferir_credito_destinacao_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d "DestinacaoRecebimento"%ROWTYPE; r "Recebimento"%ROWTYPE;
BEGIN
  SELECT * INTO d FROM "DestinacaoRecebimento" WHERE id = NEW."origemDestinacaoRecebimentoId" FOR SHARE;
  SELECT * INTO r FROM "Recebimento" WHERE id = d."recebimentoId" FOR SHARE;
  IF NOT FOUND OR d.tipo IS DISTINCT FROM 'CREDITO_SEM_DESTINO' OR d."origemLegada" OR NEW."matriculaId" IS DISTINCT FROM r."titularMatriculaId" OR NEW.moeda IS DISTINCT FROM r.moeda OR NEW."valorInicial" IS DISTINCT FROM d.valor THEN RAISE EXCEPTION 'Crédito deve preservar valor, titular e moeda de uma destinação sem destino.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "credito_destinacao_fin04_211_guard" BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW WHEN (NEW."origemDestinacaoRecebimentoId" IS NOT NULL) EXECUTE FUNCTION "conferir_credito_destinacao_fin04_211"();

-- Cobranca.valorRecebido é a projeção das destinações. Q68 continua somando
-- somente decisões aprovadas de uso de crédito.
CREATE OR REPLACE FUNCTION "proteger_saldo_credito_cobranca"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total_credito numeric; total_recebido numeric; saldo_esperado numeric;
BEGIN
  SELECT coalesce(sum(p.valor), 0) INTO total_credito FROM "PropostaUsoCredito" p JOIN "DecisaoUsoCredito" d ON d."propostaId" = p.id AND d.aprovada WHERE p."cobrancaId" = NEW.id;
  SELECT coalesce(sum(dest.valor), 0) INTO total_recebido FROM "DestinacaoRecebimento" dest WHERE dest."cobrancaId" = NEW.id;
  saldo_esperado := greatest(0, NEW."valorNegociado" - total_recebido - total_credito);
  IF NEW."valorLiquidadoCredito" IS DISTINCT FROM total_credito OR coalesce(NEW."valorRecebido", 0) IS DISTINCT FROM total_recebido OR (NEW.saldo IS NOT NULL AND NEW.saldo IS DISTINCT FROM saldo_esperado) OR (NEW.status = 'PAGO' AND saldo_esperado <> 0) THEN RAISE EXCEPTION 'Cobrança deve refletir somente destinações e créditos aprovados.'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "conferir_commit_destinacao_recebimento_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "Cobranca"%ROWTYPE; total numeric;
BEGIN
  IF NEW.tipo = 'COBRANCA' THEN
    SELECT * INTO c FROM "Cobranca" WHERE id = NEW."cobrancaId" FOR SHARE;
    SELECT coalesce(sum(valor), 0) INTO total FROM "DestinacaoRecebimento" WHERE "cobrancaId" = NEW."cobrancaId";
    IF coalesce(c."valorRecebido", 0) IS DISTINCT FROM total THEN RAISE EXCEPTION 'Destinação exige atualizar o acumulado da cobrança na mesma transação.'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM "CreditoMatricula" cr WHERE cr."origemDestinacaoRecebimentoId" = NEW.id) THEN
    RAISE EXCEPTION 'Destinação sem destino exige crédito rastreável na mesma transação.';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "destinacao_recebimento_fin04_211_commit_guard" AFTER INSERT ON "DestinacaoRecebimento" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "conferir_commit_destinacao_recebimento_fin04_211"();

-- M01/195 continua proibindo que a entrada histórica fabrique uma baixa. A
-- ausência agora é observada na destinação, não na coluna legada do caixa.
CREATE OR REPLACE FUNCTION "m01_entrada_financeira_aplicacao_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; c record; pg record;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Aplicação de entrada financeira M01 é append-only'; END IF;
 SELECT * INTO p FROM "PropostaEntradaFinanceiraHistoricaMigracao" WHERE id=NEW."propostaId";
 SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId";
 SELECT * INTO pg FROM "PagadorPreparacaoMatricula" WHERE id=NEW."pagadorId";
 IF p.status IS DISTINCT FROM 'APROVADA' OR p."decisorId" IS DISTINCT FROM NEW."aplicadaPorId" OR p.origem IS DISTINCT FROM NEW.origem OR p."financeiroOrigemId" IS DISTINCT FROM NEW."financeiroOrigemId" OR c."matriculaId" IS DISTINCT FROM p."matriculaId" OR pg."matriculaId" IS DISTINCT FROM p."matriculaId" OR c.status IS DISTINCT FROM 'PENDENTE' OR c."valorRecebido" IS NOT NULL OR c.saldo IS DISTINCT FROM c."valorNegociado" OR c."valorOriginal" IS DISTINCT FROM p.valor OR c."valorNegociado" IS DISTINCT FROM p.valor OR c.saldo IS DISTINCT FROM p.valor OR c.moeda IS DISTINCT FROM p.moeda OR c.tipo IS DISTINCT FROM p."tipoCobranca" OR c.vencimento::date IS DISTINCT FROM p.vencimento OR c.competencia IS DISTINCT FROM p.competencia OR pg.tipo IS DISTINCT FROM p."dadosPagador"->>'tipo' OR pg.dados IS DISTINCT FROM p."dadosPagador"->'dados' THEN RAISE EXCEPTION 'Aplicação M01 deve materializar exatamente o pagador e obrigação pendente aprovados'; END IF;
 IF EXISTS (SELECT 1 FROM "DestinacaoRecebimento" d WHERE d."cobrancaId"=c.id) THEN RAISE EXCEPTION 'M01 não admite recebimento histórico fabricado'; END IF;
 RETURN NEW;
END $$;

-- M01/192: BAIXAR confere a parcela material da cobrança, preservando o
-- recebimento raiz (valor/data/moeda/forma/autoria) sem exigir vínculo singular.
CREATE OR REPLACE FUNCTION "conferir_aplicacao_conciliacao_financeira_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Aplicação financeira M01 é append-only'; END IF;
 SELECT * INTO p FROM "PropostaConciliacaoFinanceiraMigracao" WHERE id=NEW."propostaId";
 IF NEW.origem IS DISTINCT FROM p.origem OR NEW."financeiroOrigemId" IS DISTINCT FROM p."financeiroOrigemId" THEN RAISE EXCEPTION 'Aplicação deve preservar a identidade financeira da origem'; END IF;
 IF p.status IS DISTINCT FROM 'APROVADA' OR p."decisorId" IS NULL OR p."decisorId"=p."preparadorId" OR p."decisorId" IS DISTINCT FROM NEW."aplicadaPorId" THEN RAISE EXCEPTION 'Aplicação exige proposta aprovada por decisor independente'; END IF;
 IF p.modalidade='PENDENCIA' AND (NEW."recebimentoId" IS NOT NULL OR NEW."destinacaoRecebimentoId" IS NOT NULL) THEN RAISE EXCEPTION 'Pendência financeira não recebe pagamento'; END IF;
 IF p.modalidade IN ('VINCULAR_RECEBIMENTO','BAIXAR') AND (NEW."recebimentoId" IS NULL OR NEW."destinacaoRecebimentoId" IS NULL) THEN RAISE EXCEPTION 'Conciliação de pagamento exige recebimento e destinação'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."aplicadaPorId" AND u.ativo AND ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) THEN RAISE EXCEPTION 'Aplicador financeiro inativo ou sem papel'; END IF;
 IF p.modalidade='VINCULAR_RECEBIMENTO' AND (NEW."recebimentoId" IS DISTINCT FROM p."recebimentoExistenteId" OR NOT EXISTS (SELECT 1 FROM "DestinacaoRecebimento" d WHERE d.id=NEW."destinacaoRecebimentoId" AND d."recebimentoId"=NEW."recebimentoId" AND d."cobrancaId"=p."cobrancaId" AND d.valor=p.valor)) THEN RAISE EXCEPTION 'Aplicação deve usar destinação conferida'; END IF;
 IF p.modalidade='BAIXAR' AND NOT EXISTS (
   SELECT 1 FROM "Recebimento" r JOIN "DestinacaoRecebimento" d ON d."recebimentoId"=r.id
   WHERE r.id=NEW."recebimentoId" AND d.id=NEW."destinacaoRecebimentoId" AND r."titularMatriculaId"=p."matriculaId" AND r."pagadorId"=p."pagadorId"
     AND d.tipo='COBRANCA' AND d."cobrancaId"=p."cobrancaId" AND d.valor=p.valor
     AND r.moeda=p.moeda AND (r."dataPagamento" AT TIME ZONE 'UTC')=p."dataPagamento" AND r.forma=p.forma
     AND r."chaveIdempotencia"=('m01-financeiro:'||p.id) AND r."autorId"=p."decisorId" AND r."autorId"=NEW."aplicadaPorId") THEN RAISE EXCEPTION 'Recebimento baixado não corresponde materialmente à proposta'; END IF;
 RETURN NEW;
END $$;

-- M01/192: conserva as transições e a fotografia anterior, mas para uma foto
-- Q87 compara a parcela da cobrança em vez de atribuir o fato de caixa inteiro.
CREATE OR REPLACE FUNCTION "conferir_proposta_conciliacao_financeira_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linha_tipo "TipoEntradaPreparacaoMigracao"; linha_financeiro text; lote_origem text; cobranca_matricula text; pagador_matricula text; receb record;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Proposta financeira M01 é append-only'; END IF;
 IF TG_OP='INSERT' AND NEW.status IS DISTINCT FROM 'PENDENTE' THEN RAISE EXCEPTION 'Proposta financeira inicia pendente'; END IF;
 IF TG_OP='UPDATE' AND (OLD.id,OLD.origem,OLD."financeiroOrigemId",OLD.versao,OLD."linhaId",OLD."matriculaId",OLD."cobrancaId",OLD."pagadorId",OLD.modalidade,OLD.valor,OLD.moeda,OLD."dataPagamento",OLD.forma,OLD."recebimentoExistenteId",OLD.evidencia,OLD.complemento,OLD.entrada,OLD.snapshot,OLD."entradaHash",OLD."estadoHash",OLD."chaveIdempotencia",OLD."preparadorId",OLD."criadoEm") IS DISTINCT FROM (NEW.id,NEW.origem,NEW."financeiroOrigemId",NEW.versao,NEW."linhaId",NEW."matriculaId",NEW."cobrancaId",NEW."pagadorId",NEW.modalidade,NEW.valor,NEW.moeda,NEW."dataPagamento",NEW.forma,NEW."recebimentoExistenteId",NEW.evidencia,NEW.complemento,NEW.entrada,NEW.snapshot,NEW."entradaHash",NEW."estadoHash",NEW."chaveIdempotencia",NEW."preparadorId",NEW."criadoEm") THEN RAISE EXCEPTION 'Proposta financeira M01 é imutável'; END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('REJEITADA','APLICADA') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Proposta financeira M01 encerrada é imutável'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='APROVADA' AND (OLD."decisorId",OLD."motivoDecisao",OLD."chaveDecisao",OLD."decididoEm") IS DISTINCT FROM (NEW."decisorId",NEW."motivoDecisao",NEW."chaveDecisao",NEW."decididoEm") THEN RAISE EXCEPTION 'Decisão aprovada é imutável'; END IF;
 IF TG_OP='UPDATE' AND NOT ((OLD.status='PENDENTE' AND NEW.status IN ('APROVADA','REJEITADA')) OR (OLD.status='APROVADA' AND NEW.status='APLICADA')) THEN RAISE EXCEPTION 'Transição financeira M01 inválida'; END IF;
 IF NEW.status IN ('APROVADA','REJEITADA') AND (NEW."decisorId" IS NULL OR NEW."decisorId"=NEW."preparadorId" OR NEW."motivoDecisao" IS NULL OR btrim(NEW."motivoDecisao")='' OR NEW."decididoEm" IS NULL OR NEW."chaveDecisao" IS NULL OR btrim(NEW."chaveDecisao")='') THEN RAISE EXCEPTION 'Decisão exige decisor independente, motivo, chave e data'; END IF;
 IF NEW.status='APLICADA' AND (NEW."decisorId" IS NULL OR NEW."aplicadaEm" IS NULL) THEN RAISE EXCEPTION 'Aplicação exige decisão e data'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."preparadorId" AND u.ativo AND ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) OR (NEW."decisorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."decisorId" AND u.ativo AND ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) ) THEN RAISE EXCEPTION 'Responsável financeiro inativo ou sem papel'; END IF;
 SELECT l."tipoEntrada",l."financeiroOrigemId",lo.origem INTO linha_tipo,linha_financeiro,lote_origem FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" WHERE l.id=NEW."linhaId";
 SELECT "matriculaId" INTO cobranca_matricula FROM "Cobranca" WHERE id=NEW."cobrancaId"; SELECT "matriculaId" INTO pagador_matricula FROM "PagadorPreparacaoMatricula" WHERE id=NEW."pagadorId";
 IF linha_tipo IS DISTINCT FROM 'FINANCEIRO_HISTORICO'::"TipoEntradaPreparacaoMigracao" OR linha_financeiro IS NULL OR lote_origem IS DISTINCT FROM NEW.origem OR linha_financeiro IS DISTINCT FROM NEW."financeiroOrigemId" OR cobranca_matricula IS DISTINCT FROM NEW."matriculaId" OR pagador_matricula IS DISTINCT FROM NEW."matriculaId" OR NOT EXISTS (SELECT 1 FROM "MapaOrigemMatriculaMigracao" m WHERE m.origem=NEW.origem AND m."matriculaOrigemId"=(SELECT "matriculaOrigemId" FROM "LinhaPreparacaoMigracao" WHERE id=NEW."linhaId") AND m."matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Fonte, cobrança, pagador e contrato M01 devem corresponder'; END IF;
 IF NEW.modalidade='VINCULAR_RECEBIMENTO' THEN
   SELECT r.*,d.id AS "destinacaoId",d.valor AS "valorDestinacao",d."cobrancaId" AS "cobrancaDestinacao" INTO receb FROM "Recebimento" r LEFT JOIN "DestinacaoRecebimento" d ON d."recebimentoId"=r.id AND d."cobrancaId"=NEW."cobrancaId" WHERE r.id=NEW."recebimentoExistenteId";
   IF NOT FOUND OR receb."titularMatriculaId" IS DISTINCT FROM NEW."matriculaId" OR (receb."pagadorId" IS NOT NULL AND receb."pagadorId" IS DISTINCT FROM NEW."pagadorId") OR receb."cobrancaDestinacao" IS DISTINCT FROM NEW."cobrancaId" OR receb."valorDestinacao" IS DISTINCT FROM NEW.valor OR receb.moeda IS DISTINCT FROM NEW.moeda OR (receb."dataPagamento" AT TIME ZONE 'UTC') IS DISTINCT FROM NEW."dataPagamento" OR receb.forma IS DISTINCT FROM NEW.forma THEN RAISE EXCEPTION 'Recebimento e destinação não correspondem à conciliação fotografada'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status='PENDENTE' AND NEW.status='APROVADA' THEN
   IF NOT EXISTS (SELECT 1 FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" WHERE l.id=NEW."linhaId" AND NEW.snapshot->'linha' IS NOT DISTINCT FROM jsonb_build_object('id',l.id,'origem',lo.origem,'financeiroOrigemId',l."financeiroOrigemId",'matriculaOrigemId',l."matriculaOrigemId",'entradaHash',l."entradaHash",'dadosOrigem',l."dadosOrigem",'loteId',l."loteId")) THEN RAISE EXCEPTION 'Fotografia da linha financeira mudou; prepare nova conciliação'; END IF;
   IF NOT EXISTS (SELECT 1 FROM "MapaOrigemMatriculaMigracao" m WHERE m.origem=NEW.origem AND m."matriculaId"=NEW."matriculaId" AND NEW.snapshot->'mapa' IS NOT DISTINCT FROM jsonb_build_object('origem',m.origem,'matriculaOrigemId',m."matriculaOrigemId",'matriculaId',m."matriculaId",'linhaId',m."linhaId",'entradaHash',m."entradaHash")) THEN RAISE EXCEPTION 'Fotografia do mapa M01 mudou; prepare nova conciliação'; END IF;
   IF NOT EXISTS (SELECT 1 FROM "Cobranca" c WHERE c.id=NEW."cobrancaId" AND NEW.snapshot->'cobranca'->>'id'=c.id AND NEW.snapshot->'cobranca'->>'matriculaId'=c."matriculaId" AND NEW.snapshot->'cobranca'->>'status'=c.status::text AND NEW.snapshot->'cobranca'->>'moeda'=c.moeda AND NEW.snapshot->'cobranca'->>'versao'=c.versao::text AND (NEW.snapshot->'cobranca'->>'valorOriginal')::numeric=c."valorOriginal" AND (NEW.snapshot->'cobranca'->>'valorNegociado')::numeric=c."valorNegociado" AND (NEW.snapshot->'cobranca'->>'valorRecebido')::numeric IS NOT DISTINCT FROM c."valorRecebido" AND (NEW.snapshot->'cobranca'->>'saldo')::numeric IS NOT DISTINCT FROM c.saldo AND (NEW.snapshot->'cobranca'->>'valorLiquidadoCredito')::numeric IS NOT DISTINCT FROM c."valorLiquidadoCredito" AND (NEW.snapshot->'cobranca'->>'pagoEm') IS NOT DISTINCT FROM CASE WHEN c."pagoEm" IS NULL THEN NULL ELSE to_char(c."pagoEm",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AND (NEW.snapshot->'cobranca'->>'formaPagamento') IS NOT DISTINCT FROM c."formaPagamento"::text AND (NEW.snapshot->'cobranca'->>'comprovanteUrl') IS NOT DISTINCT FROM c."comprovanteUrl" AND (NEW.snapshot->'cobranca'->>'comprovanteNome') IS NOT DISTINCT FROM c."comprovanteNome" AND (NEW.snapshot->'cobranca'->>'comentario') IS NOT DISTINCT FROM c.comentario AND (NEW.snapshot->'cobranca'->>'vencimento')=to_char(c.vencimento,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) THEN RAISE EXCEPTION 'Fotografia da cobrança mudou; prepare nova conciliação'; END IF;
   IF NOT EXISTS (SELECT 1 FROM "PagadorPreparacaoMatricula" p WHERE p.id=NEW."pagadorId" AND NEW.snapshot->'pagador' IS NOT DISTINCT FROM jsonb_build_object('id',p.id,'matriculaId',p."matriculaId",'versao',p.versao,'tipo',p.tipo,'dados',p.dados)) THEN RAISE EXCEPTION 'Fotografia do pagador mudou; prepare nova conciliação'; END IF;
   IF NEW.modalidade='VINCULAR_RECEBIMENTO' AND NOT EXISTS (SELECT 1 FROM "Recebimento" r JOIN "DestinacaoRecebimento" d ON d."recebimentoId"=r.id AND d."cobrancaId"=NEW."cobrancaId" WHERE r.id=NEW."recebimentoExistenteId" AND r."titularMatriculaId"=NEW."matriculaId" AND (r."pagadorId" IS NULL OR r."pagadorId"=NEW."pagadorId") AND NEW.snapshot->'recebimento'->>'id'=r.id AND (NEW.snapshot->'recebimento'->>'valor')::numeric=r.valor AND NEW.snapshot->'recebimento'->>'moeda'=r.moeda AND NEW.snapshot->'recebimento'->>'forma'=r.forma::text AND (NEW.snapshot->'recebimento'->>'dataPagamento')=to_char(r."dataPagamento",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AND (NEW.snapshot->'recebimento'->>'hashDados') IS NOT DISTINCT FROM r."hashDados" AND (NEW.snapshot->'recebimento'->>'chaveIdempotencia')=r."chaveIdempotencia" AND (NEW.snapshot->'recebimento'->>'autorId')=r."autorId" AND ((NEW.snapshot->'recebimento'->>'cobrancaId'=r."cobrancaId") OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'recebimento'->'destinacoes') sd WHERE sd->>'id'=d.id AND sd->>'cobrancaId'=d."cobrancaId" AND sd->>'tipo'=d.tipo::text AND (sd->>'valor')::numeric=d.valor AND sd->>'evidencia' IS NOT DISTINCT FROM d.evidencia AND sd->>'chaveIdempotencia'=d."chaveIdempotencia"))) THEN RAISE EXCEPTION 'Fotografia do recebimento ERP mudou; prepare nova conciliação'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "impedir_emissao_continuidade_com_destinacao_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "DestinacaoRecebimento" d WHERE d."cobrancaId"=NEW."cobrancaId") THEN RAISE EXCEPTION 'Ledger de continuidade mensal inválido.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "z_emissao_continuidade_destinacao_fin04_211" BEFORE INSERT ON "EmissaoContinuidadeMensal" FOR EACH ROW EXECUTE FUNCTION "impedir_emissao_continuidade_com_destinacao_fin04_211"();

CREATE OR REPLACE FUNCTION "impedir_decisao_desistencia_com_destinacao_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pedido record;
BEGIN
 IF TG_OP='INSERT' AND NEW.aprovada THEN
   SELECT * INTO pedido FROM "PedidoDesistenciaPreparacao" WHERE id=NEW."pedidoId";
   IF EXISTS (SELECT 1 FROM "DestinacaoRecebimento" d JOIN "Cobranca" c ON c.id=d."cobrancaId" WHERE c."matriculaId"=pedido."matriculaId") THEN RAISE EXCEPTION 'Aprovação administrativa exige tratamento financeiro específico para destinação de recebimento.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "A_decisao_desistencia_destinacao_fin04_211" BEFORE INSERT ON "DecisaoAdministrativaDesistencia" FOR EACH ROW EXECUTE FUNCTION "impedir_decisao_desistencia_com_destinacao_fin04_211"();

COMMIT;
