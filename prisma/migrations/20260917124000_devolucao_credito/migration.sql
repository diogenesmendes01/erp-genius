BEGIN;
CREATE TYPE "EstadoReservaDevolucaoCredito" AS ENUM ('AGUARDANDO_EXECUCAO','INCERTO','CONFIRMADA','LIBERADA');

CREATE TABLE "PropostaDevolucaoCredito" (
  id TEXT PRIMARY KEY, "creditoId" TEXT NOT NULL REFERENCES "CreditoMatricula"(id) ON DELETE RESTRICT,
  "preparadorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT, versao INTEGER NOT NULL,
  valor DECIMAL(12,2) NOT NULL, "pedidoAluno" TEXT NOT NULL, "evidenciaPedido" TEXT NOT NULL, destino TEXT NOT NULL,
  snapshot JSONB NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("creditoId",versao), UNIQUE("preparadorId","chaveIdempotencia"),
  CHECK (valor>0 AND length(btrim("pedidoAluno"))>=5 AND length(btrim("evidenciaPedido"))>=5 AND length(btrim(destino))>=5)
);
CREATE TABLE "DecisaoDevolucaoCredito" (
  id TEXT PRIMARY KEY, "propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaDevolucaoCredito"(id) ON DELETE RESTRICT,
  "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT, aprovada BOOLEAN NOT NULL, motivo TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(length(btrim(motivo))>=5)
);
CREATE TABLE "ReservaDevolucaoCredito" (
  id TEXT PRIMARY KEY, "decisaoId" TEXT NOT NULL UNIQUE REFERENCES "DecisaoDevolucaoCredito"(id) ON DELETE RESTRICT,
  "creditoId" TEXT NOT NULL REFERENCES "CreditoMatricula"(id) ON DELETE RESTRICT, valor DECIMAL(12,2) NOT NULL, destino TEXT NOT NULL,
  estado "EstadoReservaDevolucaoCredito" NOT NULL DEFAULT 'AGUARDANDO_EXECUCAO', "executorId" TEXT REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  "referenciaExterna" TEXT, "evidenciaExecucao" TEXT, "chaveExecucao" TEXT,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "executadaEm" TIMESTAMP(3),
  UNIQUE("executorId","chaveExecucao"), CHECK(valor>0 AND length(btrim(destino))>=5)
);
CREATE TABLE "ConciliacaoDevolucaoCredito" (
 id TEXT PRIMARY KEY, "reservaId" TEXT NOT NULL UNIQUE REFERENCES "ReservaDevolucaoCredito"(id) ON DELETE RESTRICT,
 "conciliadorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT, "confirmouSaida" BOOLEAN NOT NULL,
 evidencia TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(length(btrim(evidencia))>=5)
);
CREATE TABLE "CancelamentoDevolucaoCredito" (
 id TEXT PRIMARY KEY, "reservaId" TEXT NOT NULL UNIQUE REFERENCES "ReservaDevolucaoCredito"(id) ON DELETE RESTRICT,
 "canceladorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT, motivo TEXT NOT NULL, evidencia TEXT NOT NULL,
 "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(length(btrim(motivo))>=5 AND length(btrim(evidencia))>=5)
);
CREATE INDEX "ReservaDevolucaoCredito_creditoId_estado_idx" ON "ReservaDevolucaoCredito"("creditoId",estado);
CREATE TRIGGER preservar_proposta_devolucao_credito BEFORE UPDATE OR DELETE ON "PropostaDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE TRIGGER preservar_decisao_devolucao_credito BEFORE UPDATE OR DELETE ON "DecisaoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE TRIGGER preservar_conciliacao_devolucao_credito BEFORE UPDATE OR DELETE ON "ConciliacaoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE TRIGGER preservar_cancelamento_devolucao_credito BEFORE UPDATE OR DELETE ON "CancelamentoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();

