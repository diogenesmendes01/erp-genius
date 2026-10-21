CREATE FUNCTION validar_emissao_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d "DecisaoFechamentoHoras"%ROWTYPE; r "RascunhoFechamentoHoras"%ROWTYPE; c "Cobranca"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO d FROM "DecisaoFechamentoHoras" WHERE id=NEW."decisaoId";
 SELECT * INTO r FROM "RascunhoFechamentoHoras" WHERE id=d."rascunhoId";
 PERFORM id FROM "Matricula" WHERE id=r."matriculaId" FOR UPDATE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
 IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Executor financeiro não autorizado.'; END IF;
 IF d.aprovada IS DISTINCT FROM true OR d."confirmaReferenciaContratual" IS DISTINCT FROM true OR r."preparadorId"=d."decisorId" THEN RAISE EXCEPTION 'Decisão independente obrigatória.'; END IF;
 IF NEW.memoria IS DISTINCT FROM r.snapshot OR COALESCE(r.snapshot#>>'{apuracao,estado}','') NOT IN ('APURACAO_COMPLETA','PROPOSTA_PARCIAL') OR COALESCE(jsonb_array_length(r.snapshot#>'{apuracao,itens}'),0)=0 THEN RAISE EXCEPTION 'Memória de emissão incompatível.'; END IF;
 IF c."matriculaId" IS DISTINCT FROM r."matriculaId" OR c.tipo<>'HORA_PARTICULAR' OR c.moeda IS DISTINCT FROM r.snapshot#>>'{apuracao,moeda}'
  OR c."valorOriginal" IS DISTINCT FROM (r.snapshot#>>'{apuracao,totalApurado}')::numeric OR c."valorNegociado" IS DISTINCT FROM c."valorOriginal" OR c.saldo IS DISTINCT FROM c."valorOriginal"
  OR COALESCE(c."valorRecebido",0)<>0 OR c.status NOT IN ('PENDENTE','ATRASADO') OR c."pagoEm" IS NOT NULL
  OR (c.vencimento AT TIME ZONE 'UTC' AT TIME ZONE (r.snapshot#>>'{periodo,fuso}'))::date IS DISTINCT FROM (r.snapshot#>>'{periodo,vencimento}')::date THEN RAISE EXCEPTION 'Cobrança incompatível com a apuração.'; END IF;
 NEW."criadaEm":=clock_timestamp() AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER validar_emissao_horas BEFORE INSERT ON "EmissaoFechamentoHoras" FOR EACH ROW EXECUTE FUNCTION validar_emissao_horas();

CREATE FUNCTION validar_conjunto_emissao_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EmissaoFechamentoHoras"%ROWTYPE; quantidade integer; total numeric;
BEGIN
 SELECT * INTO e FROM "EmissaoFechamentoHoras" WHERE id=NEW.id;
 SELECT count(*),COALESCE(sum(valor),0) INTO quantidade,total FROM "ItemFechamentoHoras" WHERE "emissaoId"=e.id;
 IF quantidade<>jsonb_array_length(e.memoria#>'{apuracao,itens}') OR total IS DISTINCT FROM (e.memoria#>>'{apuracao,totalApurado}')::numeric THEN RAISE EXCEPTION 'Conjunto de itens da emissão incompleto ou divergente.'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(e.memoria#>'{apuracao,itens}') j WHERE NOT EXISTS (
  SELECT 1 FROM "ItemFechamentoHoras" i JOIN "ConferenciaOcorrenciaHoras" c ON c.id=i."conferenciaId"
  WHERE i."emissaoId"=e.id AND c."encontroId"=j->>'encontroId' AND i.valor=(j->>'valor')::numeric)) THEN RAISE EXCEPTION 'Conjunto de itens difere dos encontros aprovados.'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER validar_conjunto_emissao_horas AFTER INSERT ON "EmissaoFechamentoHoras" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_conjunto_emissao_horas();

CREATE FUNCTION proteger_origem_cobranca_horas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "EmissaoFechamentoHoras" WHERE "cobrancaId"=OLD.id) AND
  (NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId" OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.moeda IS DISTINCT FROM OLD.moeda OR NEW."valorOriginal" IS DISTINCT FROM OLD."valorOriginal") THEN RAISE EXCEPTION 'Origem da cobrança por hora deve ser preservada.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proteger_origem_cobranca_horas BEFORE UPDATE ON "Cobranca" FOR EACH ROW EXECUTE FUNCTION proteger_origem_cobranca_horas();
