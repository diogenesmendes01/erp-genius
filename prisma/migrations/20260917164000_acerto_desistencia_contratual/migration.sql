BEGIN;

CREATE TABLE "PropostaAcertoDesistenciaContratual" (
 id TEXT PRIMARY KEY,"pedidoId" TEXT NOT NULL REFERENCES "PedidoDesistenciaPreparacao"(id) ON DELETE RESTRICT,"condicoesId" TEXT NOT NULL REFERENCES "CondicoesEncerramentoMatricula"(id) ON DELETE RESTRICT,"preparadorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
 "estadoHash" TEXT NOT NULL CHECK("estadoHash"~'^[a-f0-9]{64}$'),"condicoesHash" TEXT NOT NULL CHECK("condicoesHash"~'^[a-f0-9]{64}$'),"fotografiaHash" TEXT NOT NULL CHECK("fotografiaHash"~'^[a-f0-9]{64}$'),memoria JSONB NOT NULL CHECK(jsonb_typeof(memoria)='object'),"chaveIdempotencia" TEXT NOT NULL CHECK(length(btrim("chaveIdempotencia")) BETWEEN 8 AND 100),"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 UNIQUE("preparadorId","chaveIdempotencia"),UNIQUE("pedidoId","condicoesId","fotografiaHash"));
CREATE INDEX "PropostaAcertoDesistenciaContratual_pedidoId_idx" ON "PropostaAcertoDesistenciaContratual"("pedidoId");
CREATE INDEX "PropostaAcertoDesistenciaContratual_condicoesId_criadaEm_idx" ON "PropostaAcertoDesistenciaContratual"("condicoesId","criadaEm");
CREATE TABLE "DecisaoAcertoDesistenciaContratual" (
 id TEXT PRIMARY KEY,"propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaAcertoDesistenciaContratual"(id) ON DELETE RESTRICT,"decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,aprovada BOOLEAN NOT NULL,motivo TEXT NOT NULL CHECK(length(btrim(motivo)) BETWEEN 5 AND 3000),"condicoesHash" TEXT NOT NULL CHECK("condicoesHash"~'^[a-f0-9]{64}$'),"fotografiaHash" TEXT NOT NULL CHECK("fotografiaHash"~'^[a-f0-9]{64}$'),"chaveIdempotencia" TEXT NOT NULL CHECK(length(btrim("chaveIdempotencia")) BETWEEN 8 AND 100),"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),UNIQUE("decisorId","chaveIdempotencia"));
CREATE TABLE "AplicacaoAcertoDesistenciaContratual" (
 id TEXT PRIMARY KEY,"decisaoId" TEXT NOT NULL UNIQUE REFERENCES "DecisaoAcertoDesistenciaContratual"(id) ON DELETE RESTRICT,"executorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,memoria JSONB NOT NULL CHECK(jsonb_typeof(memoria)='object'),"condicoesHash" TEXT NOT NULL CHECK("condicoesHash"~'^[a-f0-9]{64}$'),"fotografiaHash" TEXT NOT NULL CHECK("fotografiaHash"~'^[a-f0-9]{64}$'),"chaveIdempotencia" TEXT NOT NULL CHECK(length(btrim("chaveIdempotencia")) BETWEEN 8 AND 100),"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),UNIQUE("executorId","chaveIdempotencia"));