CREATE FUNCTION saldo_credito_disponivel_207(credito_id text) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT c."valorInicial" - coalesce((SELECT sum(p.valor) FROM "PropostaUsoCredito" p JOIN "DecisaoUsoCredito" d ON d."propostaId"=p.id AND d.aprovada WHERE p."creditoId"=c.id),0)
  - coalesce((SELECT sum(r.valor) FROM "ReservaDevolucaoCredito" r WHERE r."creditoId"=c.id AND r.estado <> 'LIBERADA'),0)
 FROM "CreditoMatricula" c WHERE c.id=credito_id;
$$;

CREATE FUNCTION conferir_decisao_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaDevolucaoCredito"; u "Usuario"; saldo numeric;
BEGIN
 SELECT * INTO p FROM "PropostaDevolucaoCredito" WHERE id=NEW."propostaId";
 PERFORM id FROM "CreditoMatricula" WHERE id=p."creditoId" FOR UPDATE;
 SELECT * INTO p FROM "PropostaDevolucaoCredito" WHERE id=NEW."propostaId" FOR SHARE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
 IF p.id IS NULL OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) OR p."preparadorId"=NEW."decisorId" THEN RAISE EXCEPTION 'Devolução exige aprovação financeira independente'; END IF;
 IF NEW.aprovada THEN
  SELECT saldo_credito_disponivel_207(p."creditoId") INTO saldo;
  IF EXISTS(SELECT 1 FROM "PropostaDevolucaoCredito" n WHERE n."creditoId"=p."creditoId" AND n.versao>p.versao) OR saldo < p.valor OR (p.snapshot->>'saldoDisponivel')::numeric IS DISTINCT FROM saldo THEN RAISE EXCEPTION 'Crédito mudou; prepare nova devolução'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_decisao_devolucao_credito BEFORE INSERT ON "DecisaoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION conferir_decisao_devolucao_credito_207();

CREATE FUNCTION conferir_proposta_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"; saldo numeric;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de devolução é imutável'; END IF;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
 PERFORM id FROM "CreditoMatricula" WHERE id=NEW."creditoId" FOR UPDATE;
 SELECT saldo_credito_disponivel_207(NEW."creditoId") INTO saldo;
 IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) OR NEW.versao<>coalesce((SELECT max(versao)+1 FROM "PropostaDevolucaoCredito" WHERE "creditoId"=NEW."creditoId"),1) OR NEW.snapshot->>'creditoId' IS DISTINCT FROM NEW."creditoId" OR (NEW.snapshot->>'saldoDisponivel')::numeric IS DISTINCT FROM saldo OR (NEW.snapshot->>'valor')::numeric IS DISTINCT FROM NEW.valor OR NEW.snapshot->>'destino' IS DISTINCT FROM NEW.destino THEN RAISE EXCEPTION 'Proposta de devolução incompatível com autor, versão ou saldo'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_proposta_devolucao_credito BEFORE INSERT OR UPDATE OR DELETE ON "PropostaDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION conferir_proposta_devolucao_credito_207();

CREATE FUNCTION reservar_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaDevolucaoCredito";
BEGIN
 IF NEW.aprovada THEN SELECT * INTO p FROM "PropostaDevolucaoCredito" WHERE id=NEW."propostaId"; INSERT INTO "ReservaDevolucaoCredito"(id,"decisaoId","creditoId",valor,destino) VALUES (NEW.id,NEW.id,p."creditoId",p.valor,p.destino); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reservar_devolucao_credito AFTER INSERT ON "DecisaoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION reservar_devolucao_credito_207();

