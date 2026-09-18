-- Q23 / INV07. This path preserves the already-conferred financial fact. It
-- never writes a charge, credit, receipt, occurrence, conference or reserve.
CREATE TABLE "PropostaRevisaoFinanceiraCorrecaoAula" (
  "id" TEXT NOT NULL, "propostaCorrecaoAulaId" TEXT NOT NULL, "versao" INTEGER NOT NULL,
  "versaoCorrecaoAula" INTEGER NOT NULL, "tipo" TEXT NOT NULL, "preparadorId" TEXT NOT NULL,
  "propostaHash" TEXT NOT NULL, "fotografia" JSONB NOT NULL, "fotografiaHash" TEXT NOT NULL,
  "motivo" TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  CONSTRAINT "PropostaRevFinCorrecaoAula_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropostaRevFinCorrecaoAula_proposta_versao_key" UNIQUE ("propostaCorrecaoAulaId", "versao"),
  CONSTRAINT "PropostaRevFinCorrecaoAula_preparador_chave_key" UNIQUE ("preparadorId", "chaveIdempotencia"),
  CONSTRAINT "PropostaRevFinCorrecaoAula_tipo_check" CHECK ("tipo" = 'SEM_ALTERACAO_VALORES'),
  CONSTRAINT "PropostaRevFinCorrecaoAula_versoes_check" CHECK ("versao" > 0 AND "versaoCorrecaoAula" > 0),
  CONSTRAINT "PropostaRevFinCorrecaoAula_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 5 AND 3000),
  CONSTRAINT "PropostaRevFinCorrecaoAula_hashes_check" CHECK ("propostaHash" ~ '^[a-f0-9]{64}$' AND "fotografiaHash" ~ '^[a-f0-9]{64}$' AND "entradaHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PropostaRevFinCorrecaoAula_foto_check" CHECK (jsonb_typeof("fotografia") = 'object')
);
CREATE INDEX "PropostaRevFinCorrecaoAula_proposta_criada_idx" ON "PropostaRevisaoFinanceiraCorrecaoAula" ("propostaCorrecaoAulaId", "criadaEm");

CREATE TABLE "DecisaoRevisaoFinanceiraCorrecaoAula" (
  "id" TEXT NOT NULL, "propostaId" TEXT NOT NULL, "decisorId" TEXT NOT NULL, "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL, "propostaHash" TEXT NOT NULL, "fotografiaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  CONSTRAINT "DecisaoRevFinCorrecaoAula_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisaoRevFinCorrecaoAula_proposta_key" UNIQUE ("propostaId"),
  CONSTRAINT "DecisaoRevFinCorrecaoAula_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 5 AND 3000),
  CONSTRAINT "DecisaoRevFinCorrecaoAula_hashes_check" CHECK ("propostaHash" ~ '^[a-f0-9]{64}$' AND "fotografiaHash" ~ '^[a-f0-9]{64}$')
);
ALTER TABLE "PropostaRevisaoFinanceiraCorrecaoAula"
  ADD CONSTRAINT "PropostaRevFinCorrecaoAula_correcao_fkey" FOREIGN KEY ("propostaCorrecaoAulaId") REFERENCES "PropostaCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PropostaRevFinCorrecaoAula_preparador_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoRevisaoFinanceiraCorrecaoAula"
  ADD CONSTRAINT "DecisaoRevFinCorrecaoAula_proposta_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaRevisaoFinanceiraCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "DecisaoRevFinCorrecaoAula_decisor_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AprovacaoCorrecaoAula" ADD COLUMN "revisaoFinanceiraDecisaoId" TEXT;
ALTER TABLE "AprovacaoCorrecaoAula"
  ADD CONSTRAINT "AprovacaoCorrecaoAula_revisaoFinanceiraDecisaoId_key" UNIQUE ("revisaoFinanceiraDecisaoId"),
  ADD CONSTRAINT "AprovacaoCorrecaoAula_revisaoFinanceiraDecisaoId_fkey" FOREIGN KEY ("revisaoFinanceiraDecisaoId") REFERENCES "DecisaoRevisaoFinanceiraCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- A canonical, ordered ledger slice. NULL means that this no-delta policy is
-- not applicable: pending conference, reserve, another enrolment, cancellation
-- or IMPEDIDO must follow a separately approved financial policy.
CREATE OR REPLACE FUNCTION q23_fotografia_financeira_atual_257(_proposta_id TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE _p "PropostaCorrecaoAula"%ROWTYPE; _e "EncontroAgenda"%ROWTYPE; _d "AulaDiario"%ROWTYPE;
  _o "OcorrenciaParticular"%ROWTYPE; _c "ConferenciaOcorrenciaHoras"%ROWTYPE; _cond "CondicoesHorasMatricula"%ROWTYPE;
  _item "ItemFechamentoHoras"%ROWTYPE; _emissao "EmissaoFechamentoHoras"%ROWTYPE; _cobranca "Cobranca"%ROWTYPE;
  _mudancas INTEGER; _antes TEXT; _depois TEXT; _foto JSONB; _informes JSONB; _recebimentos JSONB; _destinacoes JSONB;
BEGIN
  SELECT p.* INTO _p FROM "PropostaCorrecaoAula" p WHERE p.id=_proposta_id FOR SHARE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM "RejeicaoCorrecaoAula" r WHERE r."propostaId"=_p.id)
    OR EXISTS (SELECT 1 FROM "AprovacaoCorrecaoAula" a WHERE a."propostaId"=_p.id)
    OR _p.versao IS DISTINCT FROM (SELECT max(versao) FROM "PropostaCorrecaoAula" WHERE "encontroId"=_p."encontroId") THEN RETURN NULL; END IF;
  -- UPDATE conflicts with the KEY SHARE acquired by FK writers of a new
  -- reserve/item/invoice child. The calendar advisory lock is shared with the
  -- regular reserve and closing writers; these row locks also protect direct SQL.
  SELECT e.* INTO _e FROM "EncontroAgenda" e WHERE e.id=_p."encontroId" FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT d.* INTO _d FROM "AulaDiario" d WHERE d.id=_p."diarioId" FOR SHARE;
  IF NOT FOUND OR _e."matriculaId" IS NULL OR _e.finalidade::text<>'AULA' OR _e.status::text<>'MINISTRADO' THEN RETURN NULL; END IF;
  SELECT count(*),min(a->>'participacao'),min(n->>'participacao') INTO _mudancas,_antes,_depois
  FROM jsonb_array_elements(_p."snapshotAnterior"->'registros') a JOIN jsonb_array_elements(_p."snapshotNovo"->'registros') n ON n->>'registroId'=a->>'registroId'
  WHERE a->>'participacao' IS DISTINCT FROM n->>'participacao';
  IF _mudancas<>1 OR NOT ((_antes='FALTA' AND _depois='PRESENTE') OR (_antes='PRESENTE' AND _depois='FALTA'))
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_p."snapshotAnterior"->'registros') a JOIN jsonb_array_elements(_p."snapshotNovo"->'registros') n ON n->>'registroId'=a->>'registroId' WHERE a->>'participacao' IS DISTINCT FROM n->>'participacao' AND a->>'matriculaId'=_e."matriculaId") THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM "ReservaHorasCompradas" WHERE "encontroId"=_e.id) THEN RETURN NULL; END IF;
  -- A occurrence may have legitimate historical versions. The only source that
  -- can be reviewed is its latest version, and the immutable conference must
  -- point to exactly that version.
  SELECT * INTO _o FROM "OcorrenciaParticular" WHERE "encontroId"=_e.id AND "matriculaId"=_e."matriculaId" ORDER BY versao DESC, id DESC LIMIT 1 FOR SHARE;
  SELECT * INTO _c FROM "ConferenciaOcorrenciaHoras" WHERE "encontroId"=_e.id AND "ocorrenciaId"=_o.id FOR UPDATE;
  IF NOT FOUND OR _o.tipo NOT IN ('REALIZADA','FALTA_ALUNO') OR _c.desfecho NOT IN ('REALIZADA','FALTA_COBRAVEL')
    OR NOT ((_antes='FALTA' AND _depois='PRESENTE' AND _o.tipo='FALTA_ALUNO' AND _c.desfecho='FALTA_COBRAVEL')
      OR (_antes='PRESENTE' AND _depois='FALTA' AND _o.tipo='REALIZADA' AND _c.desfecho='REALIZADA'))
    OR _c.minutos IS DISTINCT FROM extract(epoch FROM (_o.fim-_o.inicio))::INTEGER/60
    OR _c.snapshot->>'ocorrenciaId' IS DISTINCT FROM _o.id
    OR _c.snapshot->>'matriculaId' IS DISTINCT FROM _e."matriculaId"
    OR (_c.snapshot->>'valorApurado')::numeric IS DISTINCT FROM _c.valor THEN RETURN NULL; END IF;
  SELECT * INTO _cond FROM "CondicoesHorasMatricula" WHERE id=_c."condicoesId" FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO _item FROM "ItemFechamentoHoras" WHERE "conferenciaId"=_c.id FOR SHARE;
  IF FOUND THEN
    SELECT * INTO _emissao FROM "EmissaoFechamentoHoras" WHERE id=_item."emissaoId" FOR SHARE;
    SELECT * INTO _cobranca FROM "Cobranca" WHERE id=_emissao."cobrancaId" AND "matriculaId"=_e."matriculaId" FOR UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;
    PERFORM 1 FROM "PagamentoInformado" WHERE "cobrancaId"=_cobranca.id FOR SHARE;
    PERFORM 1 FROM "Recebimento" WHERE "cobrancaId"=_cobranca.id FOR SHARE;
    PERFORM 1 FROM "DestinacaoRecebimento" WHERE "cobrancaId"=_cobranca.id FOR SHARE;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',pi.id,'versao',pi.versao,'status',pi.status::text,'hashDados',pi."hashDados",'valor',pi.valor,'moeda',pi.moeda,'forma',pi.forma::text,'dataPagamento',pi."dataPagamento",'conferenteId',pi."conferenteId",'conferidoEm',pi."conferidoEm",'motivoConferencia',pi."motivoConferencia",'permitirExcedente',pi."permitirExcedente") ORDER BY pi.id),'[]'::jsonb) INTO _informes FROM "PagamentoInformado" pi WHERE pi."cobrancaId"=_cobranca.id;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'hashDados',r."hashDados",'valor',r.valor,'moeda',r.moeda,'dataPagamento',r."dataPagamento",'informeId',r."informeId") ORDER BY r.id),'[]'::jsonb) INTO _recebimentos FROM "Recebimento" r WHERE r."cobrancaId"=_cobranca.id;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',dr.id,'recebimentoId',dr."recebimentoId",'tipo',dr.tipo::text,'valor',dr.valor,'evidencia',dr.evidencia,'origemLegada',dr."origemLegada") ORDER BY dr.id),'[]'::jsonb) INTO _destinacoes FROM "DestinacaoRecebimento" dr WHERE dr."cobrancaId"=_cobranca.id;
  ELSE _informes:='[]'::jsonb; _recebimentos:='[]'::jsonb; _destinacoes:='[]'::jsonb; END IF;
  _foto:=jsonb_build_object('versao',1,'propostaId',_p.id,'propostaHash',_p."entradaHash",'versaoCorrecaoAula',_p.versao,'estadoHash',_p."estadoHash",
    'encontro',jsonb_build_object('id',_e.id,'matriculaId',_e."matriculaId",'finalidade',_e.finalidade::text,'status',_e.status::text,'inicio',_e.inicio,'fim',_e.fim,'professorId',_e."professorId"),
    'diario',jsonb_build_object('id',_d.id,'conteudoHash',encode(digest(_d.conteudo,'sha256'),'hex'),'ocorridaEm',_d."ocorridaEm",'professorId',_d."professorId"),
    'ocorrencia',jsonb_build_object('id',_o.id,'versao',_o.versao,'tipo',_o.tipo,'inicio',_o.inicio,'fim',_o.fim,'entradaHash',_o."entradaHash"),
    'conferencia',jsonb_build_object('id',_c.id,'condicoesId',_c."condicoesId",'minutos',_c.minutos,'valor',_c.valor,'moeda',_c.moeda,'desfecho',_c.desfecho,'estadoPrevia',_c."estadoPrevia",'entradaHash',_c."entradaHash",'snapshot',_c.snapshot),
    'condicoes',jsonb_build_object('id',_cond.id,'versao',_cond.versao,'documentoId',_cond."documentoId",'regras',_cond.regras),
    'item',CASE WHEN _item.id IS NULL THEN NULL ELSE jsonb_build_object('id',_item.id,'valor',_item.valor,'emissaoId',_item."emissaoId") END,
    'emissao',CASE WHEN _emissao.id IS NULL THEN NULL ELSE jsonb_build_object('id',_emissao.id,'decisaoId',_emissao."decisaoId",'cobrancaId',_emissao."cobrancaId",'memoria',_emissao.memoria) END,
    'cobranca',CASE WHEN _cobranca.id IS NULL THEN NULL ELSE jsonb_build_object('id',_cobranca.id,'versao',_cobranca.versao,'valorNegociado',_cobranca."valorNegociado",'valorRecebido',_cobranca."valorRecebido",'saldo',_cobranca.saldo,'valorLiquidadoCredito',_cobranca."valorLiquidadoCredito",'valorCompensadoPermuta',_cobranca."valorCompensadoPermuta",'moeda',_cobranca.moeda,'status',_cobranca.status::text) END,
    'fundamento',jsonb_build_object('politica','Q92_EQUIVALENCIA_FALTA_REALIZADA','participacaoAnterior',_antes,'participacaoProposta',_depois,'ocorrenciaHistoricaTipo',_o.tipo,'desfechoHistorico',_c.desfecho,'minutosEquivalentes',_c.minutos,'valorPreservado',_c.valor,'moeda',_c.moeda),
    'informesPagamento',_informes,'recebimentos',_recebimentos,'destinacoes',_destinacoes,'reservas','[]'::jsonb,'semAlteracaoValores',true);
  RETURN _foto;