CREATE TABLE "OrigemCreditoAcertoDesistenciaContratual" (id TEXT PRIMARY KEY,"aplicacaoId" TEXT NOT NULL REFERENCES "AplicacaoAcertoDesistenciaContratual"(id) ON DELETE RESTRICT,"matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT,"cobrancaId" TEXT NOT NULL REFERENCES "Cobranca"(id) ON DELETE RESTRICT,valor DECIMAL(12,2) NOT NULL CHECK(valor>0),moeda TEXT NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),UNIQUE("aplicacaoId","cobrancaId"));
CREATE INDEX "OrigemCreditoAcertoDesistenciaContratual_cobrancaId_idx" ON "OrigemCreditoAcertoDesistenciaContratual"("cobrancaId");
ALTER TABLE "EfetivacaoPedidoDesistenciaPreparacao" ADD COLUMN "aplicacaoAcertoDesistenciaContratualId" TEXT UNIQUE REFERENCES "AplicacaoAcertoDesistenciaContratual"(id) ON DELETE RESTRICT;
ALTER TABLE "CreditoMatricula" ADD COLUMN "origemAcertoDesistenciaContratualId" TEXT UNIQUE REFERENCES "OrigemCreditoAcertoDesistenciaContratual"(id) ON DELETE RESTRICT;
ALTER TABLE "CreditoMatricula" DROP CONSTRAINT "credito_matricula_origem_unica_check";
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "credito_matricula_origem_unica_check" CHECK(num_nonnulls("origemLiberacaoId","origemAcertoId","origemPeriodoIntegralId","origemDestinacaoRecebimentoId","origemAcertoTaxaAditivoId","origemAcertoDesistenciaContratualId")=1);

CREATE FUNCTION q165_autorizado(usuario_id TEXT, aprovar BOOLEAN) RETURNS VOID LANGUAGE plpgsql AS $$ DECLARE u RECORD; BEGIN SELECT ativo,papeis,permissoes INTO u FROM "Usuario" WHERE id=usuario_id FOR SHARE; IF NOT FOUND OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND (NOT aprovar OR 'financeiro.aprovar_acertos'=ANY(u.permissoes)))) THEN RAISE EXCEPTION 'Alçada financeira atual insuficiente'; END IF; END $$;
CREATE FUNCTION q165_regra_valida(r JSONB) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_typeof(r->'acertoDesistenciaPreparacao')='object' AND r->'acertoDesistenciaPreparacao' ?& ARRAY['tipo','clausulaId','condicoesAplicacao'] AND r->'acertoDesistenciaPreparacao'->>'tipo' IN ('VALOR_FIXO','PERCENTUAL_VALOR_NEGOCIADO') AND jsonb_typeof(r->'acertoDesistenciaPreparacao'->'condicoesAplicacao')='object' AND r->'acertoDesistenciaPreparacao'->'condicoesAplicacao'->>'momento'='ANTES_ATIVACAO' AND r->'acertoDesistenciaPreparacao'->'condicoesAplicacao'->>'unidade' IN ('POR_COBRANCA','TOTAL_CONTRATACAO') AND ((r->'acertoDesistenciaPreparacao'->>'tipo'='VALOR_FIXO' AND r->'acertoDesistenciaPreparacao'->>'valor' ~ '^\d+(\.\d{1,2})?$') OR (r->'acertoDesistenciaPreparacao'->>'tipo'='PERCENTUAL_VALOR_NEGOCIADO' AND r->'acertoDesistenciaPreparacao'->>'percentual' ~ '^\d+(\.\d{1,2})?$')) $$;