CREATE OR REPLACE FUNCTION conferir_decisao_uso_credito() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaUsoCredito"; credito "CreditoMatricula"; c "Cobranca"; autorizado boolean; utilizado numeric;
BEGIN
 SELECT * INTO p FROM "PropostaUsoCredito" WHERE id=NEW."propostaId" FOR SHARE; SELECT ativo AND ('ADMINISTRADOR'=ANY(papeis) OR ('FINANCEIRO'=ANY(papeis) AND 'financeiro.aprovar_acertos'=ANY(permissoes))) INTO autorizado FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
 IF autorizado IS DISTINCT FROM true OR p."preparadorId"=NEW."decisorId" THEN RAISE EXCEPTION 'Utilização exige aprovação financeira independente'; END IF;
 IF NEW.aprovada THEN SELECT * INTO credito FROM "CreditoMatricula" WHERE id=p."creditoId" FOR UPDATE; SELECT * INTO c FROM "Cobranca" WHERE id=p."cobrancaId" FOR UPDATE; SELECT coalesce(sum(pp.valor),0) INTO utilizado FROM "PropostaUsoCredito" pp JOIN "DecisaoUsoCredito" dd ON dd."propostaId"=pp.id AND dd.aprovada WHERE pp."creditoId"=credito.id;
  IF EXISTS(SELECT 1 FROM "PropostaUsoCredito" WHERE "creditoId"=credito.id AND versao>p.versao) OR saldo_credito_disponivel_207(credito.id)<p.valor OR credito."matriculaId" IS DISTINCT FROM c."matriculaId" OR credito.moeda IS DISTINCT FROM c.moeda OR c.status NOT IN ('PENDENTE','ATRASADO') OR p.valor>c."valorNegociado"-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito" OR c."suspensaPorItemPausaId" IS NOT NULL OR c."canceladaPorPausaId" IS NOT NULL OR EXISTS(SELECT 1 FROM "PagamentoInformado" WHERE "cobrancaId"=c.id AND status='A_CONFERIR') THEN RAISE EXCEPTION 'Utilização incompatível com versão, saldo, matrícula ou cobrança'; END IF;
  IF (p.snapshot->>'cobrancaVersao')::integer IS DISTINCT FROM c.versao OR (p.snapshot->>'valorCredito')::numeric IS DISTINCT FROM saldo_credito_disponivel_207(credito.id) THEN RAISE EXCEPTION 'Confira novamente a proposta de crédito'; END IF;
 END IF; RETURN NEW;
END $$;

CREATE FUNCTION conferir_execucao_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"; d "DecisaoDevolucaoCredito"; p "PropostaDevolucaoCredito"; saldo numeric;
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM id FROM "CreditoMatricula" WHERE id=NEW."creditoId" FOR UPDATE; SELECT * INTO d FROM "DecisaoDevolucaoCredito" WHERE id=NEW."decisaoId" FOR SHARE; SELECT * INTO p FROM "PropostaDevolucaoCredito" WHERE id=d."propostaId" FOR SHARE; SELECT saldo_credito_disponivel_207(NEW."creditoId") INTO saldo;
  IF d.id IS NULL OR NOT d.aprovada OR NEW."creditoId" IS DISTINCT FROM p."creditoId" OR NEW.valor IS DISTINCT FROM p.valor OR NEW.destino IS DISTINCT FROM p.destino OR NEW.estado<>'AGUARDANDO_EXECUCAO' OR NEW."executorId" IS NOT NULL OR NEW."referenciaExterna" IS NOT NULL OR NEW."evidenciaExecucao" IS NOT NULL OR NEW."chaveExecucao" IS NOT NULL OR NEW."executadaEm" IS NOT NULL OR saldo < NEW.valor THEN RAISE EXCEPTION 'Reserva de devolução inicial inválida'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reserva de devolução não pode ser apagada'; END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW."criadaEm" IS DISTINCT FROM OLD."criadaEm" OR NEW."decisaoId" IS DISTINCT FROM OLD."decisaoId" OR NEW."creditoId" IS DISTINCT FROM OLD."creditoId" OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.destino IS DISTINCT FROM OLD.destino OR OLD.estado IN ('CONFIRMADA','LIBERADA') OR (OLD."executorId" IS NOT NULL AND (NEW."executorId" IS DISTINCT FROM OLD."executorId" OR NEW."chaveExecucao" IS DISTINCT FROM OLD."chaveExecucao" OR NEW."referenciaExterna" IS DISTINCT FROM OLD."referenciaExterna" OR NEW."evidenciaExecucao" IS DISTINCT FROM OLD."evidenciaExecucao")) OR (OLD."executadaEm" IS NOT NULL AND NEW."executadaEm" IS DISTINCT FROM OLD."executadaEm") THEN RAISE EXCEPTION 'Reserva de devolução é imutável'; END IF;
 IF OLD.estado='AGUARDANDO_EXECUCAO' AND NEW.estado='LIBERADA' THEN
  IF NOT EXISTS(SELECT 1 FROM "CancelamentoDevolucaoCredito" c WHERE c."reservaId"=OLD.id) THEN RAISE EXCEPTION 'Cancelamento evidenciado é obrigatório para liberar reserva'; END IF;
 ELSIF OLD.estado='AGUARDANDO_EXECUCAO' THEN
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
  IF u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.executar_devolucoes'=ANY(u.permissoes))) OR NEW.estado NOT IN ('INCERTO','CONFIRMADA') OR NEW."chaveExecucao" IS NULL OR NEW."referenciaExterna" IS NULL OR length(btrim(coalesce(NEW."evidenciaExecucao",'')))<5 OR NEW."executadaEm" IS NULL THEN RAISE EXCEPTION 'Transição de devolução inválida'; END IF;
 ELSIF OLD.estado='INCERTO' THEN
  IF NEW.estado NOT IN ('CONFIRMADA','LIBERADA') OR NOT EXISTS(SELECT 1 FROM "ConciliacaoDevolucaoCredito" c WHERE c."reservaId"=OLD.id) THEN RAISE EXCEPTION 'Conciliação imutável é obrigatória para encerrar execução incerta'; END IF;
 ELSE RAISE EXCEPTION 'Transição de devolução inválida';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_execucao_devolucao_credito BEFORE INSERT OR UPDATE OR DELETE ON "ReservaDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION conferir_execucao_devolucao_credito_207();

