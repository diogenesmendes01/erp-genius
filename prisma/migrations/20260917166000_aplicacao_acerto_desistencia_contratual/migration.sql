-- Q241: materializa o acerto Q165 e permite a efetivação Q121 somente depois
-- de conferir a aplicação financeira contratual completa.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION q165_json_canon(valor JSONB) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF jsonb_typeof(valor)='object' THEN RETURN '{'||coalesce((SELECT string_agg(to_jsonb(chave)::text||':'||q165_json_canon(conteudo),',' ORDER BY chave COLLATE "C") FROM jsonb_each(valor) e(chave,conteudo)),'')||'}'; END IF;
  IF jsonb_typeof(valor)='array' THEN RETURN '['||coalesce((SELECT string_agg(q165_json_canon(conteudo),',' ORDER BY ordem) FROM jsonb_array_elements(valor) WITH ORDINALITY e(conteudo,ordem)),'')||']'; END IF;
  RETURN valor::text;
END $$;

CREATE OR REPLACE FUNCTION q165_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; d "DecisaoAcertoDesistenciaContratual"%ROWTYPE; regras JSONB;
BEGIN
 IF TG_TABLE_NAME='PropostaAcertoDesistenciaContratual' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta é imutável'; END IF;
  SELECT c.regras INTO regras FROM "CondicoesEncerramentoMatricula" c WHERE c.id=NEW."condicoesId" FOR SHARE;
  IF NEW."condicoesHash" IS DISTINCT FROM encode(digest(q165_json_canon(regras),'sha256'),'hex') OR NEW."fotografiaHash" IS DISTINCT FROM encode(digest(q165_json_canon(NEW.memoria->'fotografia'),'sha256'),'hex') THEN RAISE EXCEPTION 'Hashes Q165 não comprovam a memória canônica'; END IF;
  PERFORM q165_autorizado(NEW."preparadorId",false); PERFORM q165_contexto(NEW.id); PERFORM q165_memoria(NEW.id); RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='DecisaoAcertoDesistenciaContratual' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão é imutável'; END IF;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=NEW."propostaId" FOR UPDATE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" THEN RAISE EXCEPTION 'Decisão não corresponde à proposta independente'; END IF;
  PERFORM q165_autorizado(NEW."decisorId",true); IF NEW.aprovada THEN PERFORM q165_contexto(p.id); PERFORM q165_memoria(p.id); END IF; RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação é imutável'; END IF;
 SELECT * INTO d FROM "DecisaoAcertoDesistenciaContratual" WHERE id=NEW."decisaoId" FOR SHARE;
 SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=d."propostaId" FOR UPDATE;
 IF d.id IS NULL OR p.id IS NULL OR NOT d.aprovada OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR NEW.memoria IS DISTINCT FROM p.memoria THEN RAISE EXCEPTION 'Aplicação exige decisão aprovada e memória correspondente'; END IF;
 PERFORM q165_autorizado(NEW."executorId",true); PERFORM q165_contexto(p.id); PERFORM q165_memoria(p.id); RETURN NEW;
END $$;

