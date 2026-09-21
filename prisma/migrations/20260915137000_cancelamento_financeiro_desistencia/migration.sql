CREATE TABLE "PropostaFinanceiraDesistencia" (
 id TEXT PRIMARY KEY,"pedidoId" TEXT NOT NULL REFERENCES "PedidoDesistenciaPreparacao"(id) ON DELETE RESTRICT,"preparadorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,versao INTEGER NOT NULL,motivo TEXT NOT NULL,"evidenciaCondicoes" TEXT NOT NULL,"chaveIdempotencia" TEXT NOT NULL,"entradaHash" TEXT NOT NULL,"estadoHash" TEXT NOT NULL,snapshot JSONB NOT NULL,"criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 CHECK(versao>0),CHECK(length(btrim(motivo)) BETWEEN 10 AND 3000),CHECK(length(btrim("evidenciaCondicoes")) BETWEEN 10 AND 3000));
CREATE UNIQUE INDEX "PropostaFinanceiraDesistencia_pedido_versao" ON "PropostaFinanceiraDesistencia"("pedidoId",versao);
CREATE UNIQUE INDEX "PropostaFinanceiraDesistencia_autor_chave" ON "PropostaFinanceiraDesistencia"("preparadorId","chaveIdempotencia");
CREATE TABLE "DecisaoFinanceiraDesistencia" (id TEXT PRIMARY KEY,"propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaFinanceiraDesistencia"(id) ON DELETE RESTRICT,"decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,aprovada BOOLEAN NOT NULL,motivo TEXT NOT NULL,"decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),CHECK(length(btrim(motivo)) BETWEEN 10 AND 3000));
ALTER TABLE "EfetivacaoPedidoDesistenciaPreparacao" ADD COLUMN "decisaoFinanceiraId" TEXT UNIQUE REFERENCES "DecisaoFinanceiraDesistencia"(id) ON DELETE RESTRICT;
ALTER TABLE "Cobranca" ADD COLUMN "canceladaPorDesistenciaId" TEXT REFERENCES "EfetivacaoPedidoDesistenciaPreparacao"(id) ON DELETE RESTRICT;
CREATE INDEX "Cobranca_canceladaPorDesistenciaId_idx" ON "Cobranca"("canceladaPorDesistenciaId");


ALTER TABLE "PropostaFinanceiraDesistencia" ADD CONSTRAINT "PropostaFinanceiraDesistencia_hashes" CHECK("entradaHash" ~ '^[a-f0-9]{64}$' AND "estadoHash" ~ '^[a-f0-9]{64}$' AND jsonb_typeof(snapshot)='object'), ADD CONSTRAINT "PropostaFinanceiraDesistencia_chave" CHECK(length("chaveIdempotencia") BETWEEN 8 AND 100);
CREATE INDEX "PropostaFinanceiraDesistencia_pedidoId_criadaEm_idx" ON "PropostaFinanceiraDesistencia"("pedidoId","criadaEm");

CREATE FUNCTION fotografia_cobrancas_desistencia(matricula_id TEXT) RETURNS JSONB LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'versao',c.versao,'status',c.status::text,
 'valorOriginal',c."valorOriginal"::text,'valorNegociado',c."valorNegociado"::text,'saldoAnterior',c.saldo::text,'moeda',c.moeda,
 'vencimento',to_char(c.vencimento,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'coberturaInicio',to_char(c."coberturaInicio",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'coberturaFim',to_char(c."coberturaFim",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'canceladaPorPausaId',c."canceladaPorPausaId",'suspensaPorItemPausaId',c."suspensaPorItemPausaId",
 'informes',coalesce((SELECT jsonb_agg(i.status::text ORDER BY i.status::text) FROM "PagamentoInformado" i WHERE i."cobrancaId"=c.id),'[]'::jsonb),
 'itemEmissaoId',(SELECT i.id FROM "ItemEmissaoEntrada" i WHERE i."cobrancaId"=c.id)) ORDER BY c.id),'[]'::jsonb)
 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id
$$;