CREATE FUNCTION conferir_conciliacao_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReservaDevolucaoCredito"; u "Usuario";
BEGIN
 SELECT * INTO r FROM "ReservaDevolucaoCredito" WHERE id=NEW."reservaId";
 PERFORM id FROM "CreditoMatricula" WHERE id=r."creditoId" FOR UPDATE;
 SELECT * INTO r FROM "ReservaDevolucaoCredito" WHERE id=NEW."reservaId" FOR UPDATE; SELECT * INTO u FROM "Usuario" WHERE id=NEW."conciliadorId" FOR SHARE;
 IF r.id IS NULL OR r.estado<>'INCERTO' OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.executar_devolucoes'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Conciliação de devolução inválida'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_conciliacao_devolucao_credito BEFORE INSERT ON "ConciliacaoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION conferir_conciliacao_devolucao_credito_207();

CREATE FUNCTION aplicar_conciliacao_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "ReservaDevolucaoCredito" SET estado=CASE WHEN NEW."confirmouSaida" THEN 'CONFIRMADA'::"EstadoReservaDevolucaoCredito" ELSE 'LIBERADA'::"EstadoReservaDevolucaoCredito" END WHERE id=NEW."reservaId";
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_conciliacao_devolucao_credito AFTER INSERT ON "ConciliacaoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION aplicar_conciliacao_devolucao_credito_207();

CREATE FUNCTION conferir_cancelamento_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReservaDevolucaoCredito"; u "Usuario";
BEGIN
 SELECT * INTO r FROM "ReservaDevolucaoCredito" WHERE id=NEW."reservaId";
 PERFORM id FROM "CreditoMatricula" WHERE id=r."creditoId" FOR UPDATE;
 SELECT * INTO r FROM "ReservaDevolucaoCredito" WHERE id=NEW."reservaId" FOR UPDATE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."canceladorId" FOR SHARE;
 IF r.id IS NULL OR r.estado<>'AGUARDANDO_EXECUCAO' OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Cancelamento de devolução inválido'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_cancelamento_devolucao_credito BEFORE INSERT ON "CancelamentoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION conferir_cancelamento_devolucao_credito_207();

CREATE FUNCTION aplicar_cancelamento_devolucao_credito_207() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "ReservaDevolucaoCredito" SET estado='LIBERADA' WHERE id=NEW."reservaId";
 RETURN NEW;
END $$;
CREATE TRIGGER aplicar_cancelamento_devolucao_credito AFTER INSERT ON "CancelamentoDevolucaoCredito" FOR EACH ROW EXECUTE FUNCTION aplicar_cancelamento_devolucao_credito_207();

COMMIT;