END $$;

CREATE OR REPLACE FUNCTION q23_foto_financeira_valida_257(_proposta_id TEXT,_foto JSONB,_hash TEXT,_proposta_hash TEXT,_versao INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$ DECLARE _atual JSONB; BEGIN
  _atual:=q23_fotografia_financeira_atual_257(_proposta_id);
  RETURN _atual IS NOT NULL AND _proposta_hash=_atual->>'propostaHash' AND _versao=(_atual->>'versaoCorrecaoAula')::INTEGER
    AND _hash=encode(digest(q165_json_canon(_foto),'sha256'),'hex') AND q165_json_canon(_foto)=q165_json_canon(_atual);
END $$;

-- The action obtains both values from this SQL function. It never reserializes
-- Decimal values in Node, avoiding a 100.00 versus 100 canonical-hash drift.
CREATE OR REPLACE FUNCTION q23_fotografia_financeira_materializada_257(_proposta_id TEXT)
RETURNS TABLE(fotografia JSONB, "fotografiaHash" TEXT) LANGUAGE plpgsql AS $$
BEGIN
  fotografia:=q23_fotografia_financeira_atual_257(_proposta_id);
  IF fotografia IS NULL THEN RETURN; END IF;
  "fotografiaHash":=encode(digest(q165_json_canon(fotografia),'sha256'),'hex');
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION q23_revisao_financeira_atores_validos_257(_revisao_id TEXT,_decisor_id TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE _preparador_id TEXT; _preparador_ok BOOLEAN; _decisor_ok BOOLEAN;
BEGIN
  SELECT "preparadorId" INTO _preparador_id FROM "PropostaRevisaoFinanceiraCorrecaoAula" WHERE id=_revisao_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  -- A stable user-id order prevents an approval/revocation deadlock.
  PERFORM 1 FROM "Usuario" u WHERE u.id IN (_preparador_id,_decisor_id) ORDER BY u.id FOR SHARE;
  SELECT u.ativo AND ('FINANCEIRO'::"Papel"=ANY(u.papeis) OR 'ADMINISTRADOR'::"Papel"=ANY(u.papeis)) INTO _preparador_ok FROM "Usuario" u WHERE u.id=_preparador_id;
  IF _decisor_id IS NULL THEN RETURN coalesce(_preparador_ok,FALSE); END IF;
  SELECT u.ativo AND ('FINANCEIRO'::"Papel"=ANY(u.papeis) OR 'ADMINISTRADOR'::"Papel"=ANY(u.papeis)) INTO _decisor_ok FROM "Usuario" u WHERE u.id=_decisor_id;
  RETURN coalesce(_preparador_ok,FALSE) AND coalesce(_decisor_ok,FALSE);
END $$;

CREATE OR REPLACE FUNCTION validar_proposta_revisao_financeira_correcao_aula_257() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _p "PropostaCorrecaoAula"%ROWTYPE; _ativo BOOLEAN; _papeis "Papel"[]; _proxima INTEGER; _ultima "PropostaRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _dec "DecisaoRevisaoFinanceiraCorrecaoAula"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Propostas de revisão financeira são imutáveis'; END IF; PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT p.* INTO _p FROM "PropostaCorrecaoAula" p JOIN "EncontroAgenda" e ON e.id=p."encontroId" WHERE p.id=NEW."propostaCorrecaoAulaId" FOR UPDATE OF p,e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta Q23 não encontrada'; END IF;
  SELECT u.ativo,u.papeis INTO _ativo,_papeis FROM "Usuario" u WHERE u.id=NEW."preparadorId" FOR SHARE;
  IF NOT FOUND OR NOT _ativo OR ('FINANCEIRO'::"Papel"<>ALL(_papeis) AND 'ADMINISTRADOR'::"Papel"<>ALL(_papeis)) THEN RAISE EXCEPTION 'Preparação exige financeiro ou administrador ativo'; END IF;
  SELECT coalesce(max(versao),0)+1 INTO _proxima FROM "PropostaRevisaoFinanceiraCorrecaoAula" WHERE "propostaCorrecaoAulaId"=_p.id;
  IF NEW.versao<>_proxima OR NEW."versaoCorrecaoAula" IS DISTINCT FROM _p.versao THEN RAISE EXCEPTION 'Revisão exige versão Q23 vigente e sequencial'; END IF;
  SELECT r.* INTO _ultima FROM "PropostaRevisaoFinanceiraCorrecaoAula" r WHERE r."propostaCorrecaoAulaId"=_p.id ORDER BY r.versao DESC LIMIT 1 FOR UPDATE;
  IF _proxima>1 THEN
    SELECT d.* INTO _dec FROM "DecisaoRevisaoFinanceiraCorrecaoAula" d WHERE d."propostaId"=_ultima.id FOR UPDATE;
    -- A pendência não pode se tornar um dead end: ela só pode ser superada
    -- quando a fotografia atual já divergiu. A proposta antiga permanece no
    -- histórico e nenhuma decisão é fabricada para ela.
    IF NOT FOUND AND q23_foto_financeira_valida_257(_p.id,_ultima.fotografia,_ultima."fotografiaHash",_ultima."propostaHash",_ultima."versaoCorrecaoAula") IS TRUE AND q23_revisao_financeira_atores_validos_257(_ultima.id) IS TRUE THEN RAISE EXCEPTION 'A revisão anterior ainda aguarda decisão'; END IF;
    IF _dec.aprovada AND q23_foto_financeira_valida_257(_p.id,_ultima.fotografia,_ultima."fotografiaHash",_ultima."propostaHash",_ultima."versaoCorrecaoAula") IS TRUE AND q23_revisao_financeira_atores_validos_257(_ultima.id,_dec."decisorId") IS TRUE THEN RAISE EXCEPTION 'A revisão aprovada permanece vigente e aguarda publicação'; END IF;
  END IF;
  IF q23_foto_financeira_valida_257(_p.id,NEW.fotografia,NEW."fotografiaHash",NEW."propostaHash",NEW."versaoCorrecaoAula") IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Fotografia financeira inválida, pendente ou obsoleta'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_decisao_revisao_financeira_correcao_aula_257() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _r "PropostaRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _p "PropostaCorrecaoAula"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisões de revisão financeira são imutáveis'; END IF; PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT r.* INTO _r FROM "PropostaRevisaoFinanceiraCorrecaoAula" r JOIN "PropostaCorrecaoAula" p ON p.id=r."propostaCorrecaoAulaId" JOIN "EncontroAgenda" e ON e.id=p."encontroId" WHERE r.id=NEW."propostaId" FOR UPDATE OF r,p,e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de revisão não encontrada'; END IF; SELECT * INTO _p FROM "PropostaCorrecaoAula" WHERE id=_r."propostaCorrecaoAulaId";
  IF _r.versao IS DISTINCT FROM (SELECT max(versao) FROM "PropostaRevisaoFinanceiraCorrecaoAula" WHERE "propostaCorrecaoAulaId"=_p.id) THEN RAISE EXCEPTION 'Somente a revisão financeira mais recente pode ser decidida'; END IF;
  -- This function locks preparer and decider in a stable id order before it
  -- reads their active roles, avoiding a revocation/decision race.
  IF NEW."decisorId"=_r."preparadorId" OR NEW."decisorId"=_p."autorId" OR q23_revisao_financeira_atores_validos_257(_r.id,NEW."decisorId") IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Decisor financeiro não tem alçada independente'; END IF;
  IF NEW."propostaHash" IS DISTINCT FROM _r."propostaHash" OR NEW."fotografiaHash" IS DISTINCT FROM _r."fotografiaHash" OR q23_foto_financeira_valida_257(_p.id,_r.fotografia,_r."fotografiaHash",_r."propostaHash",_r."versaoCorrecaoAula") IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Revisão financeira obsoleta'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_aprovacao_correcao_aula_financeira_257() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _p "PropostaCorrecaoAula"%ROWTYPE; _r "PropostaRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _d "DecisaoRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _depende BOOLEAN;
BEGIN
  IF TG_OP<>'INSERT' THEN RETURN NEW; END IF; PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0)); SELECT * INTO _p FROM "PropostaCorrecaoAula" WHERE id=NEW."propostaId" FOR UPDATE;
  SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(_p."snapshotAnterior"->'registros') a JOIN jsonb_array_elements(_p."snapshotNovo"->'registros') n ON n->>'registroId'=a->>'registroId' WHERE a->>'participacao' IS DISTINCT FROM n->>'participacao') AND (EXISTS(SELECT 1 FROM "OcorrenciaParticular" WHERE "encontroId"=_p."encontroId") OR EXISTS(SELECT 1 FROM "ReservaHorasCompradas" WHERE "encontroId"=_p."encontroId")) INTO _depende;
  IF _depende AND NEW."revisaoFinanceiraDecisaoId" IS NULL THEN RAISE EXCEPTION 'Publicação com dependência financeira exige revisão aprovada'; END IF;
  IF NEW."revisaoFinanceiraDecisaoId" IS NOT NULL THEN SELECT * INTO _d FROM "DecisaoRevisaoFinanceiraCorrecaoAula" WHERE id=NEW."revisaoFinanceiraDecisaoId" FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Decisão financeira não encontrada'; END IF; SELECT * INTO _r FROM "PropostaRevisaoFinanceiraCorrecaoAula" WHERE id=_d."propostaId" FOR UPDATE; IF NOT FOUND OR NOT _d.aprovada OR _r."propostaCorrecaoAulaId" IS DISTINCT FROM _p.id OR _r.versao IS DISTINCT FROM (SELECT max(versao) FROM "PropostaRevisaoFinanceiraCorrecaoAula" WHERE "propostaCorrecaoAulaId"=_p.id) OR _r."propostaHash" IS DISTINCT FROM NEW."propostaHash" OR q23_revisao_financeira_atores_validos_257(_r.id,_d."decisorId") IS DISTINCT FROM TRUE OR q23_foto_financeira_valida_257(_p.id,_r.fotografia,_r."fotografiaHash",_r."propostaHash",_r."versaoCorrecaoAula") IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Decisão financeira não comprova a fotografia atual'; END IF; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PropostaRevFinCorrecaoAula_validar" BEFORE INSERT OR UPDATE OR DELETE ON "PropostaRevisaoFinanceiraCorrecaoAula" FOR EACH ROW EXECUTE FUNCTION validar_proposta_revisao_financeira_correcao_aula_257();
CREATE TRIGGER "DecisaoRevFinCorrecaoAula_validar" BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoRevisaoFinanceiraCorrecaoAula" FOR EACH ROW EXECUTE FUNCTION validar_decisao_revisao_financeira_correcao_aula_257();
CREATE TRIGGER "AprovacaoCorrecaoAula_00_financeira_257" BEFORE INSERT OR UPDATE OR DELETE ON "AprovacaoCorrecaoAula" FOR EACH ROW EXECUTE FUNCTION validar_aprovacao_correcao_aula_financeira_257();