CREATE FUNCTION validar_fontes_cobrancas_desistencia(matricula_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Cobranca" WHERE "matriculaId"=matricula_id) THEN RAISE EXCEPTION 'Não há cobranças para tratamento financeiro'; END IF;
 IF EXISTS(SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND (
 c.status NOT IN ('PENDENTE','ATRASADO','CANCELADA') OR coalesce(c."valorRecebido",0)<>0 OR c."valorLiquidadoCredito"<>0 OR c."pagoEm" IS NOT NULL
 OR c.saldo IS NULL OR c.saldo IS DISTINCT FROM c."valorNegociado" OR c."valorOriginal"<0 OR c."valorNegociado"<0
 OR c."canceladaPorPausaId" IS NOT NULL OR c."suspensaPorItemPausaId" IS NOT NULL OR c."acertoMultaDecisaoId" IS NOT NULL
 OR EXISTS(SELECT 1 FROM "Recebimento" r WHERE r."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "PagamentoInformado" i WHERE i."cobrancaId"=c.id AND i.status<>'REJEITADO')
 OR EXISTS(SELECT 1 FROM "PropostaUsoCredito" u WHERE u."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "CompensacaoCoberturaMatricula" a WHERE a."cobrancaOrigemId"=c.id)
 OR EXISTS(SELECT 1 FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "AplicacaoPeriodoIntegral" a WHERE a."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "EmissaoFechamentoHoras" a WHERE a."cobrancaId"=c.id)
 OR EXISTS(SELECT 1 FROM "CompraHorasAntecipadas" a WHERE a."cobrancaId"=c.id))) THEN RAISE EXCEPTION 'Cobrança exige acerto financeiro específico'; END IF;
END $$;

CREATE FUNCTION bloquear_contexto_financeiro_desistencia(pedido_id TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE mid TEXT; lid TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT p."matriculaId",m."leadId" INTO mid,lid FROM "PedidoDesistenciaPreparacao" p JOIN "Matricula" m ON m.id=p."matriculaId" WHERE p.id=pedido_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de desistência não encontrado'; END IF;
 IF lid IS NOT NULL THEN PERFORM id FROM "Lead" WHERE id=lid FOR UPDATE; END IF;
 PERFORM id FROM "Matricula" WHERE id=mid FOR UPDATE;
 PERFORM id FROM "Cobranca" WHERE "matriculaId"=mid ORDER BY id FOR UPDATE;
 RETURN mid;
END $$;

CREATE FUNCTION validar_autor_financeiro_desistencia(usuario_id TEXT, aprovador BOOLEAN) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE u RECORD;
BEGIN
 SELECT ativo,papeis,permissoes INTO u FROM "Usuario" WHERE id=usuario_id FOR SHARE;
 IF NOT FOUND OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND (NOT aprovador OR 'financeiro.aprovar_acertos'=ANY(u.permissoes)))) THEN RAISE EXCEPTION 'Alçada financeira atual insuficiente'; END IF;
END $$;

CREATE FUNCTION validar_contexto_financeiro_desistencia(pedido_id TEXT, estado_hash TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE p RECORD; m RECORD; mid TEXT;
BEGIN
 mid:=bloquear_contexto_financeiro_desistencia(pedido_id);
 SELECT * INTO p FROM "PedidoDesistenciaPreparacao" WHERE id=pedido_id;
 SELECT * INTO m FROM "Matricula" WHERE id=mid;
 IF p."estadoHash" IS DISTINCT FROM estado_hash OR m.status NOT IN('RASCUNHO','AGUARDANDO') OR m."ativadaEm" IS NOT NULL OR m."contratoOk" OR m."confirmacaoContratoEm" IS NOT NULL OR m."contratoDocumentoId" IS NOT NULL
 OR EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" WHERE "matriculaId"=mid AND versao>p.versao)
 OR EXISTS(SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" WHERE "matriculaId"=mid)
 OR EXISTS(SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId"=mid)
 OR EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=mid)
 OR EXISTS(SELECT 1 FROM "Documento" WHERE "matriculaId"=mid)
 OR EXISTS(SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId"=mid)
 OR EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=mid AND status='UTILIZADA')
 OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=mid AND status='UTILIZADA') THEN RAISE EXCEPTION 'Contexto da desistência exige nova conferência'; END IF;
 PERFORM validar_fontes_cobrancas_desistencia(mid);
 RETURN mid;
END $$;

CREATE FUNCTION validar_proposta_financeira_desistencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE mid TEXT; ultima INTEGER;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta financeira deve permanecer preservada'; END IF;
 mid:=validar_contexto_financeiro_desistencia(NEW."pedidoId",NEW."estadoHash");
 PERFORM validar_autor_financeiro_desistencia(NEW."preparadorId",false);
 SELECT coalesce(max(versao),0) INTO ultima FROM "PropostaFinanceiraDesistencia" WHERE "pedidoId"=NEW."pedidoId";
 IF NEW.versao<>ultima+1 OR NEW.snapshot->'fotografia' IS DISTINCT FROM fotografia_cobrancas_desistencia(mid) THEN RAISE EXCEPTION 'Fotografia financeira ou versão divergente'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "PropostaFinanceiraDesistencia_validar" BEFORE INSERT OR UPDATE OR DELETE ON "PropostaFinanceiraDesistencia" FOR EACH ROW EXECUTE FUNCTION validar_proposta_financeira_desistencia();

CREATE FUNCTION validar_decisao_financeira_desistencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p RECORD; mid TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão financeira deve permanecer preservada'; END IF;
 SELECT * INTO p FROM "PropostaFinanceiraDesistencia" WHERE id=NEW."propostaId";
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
 mid:=bloquear_contexto_financeiro_desistencia(p."pedidoId");
 PERFORM validar_autor_financeiro_desistencia(NEW."decisorId",true);
 IF p."preparadorId"=NEW."decisorId" THEN RAISE EXCEPTION 'Decisão financeira exige outra pessoa'; END IF;
 IF EXISTS(SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" WHERE "matriculaId"=mid) THEN RAISE EXCEPTION 'Desistência já efetivada'; END IF;
 IF NEW.aprovada THEN
  PERFORM validar_autor_financeiro_desistencia(p."preparadorId",false);
  PERFORM validar_contexto_financeiro_desistencia(p."pedidoId",p."estadoHash");
  IF EXISTS(SELECT 1 FROM "PropostaFinanceiraDesistencia" WHERE "pedidoId"=p."pedidoId" AND versao>p.versao) OR p.snapshot->'fotografia' IS DISTINCT FROM fotografia_cobrancas_desistencia(mid) THEN RAISE EXCEPTION 'Proposta financeira obsoleta'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "DecisaoFinanceiraDesistencia_validar" BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoFinanceiraDesistencia" FOR EACH ROW EXECUTE FUNCTION validar_decisao_financeira_desistencia();

CREATE FUNCTION validar_aprovacao_financeira_desistencia(decisao_id TEXT,pedido_id TEXT,estado_hash TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE d RECORD; p RECORD; mid TEXT;
BEGIN
 SELECT * INTO d FROM "DecisaoFinanceiraDesistencia" WHERE id=decisao_id;
 IF NOT FOUND OR NOT d.aprovada THEN RAISE EXCEPTION 'Decisão financeira não aprovada'; END IF;
 SELECT * INTO p FROM "PropostaFinanceiraDesistencia" WHERE id=d."propostaId";
 IF p."pedidoId" IS DISTINCT FROM pedido_id OR p."estadoHash" IS DISTINCT FROM estado_hash OR p."preparadorId"=d."decisorId" THEN RAISE EXCEPTION 'Decisão financeira não pertence ao pedido'; END IF;
 mid:=validar_contexto_financeiro_desistencia(pedido_id,estado_hash);
 PERFORM validar_autor_financeiro_desistencia(p."preparadorId",false);
 PERFORM validar_autor_financeiro_desistencia(d."decisorId",true);
 IF EXISTS(SELECT 1 FROM "PropostaFinanceiraDesistencia" WHERE "pedidoId"=pedido_id AND versao>p.versao) OR p.snapshot->'fotografia' IS DISTINCT FROM fotografia_cobrancas_desistencia(mid) THEN RAISE EXCEPTION 'Decisão financeira exige nova conferência'; END IF;
END $$;
CREATE OR REPLACE FUNCTION conferir_efetivacao_pedido_desistencia_preparacao()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pedido RECORD;
  matricula_atual RECORD;
  usuario_atual RECORD;
  lead_atual TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Efetivação de desistência deve permanecer preservada';
  END IF;
  SELECT p.* INTO pedido FROM "PedidoDesistenciaPreparacao" p WHERE p.id = NEW."pedidoId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de desistência não encontrado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT "leadId" INTO lead_atual FROM "Matricula" WHERE id = pedido."matriculaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula do pedido não encontrada'; END IF;
  IF lead_atual IS NOT NULL THEN PERFORM id FROM "Lead" WHERE id = lead_atual FOR UPDATE; END IF;
  SELECT * INTO matricula_atual FROM "Matricula" WHERE id = pedido."matriculaId" FOR UPDATE;
  PERFORM id FROM "PedidoDesistenciaPreparacao" WHERE id = pedido.id FOR UPDATE;
  PERFORM id FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId" ORDER BY id FOR UPDATE;
  PERFORM id FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId" ORDER BY id FOR UPDATE;
  PERFORM id FROM "Usuario" WHERE id = NEW."executorId" FOR SHARE;
  SELECT ativo, papeis INTO usuario_atual FROM "Usuario" WHERE id = NEW."executorId";
  IF NOT FOUND OR NOT usuario_atual.ativo OR NOT ('SECRETARIA_ACADEMICA'::"Papel" = ANY(usuario_atual.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(usuario_atual.papeis)) THEN
    RAISE EXCEPTION 'Efetivação exige Secretaria ou Administração ativa';
  END IF;
  IF NEW."matriculaId" IS DISTINCT FROM pedido."matriculaId" OR NEW."estadoHash" IS DISTINCT FROM pedido."estadoHash" THEN
    RAISE EXCEPTION 'Efetivação não corresponde ao pedido conferido';
  END IF;
  IF matricula_atual.status NOT IN ('RASCUNHO', 'AGUARDANDO') OR matricula_atual."ativadaEm" IS NOT NULL
    OR matricula_atual."contratoOk" OR matricula_atual."confirmacaoContratoEm" IS NOT NULL OR matricula_atual."contratoDocumentoId" IS NOT NULL THEN
    RAISE EXCEPTION 'Efetivação exige matrícula ainda em preparação';
  END IF;
  IF EXISTS (SELECT 1 FROM "PedidoDesistenciaPreparacao" p WHERE p."matriculaId" = pedido."matriculaId" AND p.versao > pedido.versao) THEN
    RAISE EXCEPTION 'Há pedido de desistência mais recente';
  END IF;
  IF pedido."snapshotJson"->'matricula'->>'status' IS DISTINCT FROM matricula_atual.status::text
    OR pedido."snapshotJson"->'matricula'->>'leadId' IS DISTINCT FROM lead_atual
    OR (pedido."snapshotJson"->'matricula'->>'ativadaEm') IS DISTINCT FROM (CASE WHEN matricula_atual."ativadaEm" IS NULL THEN NULL ELSE to_char(matricula_atual."ativadaEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
    OR (pedido."snapshotJson"->'matricula'->>'contratoOk') IS DISTINCT FROM (CASE WHEN matricula_atual."contratoOk" THEN 'true' ELSE 'false' END)
    OR (pedido."snapshotJson"->'matricula'->>'confirmacaoContratoEm') IS DISTINCT FROM (CASE WHEN matricula_atual."confirmacaoContratoEm" IS NULL THEN NULL ELSE to_char(matricula_atual."confirmacaoContratoEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
    OR pedido."snapshotJson"->'matricula'->>'contratoDocumentoId' IS DISTINCT FROM matricula_atual."contratoDocumentoId" THEN
    RAISE EXCEPTION 'A fonte da matrícula mudou desde a conferência';
  END IF;
  IF (pedido."snapshotJson"->'preparacao' = 'null'::jsonb) IS DISTINCT FROM (NOT EXISTS (SELECT 1 FROM "PreparacaoComercialMatricula" WHERE "matriculaId" = pedido."matriculaId"))
    OR EXISTS (SELECT 1 FROM "PreparacaoComercialMatricula" pc WHERE pc."matriculaId" = pedido."matriculaId" AND (
      pedido."snapshotJson"->'preparacao'->>'id' IS DISTINCT FROM pc.id OR pedido."snapshotJson"->'preparacao'->>'reservaId' IS DISTINCT FROM pc."reservaId"
      OR pedido."snapshotJson"->'preparacao'->>'reservaParticularId' IS DISTINCT FROM pc."reservaParticularId" OR pedido."snapshotJson"->'preparacao'->>'regime' IS DISTINCT FROM pc.regime::text
      OR pedido."snapshotJson"->'preparacao'->>'entradaHash' IS DISTINCT FROM pc."entradaHash")) THEN
    RAISE EXCEPTION 'A preparação comercial mudou desde a conferência';
  END IF;
  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'condicoes', '[]'::jsonb)) <> (SELECT count(*) FROM "CondicoesEntradaPreparacao" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "CondicoesEntradaPreparacao" c WHERE c."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'condicoes') s
      WHERE s->>'id' = c.id AND (s->>'versao')::integer = c.versao AND s->>'entradaHash' = c."entradaHash")) THEN
    RAISE EXCEPTION 'As condições de preparação mudaram desde a conferência';
  END IF;
  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasColetivas', '[]'::jsonb)) <> (SELECT count(*) FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ReservaVagaMatricula" r WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasColetivas') s
      WHERE s->>'id' = r.id AND s->>'turmaId' = r."turmaId" AND s->>'janelaId' = r."janelaId" AND s->>'status' = r.status::text
        AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC' = r."expiraEm" AND s->>'entradaHash' = r."entradaHash")) THEN
    RAISE EXCEPTION 'A reserva coletiva mudou desde a conferência';
  END IF;
  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasParticulares', '[]'::jsonb)) <> (SELECT count(*) FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ReservaAgendaParticular" r WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s
      WHERE s->>'id' = r.id AND s->>'status' = r.status::text
        AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC' = r."expiraEm" AND s->>'entradaHash' = r."entradaHash"))
    OR EXISTS (SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id = h."reservaId"
      WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s, jsonb_array_elements(s->'horarios') hjson
        WHERE s->>'id' = r.id AND hjson->>'id' = h.id AND hjson->>'professorId' = h."professorId" AND hjson->>'fusoOrigem' = h."fusoOrigem"
          AND (hjson->>'inicio')::timestamptz AT TIME ZONE 'UTC' = h.inicio AND (hjson->>'fim')::timestamptz AT TIME ZONE 'UTC' = h.fim)) THEN
    RAISE EXCEPTION 'A reserva particular mudou desde a conferência';
  END IF;
  IF (NEW."decisaoFinanceiraId" IS NULL AND EXISTS (SELECT 1 FROM "Cobranca" WHERE "matriculaId" = pedido."matriculaId"))
    OR EXISTS (SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "Documento" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId" = pedido."matriculaId") THEN
    RAISE EXCEPTION 'Efetivação simples exige ausência de avanço financeiro, documental, assinatura e alocação';
  END IF;
  IF EXISTS (SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId" AND status = 'UTILIZADA')
    OR EXISTS (SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId" AND status = 'UTILIZADA') THEN
    RAISE EXCEPTION 'Reserva utilizada exige fluxo de acerto';
  END IF;
  IF EXISTS (SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId" AND status NOT IN ('ATIVA', 'MANTIDA_PENDENCIA', 'EXPIRADA', 'LIBERADA'))
    OR EXISTS (SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId" AND status NOT IN ('ATIVA', 'MANTIDA_PENDENCIA', 'EXPIRADA', 'LIBERADA')) THEN
    RAISE EXCEPTION 'Estado de reserva incompatível com a efetivação';
  END IF;
  IF NEW."decisaoFinanceiraId" IS NOT NULL THEN
    PERFORM validar_aprovacao_financeira_desistencia(NEW."decisaoFinanceiraId",NEW."pedidoId",NEW."estadoHash");
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION aplicar_efetivacao_pedido_desistencia_preparacao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."decisaoFinanceiraId" IS NOT NULL THEN
  UPDATE "Cobranca" SET status='CANCELADA',versao=versao+1,"canceladaPorDesistenciaId"=NEW.id WHERE "matriculaId"=NEW."matriculaId" AND status IN('PENDENTE','ATRASADO');
 END IF;
 UPDATE "ReservaVagaMatricula" SET status='LIBERADA' WHERE "matriculaId"=NEW."matriculaId" AND status IN('ATIVA','MANTIDA_PENDENCIA');
 UPDATE "ReservaAgendaParticular" SET status='LIBERADA' WHERE "matriculaId"=NEW."matriculaId" AND status IN('ATIVA','MANTIDA_PENDENCIA');
 UPDATE "Matricula" SET status='CANCELADA' WHERE id=NEW."matriculaId";
 RETURN NEW;
END $$;

CREATE FUNCTION proteger_cobranca_cancelada_desistencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a RECORD; fotografia JSONB;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD."canceladaPorDesistenciaId" IS NOT NULL THEN RAISE EXCEPTION 'Cobrança cancelada por desistência permanece preservada'; END IF;
  RETURN OLD;
 END IF;
 IF OLD."canceladaPorDesistenciaId" IS NOT NULL THEN
  IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN RAISE EXCEPTION 'Cobrança cancelada por desistência permanece preservada'; END IF;
 ELSIF NEW."canceladaPorDesistenciaId" IS NOT NULL THEN
  SELECT * INTO a FROM "EfetivacaoPedidoDesistenciaPreparacao" WHERE id=NEW."canceladaPorDesistenciaId";
  SELECT p.snapshot->'fotografia' INTO fotografia FROM "DecisaoFinanceiraDesistencia" d JOIN "PropostaFinanceiraDesistencia" p ON p.id=d."propostaId" WHERE d.id=a."decisaoFinanceiraId" AND d.aprovada;
  IF a."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR fotografia IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(fotografia) s WHERE s->>'id'=OLD.id AND (s->>'versao')::integer=OLD.versao AND s->>'status'=OLD.status::text)
   OR OLD.status NOT IN('PENDENTE','ATRASADO') OR NEW.status<>'CANCELADA' OR NEW.versao<>OLD.versao+1
   OR (to_jsonb(OLD)-ARRAY['status','versao','canceladaPorDesistenciaId']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['status','versao','canceladaPorDesistenciaId']) THEN RAISE EXCEPTION 'Cancelamento de cobrança exige aplicação aprovada correspondente'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Cobranca_proteger_cancelada_desistencia" BEFORE UPDATE OR DELETE ON "Cobranca" FOR EACH ROW EXECUTE FUNCTION proteger_cobranca_cancelada_desistencia();

CREATE OR REPLACE FUNCTION validar_efetivacao_pedido_desistencia_preparacao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE fotografia JSONB; atual JSONB; esperado JSONB;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Matricula" WHERE id=NEW."matriculaId" AND status='CANCELADA' AND "ativadaEm" IS NULL AND NOT "contratoOk" AND "confirmacaoContratoEm" IS NULL AND "contratoDocumentoId" IS NULL)
 OR EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=NEW."matriculaId" AND status IN('ATIVA','MANTIDA_PENDENCIA','UTILIZADA'))
 OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=NEW."matriculaId" AND status IN('ATIVA','MANTIDA_PENDENCIA','UTILIZADA'))
 OR EXISTS(SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId"=NEW."matriculaId")
 OR EXISTS(SELECT 1 FROM "Documento" WHERE "matriculaId"=NEW."matriculaId")
 OR EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=NEW."matriculaId")
 OR EXISTS(SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Efetivação não permite fonte concorrente no commit'; END IF;
 IF NEW."decisaoFinanceiraId" IS NULL THEN
  IF EXISTS(SELECT 1 FROM "Cobranca" WHERE "matriculaId"=NEW."matriculaId") THEN RAISE EXCEPTION 'Cobranças exigem decisão financeira'; END IF;
 ELSE
  PERFORM validar_fontes_cobrancas_desistencia(NEW."matriculaId");
  SELECT p.snapshot->'fotografia' INTO fotografia FROM "DecisaoFinanceiraDesistencia" d JOIN "PropostaFinanceiraDesistencia" p ON p.id=d."propostaId" WHERE d.id=NEW."decisaoFinanceiraId" AND d.aprovada;
  SELECT jsonb_agg(CASE WHEN s->>'status' IN('PENDENTE','ATRASADO') THEN s || jsonb_build_object('status','CANCELADA','versao',(s->>'versao')::integer+1) ELSE s END ORDER BY s->>'id') INTO esperado FROM jsonb_array_elements(fotografia) s;
  atual:=fotografia_cobrancas_desistencia(NEW."matriculaId");
  IF esperado IS NULL OR atual IS DISTINCT FROM esperado OR EXISTS(SELECT 1 FROM "Cobranca" c JOIN LATERAL jsonb_array_elements(fotografia) s ON s->>'id'=c.id WHERE c."matriculaId"=NEW."matriculaId" AND s->>'status' IN('PENDENTE','ATRASADO') AND c."canceladaPorDesistenciaId" IS DISTINCT FROM NEW.id) THEN RAISE EXCEPTION 'Cobranças divergem da aplicação financeira aprovada'; END IF;
 END IF;
 RETURN NULL;
END $$;

-- Serializa novas baixas/informes com o cancelamento da cobrança. Evidências
-- documentais tardias permanecem possíveis, sem baixar uma dívida cancelada.
CREATE FUNCTION impedir_baixa_cobranca_desistencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE aplicada TEXT;
BEGIN
 SELECT "canceladaPorDesistenciaId" INTO aplicada FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
 IF aplicada IS NOT NULL THEN RAISE EXCEPTION 'Cobrança cancelada por desistência não admite nova baixa ou informe'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Recebimento_impedir_desistencia" BEFORE INSERT OR UPDATE OF "cobrancaId" ON "Recebimento" FOR EACH ROW EXECUTE FUNCTION impedir_baixa_cobranca_desistencia();
CREATE TRIGGER "PagamentoInformado_impedir_desistencia" BEFORE INSERT OR UPDATE OF "cobrancaId",status ON "PagamentoInformado" FOR EACH ROW EXECUTE FUNCTION impedir_baixa_cobranca_desistencia();