-- Q165: reproduz a fotografia de fotografiaQ165/carregarFinanceiroDesistenciaTx.
-- JSONB torna a comparação de objetos independente da ordem das chaves; as
-- coleções são ordenadas pelo mesmo id usado pelo carregador Node.
CREATE FUNCTION q165_fotografia_atual(proposta_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; financeiro JSONB; credito_ja_apurado JSONB; foto JSONB;
BEGIN
 SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=proposta_id FOR SHARE;
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR SHARE;
 SELECT jsonb_build_object('matriculaId',pe."matriculaId",'cobrancas',coalesce(jsonb_agg(c.fotografia ORDER BY c.id),'[]'::jsonb),'creditos',coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',cr.id,'origemLiberacaoId',cr."origemLiberacaoId",'origemAcertoId',cr."origemAcertoId",'origemPeriodoIntegralId',cr."origemPeriodoIntegralId",'origemDestinacaoRecebimentoId',cr."origemDestinacaoRecebimentoId",'valorInicial',to_char(cr."valorInicial",'FM999999999999999999990.00'),'moeda',cr.moeda,'criadoEm',to_char(cr."criadoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY cr.id)
   FROM "CreditoMatricula" cr WHERE cr."matriculaId"=pe."matriculaId"
 ),'[]'::jsonb)) INTO financeiro
 FROM (
   SELECT c.id,
    jsonb_build_object(
      'id',c.id,'versao',c.versao,'tipo',c.tipo,'status',c.status,'moeda',c.moeda,
      'vencimento',to_char(c.vencimento AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'coberturaInicio',CASE WHEN c."coberturaInicio" IS NULL THEN NULL ELSE to_char(c."coberturaInicio" AT TIME ZONE 'UTC','YYYY-MM-DD') END,
      'coberturaFim',CASE WHEN c."coberturaFim" IS NULL THEN NULL ELSE to_char(c."coberturaFim" AT TIME ZONE 'UTC','YYYY-MM-DD') END,
      'valorOriginal',to_char(c."valorOriginal",'FM999999999999999999990.00'),
      'valorNegociado',to_char(c."valorNegociado",'FM999999999999999999990.00'),
      'valorRecebido',CASE WHEN c."valorRecebido" IS NULL THEN NULL ELSE to_char(c."valorRecebido",'FM999999999999999999990.00') END,
      'valorLiquidadoCredito',to_char(c."valorLiquidadoCredito",'FM999999999999999999990.00'),
      'saldo',CASE WHEN c.saldo IS NULL THEN NULL ELSE to_char(c.saldo,'FM999999999999999999990.00') END,
      'pagoEm',CASE WHEN c."pagoEm" IS NULL THEN NULL ELSE to_char(c."pagoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'fontes',jsonb_build_object(
        'emissaoEntrada',(SELECT jsonb_build_object('itemId',ie.id,'emissaoId',ie."emissaoId",'etapa',ee.etapa,'condicoesId',ee."condicoesId",'criadaEm',to_char(ee."criadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "ItemEmissaoEntrada" ie JOIN "EmissaoCobrancasEntrada" ee ON ee.id=ie."emissaoId" WHERE ie."cobrancaId"=c.id ORDER BY ie.id LIMIT 1),
        'suspensaPorItemPausaId',c."suspensaPorItemPausaId",'canceladaPorPausaId',c."canceladaPorPausaId",
        'ajusteAcerto',(SELECT jsonb_build_object('id',a.id,'decisaoId',a."decisaoId",'valorNovo',to_char(a."valorNovo",'FM999999999999999999990.00'),'criadoEm',to_char(a."criadoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId"=c.id ORDER BY a.id LIMIT 1),
        'emissaoFechamentoHoras',(SELECT jsonb_build_object('id',eh.id,'decisaoId',eh."decisaoId",'criadaEm',to_char(eh."criadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "EmissaoFechamentoHoras" eh WHERE eh."cobrancaId"=c.id ORDER BY eh.id LIMIT 1),
        'acertoMultaDecisaoId',c."acertoMultaDecisaoId"
      ),
      'informes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'status',i.status,'versao',i.versao,'valor',to_char(i.valor,'FM999999999999999999990.00'),'moeda',i.moeda,'dataPagamento',to_char(i."dataPagamento" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY i.id) FROM "PagamentoInformado" i WHERE i."cobrancaId"=c.id),'[]'::jsonb),
      'recebimentos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',dr.id,'recebimentoId',dr."recebimentoId",'valor',to_char(dr.valor,'FM999999999999999999990.00'),'moeda',r.moeda,'dataPagamento',to_char(r."dataPagamento" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY dr.id) FROM "DestinacaoRecebimento" dr JOIN "Recebimento" r ON r.id=dr."recebimentoId" WHERE dr."cobrancaId"=c.id),'[]'::jsonb),
      'utilizacoesCredito',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'creditoId',u."creditoId",'versao',u.versao,'valor',to_char(u.valor,'FM999999999999999999990.00'),'decisao',CASE WHEN du.id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object('id',du.id,'aprovada',du.aprovada,'decididaEm',to_char(du."decididaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END) ORDER BY u.id) FROM "PropostaUsoCredito" u LEFT JOIN "DecisaoUsoCredito" du ON du."propostaId"=u.id WHERE u."cobrancaId"=c.id),'[]'::jsonb),
      'compensacoes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',cc.id,'status',cc.status,'cobrancaVersao',cc."cobrancaVersao",'decididaEm',CASE WHEN cc."decididaEm" IS NULL THEN NULL ELSE to_char(cc."decididaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,'dias',coalesce((SELECT jsonb_agg(jsonb_build_object('id',dc.id,'estado',dc.estado,'versao',dc.versao) ORDER BY dc.id) FROM "DiaCompensacaoCobertura" dc WHERE dc."compensacaoId"=cc.id),'[]'::jsonb)) ORDER BY cc.id) FROM "CompensacaoCoberturaMatricula" cc WHERE cc."cobrancaOrigemId"=c.id),'[]'::jsonb)
    ) || CASE WHEN c."valorCompensadoPermuta">0 THEN jsonb_build_object('valorCompensadoPermuta',to_char(c."valorCompensadoPermuta",'FM999999999999999999990.00')) ELSE '{}'::jsonb END AS fotografia
   FROM "Cobranca" c WHERE c."matriculaId"=pe."matriculaId"
 ) c;
 SELECT coalesce(jsonb_object_agg(o."cobrancaId",to_char(o.valor,'FM999999999999999999990.00')),'{}'::jsonb) INTO credito_ja_apurado
 FROM (
   SELECT origem."cobrancaId",sum(origem.valor) AS valor FROM (
     SELECT taxa."cobrancaId",taxa.valor FROM "OrigemCreditoAcertoTaxaAditivo" taxa JOIN "Cobranca" cobranca_taxa ON cobranca_taxa.id=taxa."cobrancaId" WHERE cobranca_taxa."matriculaId"=pe."matriculaId"
     UNION ALL
     SELECT desist."cobrancaId",desist.valor FROM "OrigemCreditoAcertoDesistenciaContratual" desist WHERE desist."matriculaId"=pe."matriculaId"
   ) origem GROUP BY origem."cobrancaId"
 ) o;
 foto:=jsonb_build_object('financeiro',financeiro,'creditoJaApurado',credito_ja_apurado);
 IF p.memoria->'fotografia' IS DISTINCT FROM foto THEN RAISE EXCEPTION 'Fotografia financeira vigente diverge da proposta'; END IF;
END $$;

-- Replica a matemática do calculador Node, inclusive o rateio pelo maior
-- resíduo e desempate pelo id da cobrança.
CREATE FUNCTION q165_devido(regras JSONB, matricula_id TEXT, cobranca_id TEXT) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE regra JSONB:=regras->'acertoDesistenciaPreparacao'; cond JSONB:=regra->'condicoesAplicacao'; alcance JSONB:=cond->'alcance'; cobranca RECORD; total_contratacao NUMERIC; total_devido NUMERIC; centavos INTEGER; devido NUMERIC;
BEGIN
 SELECT id,tipo,"valorNegociado" INTO cobranca FROM "Cobranca" WHERE id=cobranca_id AND "matriculaId"=matricula_id;
 IF cobranca.id IS NULL OR jsonb_typeof(regra) IS DISTINCT FROM 'object' OR jsonb_typeof(cond) IS DISTINCT FROM 'object' OR coalesce(length(btrim(regra->>'clausulaId')),0)=0 THEN RAISE EXCEPTION 'Regra contratual de acerto inválida'; END IF;
 IF regra->>'tipo'='VALOR_FIXO' AND regra->>'valor' ~ '^\d+(\.\d{1,2})?$' THEN
   total_devido:=round((regra->>'valor')::numeric,2);
 ELSIF regra->>'tipo'='PERCENTUAL_VALOR_NEGOCIADO' AND regra->>'percentual' ~ '^\d+(\.\d{1,2})?$' THEN
   total_devido:=NULL;
 ELSE RAISE EXCEPTION 'Fórmula contratual de acerto inválida'; END IF;
 IF cond->>'momento' IS DISTINCT FROM 'ANTES_ATIVACAO' THEN RAISE EXCEPTION 'Momento contratual de acerto inválido'; END IF;
 IF cond->>'unidade'='POR_COBRANCA' THEN
   IF jsonb_typeof(alcance) IS DISTINCT FROM 'object' OR (
     (alcance->>'tipo'='TODAS_COBRANCAS_MATRICULA' AND (SELECT count(*) FROM jsonb_object_keys(alcance))=1)
     OR (alcance->>'tipo'='TIPOS_COBRANCA' AND jsonb_typeof(alcance->'tipos')='array' AND jsonb_array_length(alcance->'tipos')>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(alcance->'tipos') t WHERE t NOT IN ('MULTA_ENCERRAMENTO','MATRICULA','MENSALIDADE','HORA_PARTICULAR','MATERIAL','CERTIFICADO')))
     OR (alcance->>'tipo'='COBRANCAS_IDENTIFICADAS' AND jsonb_typeof(alcance->'cobrancaIds')='array' AND jsonb_array_length(alcance->'cobrancaIds')>0 AND jsonb_array_length(alcance->'cobrancaIds')=(SELECT count(DISTINCT x) FROM jsonb_array_elements_text(alcance->'cobrancaIds') x))
   ) IS NOT TRUE THEN RAISE EXCEPTION 'Alcance contratual de acerto inválido'; END IF;
   IF (alcance->>'tipo'='TODAS_COBRANCAS_MATRICULA' OR (alcance->>'tipo'='TIPOS_COBRANCA' AND alcance->'tipos' ? cobranca.tipo::text) OR (alcance->>'tipo'='COBRANCAS_IDENTIFICADAS' AND alcance->'cobrancaIds' ? cobranca.id)) IS NOT TRUE THEN RAISE EXCEPTION 'Cobrança fora do alcance contratual do acerto'; END IF;
   IF total_devido IS NULL THEN total_devido:=round(cobranca."valorNegociado"*(regra->>'percentual')::numeric/100,2); END IF;
   RETURN total_devido;
 END IF;
 IF cond->>'unidade' IS DISTINCT FROM 'TOTAL_CONTRATACAO' OR jsonb_typeof(cond->'cobrancaIds') IS DISTINCT FROM 'array' OR jsonb_typeof(cond->'rateio') IS DISTINCT FROM 'array' OR jsonb_array_length(cond->'cobrancaIds')=0 OR jsonb_array_length(cond->'rateio')<>jsonb_array_length(cond->'cobrancaIds') OR jsonb_array_length(cond->'cobrancaIds')<>(SELECT count(DISTINCT x) FROM jsonb_array_elements_text(cond->'cobrancaIds') x) OR EXISTS(SELECT 1 FROM jsonb_array_elements(cond->'rateio') e WHERE jsonb_typeof(e) IS DISTINCT FROM 'object' OR (e ?& ARRAY['cobrancaId','percentual']) IS NOT TRUE OR (e->>'percentual' ~ '^\d+(\.\d{1,2})?$') IS NOT TRUE) OR (SELECT count(DISTINCT e->>'cobrancaId') FROM jsonb_array_elements(cond->'rateio') e)<>jsonb_array_length(cond->'rateio') OR EXISTS(SELECT 1 FROM jsonb_array_elements(cond->'rateio') e WHERE (cond->'cobrancaIds' ? (e->>'cobrancaId')) IS NOT TRUE) OR (SELECT coalesce(sum((e->>'percentual')::numeric),-1) FROM jsonb_array_elements(cond->'rateio') e)<>100 THEN RAISE EXCEPTION 'Conjunto ou rateio contratual de acerto inválido'; END IF;
 IF (SELECT count(*) FROM "Cobranca" WHERE "matriculaId"=matricula_id)<>jsonb_array_length(cond->'cobrancaIds') OR EXISTS(SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND NOT (cond->'cobrancaIds' ? c.id)) OR NOT (cond->'cobrancaIds' ? cobranca.id) THEN RAISE EXCEPTION 'O conjunto de cobranças diverge do alcance contratual aprovado'; END IF;
 SELECT coalesce(sum("valorNegociado"),0) INTO total_contratacao FROM "Cobranca" WHERE "matriculaId"=matricula_id;
 IF total_devido IS NULL THEN total_devido:=round(total_contratacao*(regra->>'percentual')::numeric/100,2); END IF;
 WITH quotas AS (
   SELECT e->>'cobrancaId' AS id, (e->>'percentual')::numeric AS percentual, trunc(total_devido*(e->>'percentual')::numeric/100,2) AS base, total_devido*(e->>'percentual')::numeric/100-trunc(total_devido*(e->>'percentual')::numeric/100,2) AS resto
   FROM jsonb_array_elements(cond->'rateio') e
 ), resto AS (
   SELECT round((total_devido-coalesce(sum(base),0))*100)::integer AS quantidade FROM quotas
 ), ordenadas AS (
   SELECT id,row_number() OVER (ORDER BY resto DESC,id) AS posicao FROM quotas WHERE percentual>0
 )
 SELECT q.base+CASE WHEN o.posicao<=(SELECT quantidade FROM resto) THEN 0.01 ELSE 0 END INTO devido FROM quotas q LEFT JOIN ordenadas o ON o.id=q.id WHERE q.id=cobranca_id;
 IF devido IS NULL THEN RAISE EXCEPTION 'Rateio contratual não contém a cobrança'; END IF;
 RETURN devido;
END $$;

CREATE FUNCTION q165_contexto(proposta_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$ DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; c "CondicoesEncerramentoMatricula"%ROWTYPE; m "Matricula"%ROWTYPE; d "Documento"%ROWTYPE; BEGIN SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=proposta_id FOR UPDATE; SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR UPDATE; SELECT * INTO c FROM "CondicoesEncerramentoMatricula" WHERE id=p."condicoesId" FOR SHARE; SELECT * INTO m FROM "Matricula" WHERE id=pe."matriculaId" FOR UPDATE; SELECT * INTO d FROM "Documento" WHERE id=c."documentoId" FOR SHARE; PERFORM id FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE; IF p.id IS NULL OR pe.id IS NULL OR c.id IS NULL OR m.id IS NULL OR d.id IS NULL OR p."estadoHash" IS DISTINCT FROM pe."estadoHash" OR c."matriculaId" IS DISTINCT FROM pe."matriculaId" OR c.status<>'APROVADA' OR NOT q165_regra_valida(c.regras) OR c."documentoId" IS DISTINCT FROM m."contratoDocumentoId" OR d."matriculaId" IS DISTINCT FROM m.id OR d.arquivado OR NOT m."contratoOk" OR m."confirmacaoContratoEm" IS NULL OR m."confirmacaoContratoPorId" IS NULL OR EXISTS(SELECT 1 FROM "CondicoesEncerramentoMatricula" x WHERE x."matriculaId"=c."matriculaId" AND x.versao>c.versao) OR m.status NOT IN ('RASCUNHO','AGUARDANDO') OR m."ativadaEm" IS NOT NULL OR EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=pe."matriculaId" AND x.versao>pe.versao) OR EXISTS(SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" x WHERE x."matriculaId"=pe."matriculaId") THEN RAISE EXCEPTION 'Pedido, contrato ou matrícula não correspondem ao acerto'; END IF; PERFORM q165_fotografia_atual(p.id); IF EXISTS(SELECT 1 FROM "Cobranca" x WHERE x."matriculaId"=pe."matriculaId" AND coalesce(x."valorCompensadoPermuta",0)<>0) THEN RAISE EXCEPTION 'Permuta exige destinação negociada própria'; END IF; END $$;
CREATE FUNCTION q165_memoria(proposta_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; c "CondicoesEncerramentoMatricula"%ROWTYPE; cobranca RECORD; item JSONB; credito_anterior NUMERIC; liquidacao_liquida NUMERIC; devido NUMERIC; saldo_devido NUMERIC; credito_apurado NUMERIC;
BEGIN
 SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=proposta_id FOR SHARE;
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId";
 SELECT * INTO c FROM "CondicoesEncerramentoMatricula" WHERE id=p."condicoesId";
 IF p.memoria->>'pedidoId' IS DISTINCT FROM p."pedidoId" OR p.memoria->>'matriculaId' IS DISTINCT FROM pe."matriculaId" OR p.memoria->>'condicoesId' IS DISTINCT FROM p."condicoesId" OR p.memoria->>'estadoHash' IS DISTINCT FROM p."estadoHash" OR p.memoria->>'condicoesHash' IS DISTINCT FROM p."condicoesHash" OR p.memoria->>'fotografiaHash' IS DISTINCT FROM p."fotografiaHash" OR p.memoria->'regras' IS DISTINCT FROM c.regras OR jsonb_typeof(p.memoria->'fotografia') IS DISTINCT FROM 'object' OR jsonb_typeof(p.memoria->'fotografia'->'creditoJaApurado') IS DISTINCT FROM 'object' OR jsonb_typeof(p.memoria->'itens') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Memória não corresponde ao pedido, contrato e hashes'; END IF;
 IF jsonb_array_length(p.memoria->'itens')<>(SELECT count(*) FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId") OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.memoria->'itens') x WHERE jsonb_typeof(x) IS DISTINCT FROM 'object' OR CASE WHEN jsonb_typeof(x)='object' THEN (SELECT count(*) FROM jsonb_object_keys(x)) ELSE -1 END<>6 OR (x ?& ARRAY['cobrancaId','moeda','devido','saldoDevido','creditoApurado','creditoJaApurado']) IS NOT TRUE OR x->>'cobrancaId' IS NULL OR x->>'moeda' IS NULL OR (x->>'devido' ~ '^\d+\.\d{2}$') IS NOT TRUE OR (x->>'saldoDevido' ~ '^\d+\.\d{2}$') IS NOT TRUE OR (x->>'creditoApurado' ~ '^\d+\.\d{2}$') IS NOT TRUE OR (x->>'creditoJaApurado' ~ '^\d+\.\d{2}$') IS NOT TRUE) OR (SELECT count(DISTINCT x->>'cobrancaId') FROM jsonb_array_elements(p.memoria->'itens') x)<>jsonb_array_length(p.memoria->'itens') OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.memoria->'itens') x WHERE NOT EXISTS(SELECT 1 FROM "Cobranca" cb WHERE cb."matriculaId"=pe."matriculaId" AND cb.id=x->>'cobrancaId')) THEN RAISE EXCEPTION 'Itens do acerto não correspondem às cobranças vigentes'; END IF;
 FOR cobranca IN SELECT id,moeda,"valorRecebido","valorLiquidadoCredito" FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id LOOP
   SELECT x INTO item FROM jsonb_array_elements(p.memoria->'itens') x WHERE x->>'cobrancaId'=cobranca.id;
   IF p.memoria->'fotografia'->'creditoJaApurado' ? cobranca.id AND (p.memoria->'fotografia'->'creditoJaApurado'->>cobranca.id ~ '^\d+\.\d{2}$') IS NOT TRUE THEN RAISE EXCEPTION 'Crédito anterior da fotografia é inválido'; END IF;
   credito_anterior:=coalesce((p.memoria->'fotografia'->'creditoJaApurado'->>cobranca.id)::numeric,0);
   liquidacao_liquida:=coalesce(cobranca."valorRecebido",0)+cobranca."valorLiquidadoCredito"-credito_anterior;
   IF credito_anterior<0 OR credito_anterior>coalesce(cobranca."valorRecebido",0)+cobranca."valorLiquidadoCredito" THEN RAISE EXCEPTION 'Crédito anterior excede a liquidação original'; END IF;
   devido:=q165_devido(c.regras,pe."matriculaId",cobranca.id);
   saldo_devido:=round(greatest(devido-liquidacao_liquida,0),2);
   credito_apurado:=round(greatest(liquidacao_liquida-devido,0),2);
   IF item->>'moeda' IS DISTINCT FROM cobranca.moeda OR (item->>'devido')::numeric IS DISTINCT FROM devido OR (item->>'saldoDevido')::numeric IS DISTINCT FROM saldo_devido OR (item->>'creditoApurado')::numeric IS DISTINCT FROM credito_apurado OR (item->>'creditoJaApurado')::numeric IS DISTINCT FROM credito_anterior THEN RAISE EXCEPTION 'Valores do acerto não correspondem à regra contratual'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION q165_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$ DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; d "DecisaoAcertoDesistenciaContratual"%ROWTYPE; BEGIN IF TG_TABLE_NAME='PropostaAcertoDesistenciaContratual' THEN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta é imutável'; END IF; PERFORM q165_autorizado(NEW."preparadorId",false); PERFORM q165_contexto(NEW.id); PERFORM q165_memoria(NEW.id); RETURN NEW; END IF; IF TG_TABLE_NAME='DecisaoAcertoDesistenciaContratual' THEN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão é imutável'; END IF; SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=NEW."propostaId" FOR UPDATE; IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" THEN RAISE EXCEPTION 'Decisão não corresponde à proposta independente'; END IF; PERFORM q165_autorizado(NEW."decisorId",true); IF NEW.aprovada THEN PERFORM q165_contexto(p.id); PERFORM q165_memoria(p.id); END IF; RETURN NEW; END IF; IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação é imutável'; END IF; SELECT * INTO d FROM "DecisaoAcertoDesistenciaContratual" WHERE id=NEW."decisaoId" FOR SHARE; SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=d."propostaId" FOR UPDATE; IF d.id IS NULL OR p.id IS NULL OR NOT d.aprovada OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR NEW.memoria IS DISTINCT FROM p.memoria THEN RAISE EXCEPTION 'Aplicação exige decisão aprovada e memória correspondente'; END IF; PERFORM q165_autorizado(NEW."executorId",true); PERFORM q165_contexto(p.id); PERFORM q165_memoria(p.id); RETURN NEW; END $$;
CREATE TRIGGER "PropostaAcertoDesistenciaContratual_validar" AFTER INSERT ON "PropostaAcertoDesistenciaContratual" FOR EACH ROW EXECUTE FUNCTION q165_guard();
CREATE TRIGGER "PropostaAcertoDesistenciaContratual_imutavel" BEFORE UPDATE OR DELETE ON "PropostaAcertoDesistenciaContratual" FOR EACH ROW EXECUTE FUNCTION q165_guard();
CREATE TRIGGER "DecisaoAcertoDesistenciaContratual_guard" BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAcertoDesistenciaContratual" FOR EACH ROW EXECUTE FUNCTION q165_guard();
CREATE TRIGGER "AplicacaoAcertoDesistenciaContratual_guard" BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoAcertoDesistenciaContratual" FOR EACH ROW EXECUTE FUNCTION q165_guard();
CREATE FUNCTION q165_origem_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$ DECLARE a "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; i JSONB; BEGIN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Origem de crédito é imutável'; END IF; SELECT * INTO a FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=NEW."aplicacaoId" FOR SHARE; SELECT x INTO i FROM jsonb_array_elements(a.memoria->'itens') x WHERE x->>'cobrancaId'=NEW."cobrancaId"; IF a.id IS NULL OR i IS NULL OR NEW."matriculaId" IS DISTINCT FROM a.memoria->>'matriculaId' OR NEW.valor IS DISTINCT FROM (i->>'creditoApurado')::numeric OR NEW.valor<=0 OR NEW.moeda IS DISTINCT FROM i->>'moeda' THEN RAISE EXCEPTION 'Crédito diverge do excedente apurado'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "OrigemCreditoAcertoDesistenciaContratual_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrigemCreditoAcertoDesistenciaContratual" FOR EACH ROW EXECUTE FUNCTION q165_origem_guard();
CREATE FUNCTION q165_credito_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$ DECLARE o "OrigemCreditoAcertoDesistenciaContratual"%ROWTYPE; BEGIN SELECT * INTO o FROM "OrigemCreditoAcertoDesistenciaContratual" WHERE id=NEW."origemAcertoDesistenciaContratualId" FOR SHARE; IF o.id IS NULL OR NEW."matriculaId" IS DISTINCT FROM o."matriculaId" OR NEW.moeda IS DISTINCT FROM o.moeda OR NEW."valorInicial" IS DISTINCT FROM o.valor THEN RAISE EXCEPTION 'Crédito não corresponde à origem Q165'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "CreditoMatricula_q165_guard" BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW WHEN (NEW."origemAcertoDesistenciaContratualId" IS NOT NULL) EXECUTE FUNCTION q165_credito_guard();

COMMIT;