-- A origem Q165 passou a existir depois da fotografia 239; ela também é fonte
-- imutável da revalidação Node/SQL das propostas posteriores.
CREATE OR REPLACE FUNCTION q165_fotografia_atual(proposta_id TEXT) RETURNS VOID LANGUAGE plpgsql SET TimeZone = 'UTC' AS $$
DECLARE p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; financeiro JSONB; credito_ja_apurado JSONB; foto JSONB;
BEGIN
 SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=proposta_id FOR SHARE;
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR SHARE;
 SELECT jsonb_build_object('matriculaId',pe."matriculaId",'cobrancas',coalesce(jsonb_agg(c.fotografia ORDER BY c.id),'[]'::jsonb),'creditos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',cr.id,'origemLiberacaoId',cr."origemLiberacaoId",'origemAcertoId',cr."origemAcertoId",'origemPeriodoIntegralId',cr."origemPeriodoIntegralId",'origemDestinacaoRecebimentoId',cr."origemDestinacaoRecebimentoId",'origemAcertoDesistenciaContratualId',cr."origemAcertoDesistenciaContratualId",'valorInicial',to_char(cr."valorInicial",'FM999999999999999999990.00'),'moeda',cr.moeda,'criadoEm',to_char(cr."criadoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY cr.id) FROM "CreditoMatricula" cr WHERE cr."matriculaId"=pe."matriculaId"),'[]'::jsonb)) INTO financeiro
 FROM (SELECT c.id,jsonb_build_object('id',c.id,'versao',c.versao,'tipo',c.tipo,'status',c.status,'moeda',c.moeda,'vencimento',to_char(c.vencimento AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'coberturaInicio',CASE WHEN c."coberturaInicio" IS NULL THEN NULL ELSE to_char(c."coberturaInicio" AT TIME ZONE 'UTC','YYYY-MM-DD') END,'coberturaFim',CASE WHEN c."coberturaFim" IS NULL THEN NULL ELSE to_char(c."coberturaFim" AT TIME ZONE 'UTC','YYYY-MM-DD') END,'valorOriginal',to_char(c."valorOriginal",'FM999999999999999999990.00'),'valorNegociado',to_char(c."valorNegociado",'FM999999999999999999990.00'),'valorRecebido',CASE WHEN c."valorRecebido" IS NULL THEN NULL ELSE to_char(c."valorRecebido",'FM999999999999999999990.00') END,'valorLiquidadoCredito',to_char(c."valorLiquidadoCredito",'FM999999999999999999990.00'),'saldo',CASE WHEN c.saldo IS NULL THEN NULL ELSE to_char(c.saldo,'FM999999999999999999990.00') END,'pagoEm',CASE WHEN c."pagoEm" IS NULL THEN NULL ELSE to_char(c."pagoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,'fontes',jsonb_build_object('emissaoEntrada',(SELECT jsonb_build_object('itemId',ie.id,'emissaoId',ie."emissaoId",'etapa',ee.etapa,'condicoesId',ee."condicoesId",'criadaEm',to_char(ee."criadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "ItemEmissaoEntrada" ie JOIN "EmissaoCobrancasEntrada" ee ON ee.id=ie."emissaoId" WHERE ie."cobrancaId"=c.id ORDER BY ie.id LIMIT 1),'suspensaPorItemPausaId',c."suspensaPorItemPausaId",'canceladaPorPausaId',c."canceladaPorPausaId",'ajusteAcerto',(SELECT jsonb_build_object('id',a.id,'decisaoId',a."decisaoId",'valorNovo',to_char(a."valorNovo",'FM999999999999999999990.00'),'criadoEm',to_char(a."criadoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId"=c.id ORDER BY a.id LIMIT 1),'emissaoFechamentoHoras',(SELECT jsonb_build_object('id',eh.id,'decisaoId',eh."decisaoId",'criadaEm',to_char(eh."criadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM "EmissaoFechamentoHoras" eh WHERE eh."cobrancaId"=c.id ORDER BY eh.id LIMIT 1),'acertoMultaDecisaoId',c."acertoMultaDecisaoId"),'informes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'status',i.status,'versao',i.versao,'valor',to_char(i.valor,'FM999999999999999999990.00'),'moeda',i.moeda,'dataPagamento',to_char(i."dataPagamento" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY i.id) FROM "PagamentoInformado" i WHERE i."cobrancaId"=c.id),'[]'::jsonb),'recebimentos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',dr.id,'recebimentoId',dr."recebimentoId",'valor',to_char(dr.valor,'FM999999999999999999990.00'),'moeda',r.moeda,'dataPagamento',to_char(r."dataPagamento" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY dr.id) FROM "DestinacaoRecebimento" dr JOIN "Recebimento" r ON r.id=dr."recebimentoId" WHERE dr."cobrancaId"=c.id),'[]'::jsonb),'utilizacoesCredito',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'creditoId',u."creditoId",'versao',u.versao,'valor',to_char(u.valor,'FM999999999999999999990.00'),'decisao',CASE WHEN du.id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object('id',du.id,'aprovada',du.aprovada,'decididaEm',to_char(du."decididaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END) ORDER BY u.id) FROM "PropostaUsoCredito" u LEFT JOIN "DecisaoUsoCredito" du ON du."propostaId"=u.id WHERE u."cobrancaId"=c.id),'[]'::jsonb),'compensacoes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',cc.id,'status',cc.status,'cobrancaVersao',cc."cobrancaVersao",'decididaEm',CASE WHEN cc."decididaEm" IS NULL THEN NULL ELSE to_char(cc."decididaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,'dias',coalesce((SELECT jsonb_agg(jsonb_build_object('id',dc.id,'estado',dc.estado,'versao',dc.versao) ORDER BY dc.id) FROM "DiaCompensacaoCobertura" dc WHERE dc."compensacaoId"=cc.id),'[]'::jsonb)) ORDER BY cc.id) FROM "CompensacaoCoberturaMatricula" cc WHERE cc."cobrancaOrigemId"=c.id),'[]'::jsonb)) || CASE WHEN c."valorCompensadoPermuta">0 THEN jsonb_build_object('valorCompensadoPermuta',to_char(c."valorCompensadoPermuta",'FM999999999999999999990.00')) ELSE '{}'::jsonb END AS fotografia FROM "Cobranca" c WHERE c."matriculaId"=pe."matriculaId") c;
 SELECT coalesce(jsonb_object_agg(o."cobrancaId",to_char(o.valor,'FM999999999999999999990.00')),'{}'::jsonb) INTO credito_ja_apurado FROM (SELECT origem."cobrancaId",sum(origem.valor) AS valor FROM (SELECT taxa."cobrancaId",taxa.valor FROM "OrigemCreditoAcertoTaxaAditivo" taxa JOIN "Cobranca" cobranca_taxa ON cobranca_taxa.id=taxa."cobrancaId" WHERE cobranca_taxa."matriculaId"=pe."matriculaId" UNION ALL SELECT desist."cobrancaId",desist.valor FROM "OrigemCreditoAcertoDesistenciaContratual" desist WHERE desist."matriculaId"=pe."matriculaId") origem GROUP BY origem."cobrancaId") o;
 foto:=jsonb_build_object('financeiro',financeiro,'creditoJaApurado',credito_ja_apurado);
 IF p.memoria->'fotografia' IS DISTINCT FROM foto THEN RAISE EXCEPTION 'Fotografia financeira vigente diverge da proposta'; END IF;
END $$;

CREATE FUNCTION q165_validar_efeitos_aplicacao(aplicacao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; item JSONB;
BEGIN
  SELECT * INTO a FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=aplicacao_id FOR SHARE;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=(SELECT "propostaId" FROM "DecisaoAcertoDesistenciaContratual" WHERE id=a."decisaoId") FOR SHARE;
  SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR SHARE;
  IF a.id IS NULL OR p.id IS NULL OR pe.id IS NULL
    OR (SELECT count(*) FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId") <> jsonb_array_length(a.memoria->'itens') THEN
    RAISE EXCEPTION 'Aplicação Q165 exige conjunto completo de cobranças aprovado';
  END IF;
  FOR item IN SELECT x FROM jsonb_array_elements(a.memoria->'itens') x LOOP
    IF NOT EXISTS (
      SELECT 1 FROM "Cobranca" c
      WHERE c.id=item->>'cobrancaId' AND c."matriculaId"=pe."matriculaId" AND c.moeda=item->>'moeda'
        AND c."valorNegociado" IS NOT DISTINCT FROM (item->>'devido')::numeric
        AND c.saldo IS NOT DISTINCT FROM (item->>'saldoDevido')::numeric
        AND ((item->>'saldoDevido')::numeric=0 AND c.status='PAGO' AND c."pagoEm" IS NOT NULL
          OR (item->>'saldoDevido')::numeric>0 AND c.status IN ('PENDENTE','ATRASADO') AND c."pagoEm" IS NULL)
    ) THEN RAISE EXCEPTION 'Cobrança não recebeu exatamente o efeito financeiro Q165 aprovado'; END IF;
    IF (item->>'creditoApurado')::numeric>0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM "OrigemCreditoAcertoDesistenciaContratual" o JOIN "CreditoMatricula" cr ON cr."origemAcertoDesistenciaContratualId"=o.id
        WHERE o."aplicacaoId"=a.id AND o."matriculaId"=pe."matriculaId" AND o."cobrancaId"=item->>'cobrancaId'
          AND o.valor IS NOT DISTINCT FROM (item->>'creditoApurado')::numeric AND o.moeda=item->>'moeda'
          AND cr."matriculaId"=pe."matriculaId" AND cr."valorInicial" IS NOT DISTINCT FROM o.valor AND cr.moeda=o.moeda
      ) THEN RAISE EXCEPTION 'Excedente Q165 exige origem e crédito correspondentes'; END IF;
    ELSIF EXISTS (SELECT 1 FROM "OrigemCreditoAcertoDesistenciaContratual" o WHERE o."aplicacaoId"=a.id AND o."cobrancaId"=item->>'cobrancaId') THEN
      RAISE EXCEPTION 'Aplicação Q165 não pode criar crédito sem excedente aprovado';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM "OrigemCreditoAcertoDesistenciaContratual" WHERE "aplicacaoId"=a.id)
      <> (SELECT count(*) FROM jsonb_array_elements(a.memoria->'itens') x WHERE (x->>'creditoApurado')::numeric>0)
    OR EXISTS (
      SELECT 1 FROM "OrigemCreditoAcertoDesistenciaContratual" o LEFT JOIN "CreditoMatricula" cr ON cr."origemAcertoDesistenciaContratualId"=o.id
      WHERE o."aplicacaoId"=a.id AND cr.id IS NULL
    ) THEN RAISE EXCEPTION 'Origens e créditos Q165 não comprovam todos os efeitos aprovados'; END IF;
END $$;

CREATE FUNCTION q165_exigir_efeitos_aplicacao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM q165_validar_efeitos_aplicacao(NEW.id);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "AplicacaoAcertoDesistenciaContratual_efeitos"
  AFTER INSERT ON "AplicacaoAcertoDesistenciaContratual" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION q165_exigir_efeitos_aplicacao();

CREATE OR REPLACE FUNCTION conferir_efetivacao_pedido_desistencia_preparacao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; d "DecisaoAcertoDesistenciaContratual"%ROWTYPE; p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; c "CondicoesEncerramentoMatricula"%ROWTYPE; m "Matricula"%ROWTYPE; doc "Documento"%ROWTYPE; u RECORD; pedido RECORD; matricula_atual RECORD; usuario_atual RECORD; lead_atual TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Efetivação de desistência deve permanecer preservada'; END IF;
  IF NEW."aplicacaoAcertoDesistenciaContratualId" IS NULL THEN
    SELECT p.* INTO pedido FROM "PedidoDesistenciaPreparacao" p WHERE p.id=NEW."pedidoId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de desistência não encontrado'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
    SELECT "leadId" INTO lead_atual FROM "Matricula" WHERE id=pedido."matriculaId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula do pedido não encontrada'; END IF;
    IF lead_atual IS NOT NULL THEN PERFORM id FROM "Lead" WHERE id=lead_atual FOR UPDATE; END IF;
    SELECT * INTO matricula_atual FROM "Matricula" WHERE id=pedido."matriculaId" FOR UPDATE;
    PERFORM id FROM "PedidoDesistenciaPreparacao" WHERE id=pedido.id FOR UPDATE;
    PERFORM id FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" ORDER BY id FOR UPDATE;
    PERFORM id FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" ORDER BY id FOR UPDATE;
    SELECT ativo,papeis INTO usuario_atual FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
    IF usuario_atual.ativo IS DISTINCT FROM true OR NOT ('SECRETARIA_ACADEMICA'=ANY(usuario_atual.papeis) OR 'ADMINISTRADOR'=ANY(usuario_atual.papeis)) THEN RAISE EXCEPTION 'Efetivação exige Secretaria ou Administração ativa'; END IF;
    IF NEW."matriculaId" IS DISTINCT FROM pedido."matriculaId" OR NEW."estadoHash" IS DISTINCT FROM pedido."estadoHash" THEN RAISE EXCEPTION 'Efetivação não corresponde ao pedido conferido'; END IF;
    IF matricula_atual.status NOT IN('RASCUNHO','AGUARDANDO') OR matricula_atual."ativadaEm" IS NOT NULL OR matricula_atual."contratoOk" OR matricula_atual."confirmacaoContratoEm" IS NOT NULL OR matricula_atual."contratoDocumentoId" IS NOT NULL THEN RAISE EXCEPTION 'Efetivação exige matrícula ainda em preparação'; END IF;
    IF EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=pedido."matriculaId" AND x.versao>pedido.versao) THEN RAISE EXCEPTION 'Há pedido de desistência mais recente'; END IF;
    IF pedido."snapshotJson"->'matricula'->>'status' IS DISTINCT FROM matricula_atual.status::text OR pedido."snapshotJson"->'matricula'->>'leadId' IS DISTINCT FROM lead_atual OR (pedido."snapshotJson"->'matricula'->>'ativadaEm') IS DISTINCT FROM (CASE WHEN matricula_atual."ativadaEm" IS NULL THEN NULL ELSE to_char(matricula_atual."ativadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END) OR (pedido."snapshotJson"->'matricula'->>'contratoOk') IS DISTINCT FROM (CASE WHEN matricula_atual."contratoOk" THEN 'true' ELSE 'false' END) OR (pedido."snapshotJson"->'matricula'->>'confirmacaoContratoEm') IS DISTINCT FROM (CASE WHEN matricula_atual."confirmacaoContratoEm" IS NULL THEN NULL ELSE to_char(matricula_atual."confirmacaoContratoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END) OR pedido."snapshotJson"->'matricula'->>'contratoDocumentoId' IS DISTINCT FROM matricula_atual."contratoDocumentoId" THEN RAISE EXCEPTION 'A fonte da matrícula mudou desde a conferência'; END IF;
    IF (pedido."snapshotJson"->'preparacao'='null'::jsonb) IS DISTINCT FROM (NOT EXISTS(SELECT 1 FROM "PreparacaoComercialMatricula" WHERE "matriculaId"=pedido."matriculaId")) OR EXISTS(SELECT 1 FROM "PreparacaoComercialMatricula" pc WHERE pc."matriculaId"=pedido."matriculaId" AND (pedido."snapshotJson"->'preparacao'->>'id' IS DISTINCT FROM pc.id OR pedido."snapshotJson"->'preparacao'->>'reservaId' IS DISTINCT FROM pc."reservaId" OR pedido."snapshotJson"->'preparacao'->>'reservaParticularId' IS DISTINCT FROM pc."reservaParticularId" OR pedido."snapshotJson"->'preparacao'->>'regime' IS DISTINCT FROM pc.regime::text OR pedido."snapshotJson"->'preparacao'->>'entradaHash' IS DISTINCT FROM pc."entradaHash")) THEN RAISE EXCEPTION 'A preparação comercial mudou desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'condicoes','[]'::jsonb))<>(SELECT count(*) FROM "CondicoesEntradaPreparacao" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "CondicoesEntradaPreparacao" cc WHERE cc."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'condicoes') s WHERE s->>'id'=cc.id AND (s->>'versao')::integer=cc.versao AND s->>'entradaHash'=cc."entradaHash")) THEN RAISE EXCEPTION 'As condições de preparação mudaram desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasColetivas','[]'::jsonb))<>(SELECT count(*) FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ReservaVagaMatricula" r WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasColetivas') s WHERE s->>'id'=r.id AND s->>'turmaId'=r."turmaId" AND s->>'janelaId'=r."janelaId" AND s->>'status'=r.status::text AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC'=r."expiraEm" AND s->>'entradaHash'=r."entradaHash")) THEN RAISE EXCEPTION 'A reserva coletiva mudou desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasParticulares','[]'::jsonb))<>(SELECT count(*) FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" r WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s WHERE s->>'id'=r.id AND s->>'status'=r.status::text AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC'=r."expiraEm" AND s->>'entradaHash'=r."entradaHash")) OR EXISTS(SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id=h."reservaId" WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s,jsonb_array_elements(s->'horarios') hjson WHERE s->>'id'=r.id AND hjson->>'id'=h.id AND hjson->>'professorId'=h."professorId" AND hjson->>'fusoOrigem'=h."fusoOrigem" AND (hjson->>'inicio')::timestamptz AT TIME ZONE 'UTC'=h.inicio AND (hjson->>'fim')::timestamptz AT TIME ZONE 'UTC'=h.fim)) THEN RAISE EXCEPTION 'A reserva particular mudou desde a conferência'; END IF;
    IF (NEW."decisaoFinanceiraId" IS NULL AND EXISTS(SELECT 1 FROM "Cobranca" WHERE "matriculaId"=pedido."matriculaId")) OR EXISTS(SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "Documento" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId"=pedido."matriculaId") THEN RAISE EXCEPTION 'Efetivação simples exige ausência de avanço financeiro, documental, assinatura e alocação'; END IF;
    IF EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" AND status='UTILIZADA') OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" AND status='UTILIZADA') THEN RAISE EXCEPTION 'Reserva utilizada exige fluxo de acerto'; END IF;
    IF EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" AND status NOT IN('ATIVA','MANTIDA_PENDENCIA','EXPIRADA','LIBERADA')) OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" AND status NOT IN('ATIVA','MANTIDA_PENDENCIA','EXPIRADA','LIBERADA')) THEN RAISE EXCEPTION 'Estado de reserva incompatível com a efetivação'; END IF;
    IF NEW."decisaoFinanceiraId" IS NOT NULL THEN PERFORM validar_aprovacao_financeira_desistencia(NEW."decisaoFinanceiraId",NEW."pedidoId",NEW."estadoHash"); END IF;
    RETURN NEW;
  END IF;
  IF NEW."decisaoFinanceiraId" IS NOT NULL THEN RAISE EXCEPTION 'Efetivação Q165 deve ser uma inserção contratual exclusiva'; END IF;
  SELECT * INTO a FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=NEW."aplicacaoAcertoDesistenciaContratualId" FOR SHARE;
  SELECT * INTO d FROM "DecisaoAcertoDesistenciaContratual" WHERE id=a."decisaoId" FOR SHARE;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=d."propostaId" FOR UPDATE;
  SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR UPDATE;
  SELECT * INTO c FROM "CondicoesEncerramentoMatricula" WHERE id=p."condicoesId" FOR SHARE;
  SELECT * INTO m FROM "Matricula" WHERE id=pe."matriculaId" FOR UPDATE;
  SELECT * INTO doc FROM "Documento" WHERE id=c."documentoId" FOR SHARE;
  SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
  PERFORM id FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE;
  IF a.id IS NULL OR d.id IS NULL OR p.id IS NULL OR pe.id IS NULL OR c.id IS NULL OR m.id IS NULL OR doc.id IS NULL
    OR NOT d.aprovada OR a."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR a."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR a.memoria IS DISTINCT FROM p.memoria
    OR NEW."pedidoId" IS DISTINCT FROM pe.id OR NEW."matriculaId" IS DISTINCT FROM pe."matriculaId" OR NEW."estadoHash" IS DISTINCT FROM pe."estadoHash"
    OR u.ativo IS DISTINCT FROM true OR NOT ('SECRETARIA_ACADEMICA'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))
    OR m.status NOT IN ('RASCUNHO','AGUARDANDO') OR m."ativadaEm" IS NOT NULL OR NOT m."contratoOk" OR m."confirmacaoContratoEm" IS NULL OR m."confirmacaoContratoPorId" IS NULL
    OR c.status<>'APROVADA' OR c."matriculaId" IS DISTINCT FROM m.id OR c."documentoId" IS DISTINCT FROM m."contratoDocumentoId" OR doc."matriculaId" IS DISTINCT FROM m.id OR doc.arquivado
    OR EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=m.id AND x.versao>pe.versao)
    OR EXISTS(SELECT 1 FROM "CondicoesEncerramentoMatricula" x WHERE x."matriculaId"=m.id AND x.versao>c.versao)
    OR EXISTS(SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" x WHERE x."matriculaId"=m.id) THEN
    RAISE EXCEPTION 'Efetivação Q165 não corresponde ao pedido, contrato e aplicação aprovados';
  END IF;
  PERFORM q165_validar_efeitos_aplicacao(a.id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_efetivacao_pedido_desistencia_preparacao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE fotografia JSONB; atual JSONB; esperado JSONB;
BEGIN
  IF NEW."aplicacaoAcertoDesistenciaContratualId" IS NOT NULL THEN
    PERFORM q165_validar_efeitos_aplicacao(NEW."aplicacaoAcertoDesistenciaContratualId");
    IF NOT EXISTS(SELECT 1 FROM "Matricula" WHERE id=NEW."matriculaId" AND status='CANCELADA' AND "ativadaEm" IS NULL)
      OR EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=NEW."matriculaId" AND status IN ('ATIVA','MANTIDA_PENDENCIA','UTILIZADA'))
      OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=NEW."matriculaId" AND status IN ('ATIVA','MANTIDA_PENDENCIA','UTILIZADA')) THEN RAISE EXCEPTION 'Efetivação Q165 deve cancelar matrícula e liberar reservas'; END IF;
    RETURN NULL;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM "Matricula" WHERE id=NEW."matriculaId" AND status='CANCELADA' AND "ativadaEm" IS NULL AND NOT "contratoOk" AND "confirmacaoContratoEm" IS NULL AND "contratoDocumentoId" IS NULL) OR EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=NEW."matriculaId" AND status IN('ATIVA','MANTIDA_PENDENCIA','UTILIZADA')) OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=NEW."matriculaId" AND status IN('ATIVA','MANTIDA_PENDENCIA','UTILIZADA')) OR EXISTS(SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId"=NEW."matriculaId") OR EXISTS(SELECT 1 FROM "Documento" WHERE "matriculaId"=NEW."matriculaId") OR EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=NEW."matriculaId") OR EXISTS(SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Efetivação não permite fonte concorrente no commit'; END IF;
  IF NEW."decisaoFinanceiraId" IS NULL THEN
    IF EXISTS(SELECT 1 FROM "Cobranca" WHERE "matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Cobranças exigem decisão financeira'; END IF;
  ELSE
    PERFORM validar_fontes_cobrancas_desistencia(NEW."matriculaId");
    SELECT p.snapshot->'fotografia' INTO fotografia FROM "DecisaoFinanceiraDesistencia" d JOIN "PropostaFinanceiraDesistencia" p ON p.id=d."propostaId" WHERE d.id=NEW."decisaoFinanceiraId" AND d.aprovada;
    SELECT jsonb_agg(CASE WHEN s->>'status' IN('PENDENTE','ATRASADO') THEN s || jsonb_build_object('status','CANCELADA','versao',(s->>'versao')::integer+1) ELSE s END ORDER BY s->>'id') INTO esperado FROM jsonb_array_elements(fotografia) s;
    atual:=fotografia_cobrancas_desistencia(NEW."matriculaId");
    IF esperado IS NULL OR atual IS DISTINCT FROM esperado OR EXISTS(SELECT 1 FROM "Cobranca" cc JOIN LATERAL jsonb_array_elements(fotografia) s ON s->>'id'=cc.id WHERE cc."matriculaId"=NEW."matriculaId" AND s->>'status' IN('PENDENTE','ATRASADO') AND cc."canceladaPorDesistenciaId" IS DISTINCT FROM NEW.id) THEN RAISE EXCEPTION 'Cobranças divergem da aplicação financeira aprovada'; END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION proteger_matricula_efetivada_desistencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" e WHERE e."matriculaId"=NEW.id AND e."aplicacaoAcertoDesistenciaContratualId" IS NOT NULL) THEN
    IF NEW.status IS DISTINCT FROM 'CANCELADA' OR NEW."ativadaEm" IS NOT NULL
      OR NEW."contratoOk" IS DISTINCT FROM OLD."contratoOk" OR NEW."contratoDocumentoId" IS DISTINCT FROM OLD."contratoDocumentoId"
      OR NEW."confirmacaoContratoEm" IS DISTINCT FROM OLD."confirmacaoContratoEm" OR NEW."confirmacaoContratoPorId" IS DISTINCT FROM OLD."confirmacaoContratoPorId" THEN
      RAISE EXCEPTION 'Matrícula cancelada por acerto Q165 não pode receber alteração contratual posterior';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" WHERE "matriculaId"=NEW.id)
    AND (NEW.status IS DISTINCT FROM 'CANCELADA' OR NEW."ativadaEm" IS NOT NULL OR NEW."contratoOk" OR NEW."confirmacaoContratoEm" IS NOT NULL OR NEW."contratoDocumentoId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Matrícula cancelada por desistência simples não pode ser reativada ou receber avanço contratual';
  END IF;
  RETURN NEW;
END $$;

COMMIT;
