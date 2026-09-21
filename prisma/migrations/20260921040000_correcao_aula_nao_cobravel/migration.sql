-- Q175 (decisões de 21/09/2026): correção de aula particular "não devia ser cobrada".
-- O fato é declarado na revisão financeira (tipo AULA_NAO_COBRAVEL), aprovado por Financeiro
-- independente, e aplicado na MESMA transação da aprovação acadêmica. Fatia 1: aula cobrada
-- por fechamento (sem reserva de horas pré-pagas). Conferência, item e emissão não mudam.
-- AlterTable
ALTER TABLE "CreditoMatricula" ADD COLUMN     "origemRevisaoCorrecaoAulaId" TEXT;

-- CreateTable
CREATE TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" (
    "id" TEXT NOT NULL,
    "decisaoRevisaoId" TEXT NOT NULL,
    "aprovacaoCorrecaoAulaId" TEXT NOT NULL,
    "conferenciaId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "cobrancaId" TEXT,
    "efeito" TEXT NOT NULL,
    "valorAula" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "versaoCobrancaAntes" INTEGER,
    "valorNegociadoAnterior" DECIMAL(12,2),
    "valorNegociadoNovo" DECIMAL(12,2),
    "creditoValor" DECIMAL(12,2),
    "fotografiaHash" TEXT NOT NULL,
    "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AplicacaoRevisaoFinanceiraCorrecaoAula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrigemCreditoRevisaoCorrecaoAula" (
    "id" TEXT NOT NULL,
    "aplicacaoId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrigemCreditoRevisaoCorrecaoAula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoRevisaoFinanceiraCorrecaoAula_decisaoRevisaoId_key" ON "AplicacaoRevisaoFinanceiraCorrecaoAula"("decisaoRevisaoId");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoRevisaoFinanceiraCorrecaoAula_aprovacaoCorrecaoAul_key" ON "AplicacaoRevisaoFinanceiraCorrecaoAula"("aprovacaoCorrecaoAulaId");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoRevisaoFinanceiraCorrecaoAula_conferenciaId_key" ON "AplicacaoRevisaoFinanceiraCorrecaoAula"("conferenciaId");

-- CreateIndex
CREATE INDEX "AplicacaoRevisaoFinanceiraCorrecaoAula_matriculaId_aplicada_idx" ON "AplicacaoRevisaoFinanceiraCorrecaoAula"("matriculaId", "aplicadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemCreditoRevisaoCorrecaoAula_aplicacaoId_key" ON "OrigemCreditoRevisaoCorrecaoAula"("aplicacaoId");

-- CreateIndex
CREATE INDEX "OrigemCreditoRevisaoCorrecaoAula_cobrancaId_idx" ON "OrigemCreditoRevisaoCorrecaoAula"("cobrancaId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditoMatricula_origemRevisaoCorrecaoAulaId_key" ON "CreditoMatricula"("origemRevisaoCorrecaoAulaId");

-- AddForeignKey
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" ADD CONSTRAINT "AplicacaoRevisaoFinanceiraCorrecaoAula_decisaoRevisaoId_fkey" FOREIGN KEY ("decisaoRevisaoId") REFERENCES "DecisaoRevisaoFinanceiraCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" ADD CONSTRAINT "AplicacaoRevisaoFinanceiraCorrecaoAula_aprovacaoCorrecaoAu_fkey" FOREIGN KEY ("aprovacaoCorrecaoAulaId") REFERENCES "AprovacaoCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" ADD CONSTRAINT "AplicacaoRevisaoFinanceiraCorrecaoAula_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "ConferenciaOcorrenciaHoras"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" ADD CONSTRAINT "AplicacaoRevisaoFinanceiraCorrecaoAula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" ADD CONSTRAINT "AplicacaoRevisaoFinanceiraCorrecaoAula_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemCreditoRevisaoCorrecaoAula" ADD CONSTRAINT "OrigemCreditoRevisaoCorrecaoAula_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "AplicacaoRevisaoFinanceiraCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemCreditoRevisaoCorrecaoAula" ADD CONSTRAINT "OrigemCreditoRevisaoCorrecaoAula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemCreditoRevisaoCorrecaoAula" ADD CONSTRAINT "OrigemCreditoRevisaoCorrecaoAula_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "CreditoMatricula_origemRevisaoCorrecaoAulaId_fkey" FOREIGN KEY ("origemRevisaoCorrecaoAulaId") REFERENCES "OrigemCreditoRevisaoCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


-- A revisão financeira ganha o tipo AULA_NAO_COBRAVEL; o tipo gravado e o da fotografia precisam coincidir.
ALTER TABLE "PropostaRevisaoFinanceiraCorrecaoAula" DROP CONSTRAINT "PropostaRevFinCorrecaoAula_tipo_check";
ALTER TABLE "PropostaRevisaoFinanceiraCorrecaoAula" ADD CONSTRAINT "PropostaRevFinCorrecaoAula_tipo_check"
  CHECK (("tipo" = 'SEM_ALTERACAO_VALORES' AND fotografia->>'tipo' IS NULL) OR ("tipo" = 'AULA_NAO_COBRAVEL' AND fotografia->>'tipo' = 'AULA_NAO_COBRAVEL'));
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" ADD CONSTRAINT "AplicacaoRevFinCorrecaoAula_efeito_check" CHECK (
  "valorAula" > 0 AND "fotografiaHash" ~ '^[a-f0-9]{64}$' AND (
    (efeito = 'SEM_ITEM' AND "cobrancaId" IS NULL AND "versaoCobrancaAntes" IS NULL AND "valorNegociadoAnterior" IS NULL AND "valorNegociadoNovo" IS NULL AND "creditoValor" IS NULL)
    OR (efeito = 'REDUZ_COBRANCA_ABERTA' AND "cobrancaId" IS NOT NULL AND "versaoCobrancaAntes" IS NOT NULL AND "valorNegociadoNovo" >= 0 AND "valorNegociadoNovo" = "valorNegociadoAnterior" - "valorAula" AND "creditoValor" IS NULL)
    OR (efeito = 'GERA_CREDITO' AND "cobrancaId" IS NOT NULL AND "versaoCobrancaAntes" IS NOT NULL AND "valorNegociadoAnterior" IS NOT NULL AND "valorNegociadoNovo" IS NULL AND "creditoValor" = "valorAula")));

-- Oitava origem de crédito: a exclusividade precisa conhecê-la.
ALTER TABLE "CreditoMatricula" DROP CONSTRAINT "credito_matricula_origem_unica_check";
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "credito_matricula_origem_unica_check"
  CHECK(num_nonnulls("origemLiberacaoId","origemAcertoId","origemPeriodoIntegralId","origemDestinacaoRecebimentoId","origemAcertoTaxaAditivoId","origemAcertoDesistenciaContratualId","origemReconferenciaDeltaDesistenciaId","origemRevisaoCorrecaoAulaId")=1);

-- Fotografia da correção "aula não devia ser cobrada". Mesma âncora e ordem de locks da 257/261
-- (advisory -> encontro -> matrícula -> conferência -> cobrança). O efeito é calculado aqui, nunca no Node.
CREATE FUNCTION q23_fotografia_nao_cobravel_175(_proposta_id TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE _p "PropostaCorrecaoAula"%ROWTYPE; _e "EncontroAgenda"%ROWTYPE; _d "AulaDiario"%ROWTYPE;
  _o "OcorrenciaParticular"%ROWTYPE; _c "ConferenciaOcorrenciaHoras"%ROWTYPE; _cond "CondicoesHorasMatricula"%ROWTYPE;
  _item "ItemFechamentoHoras"%ROWTYPE; _emissao "EmissaoFechamentoHoras"%ROWTYPE; _cobranca "Cobranca"%ROWTYPE;
  _efeito JSONB; _informes JSONB; _recebimentos JSONB; _destinacoes JSONB; _liquidado NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT p.* INTO _p FROM "PropostaCorrecaoAula" p WHERE p.id=_proposta_id FOR SHARE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM "RejeicaoCorrecaoAula" r WHERE r."propostaId"=_p.id)
    OR EXISTS (SELECT 1 FROM "AprovacaoCorrecaoAula" a WHERE a."propostaId"=_p.id)
    OR _p.versao IS DISTINCT FROM (SELECT max(versao) FROM "PropostaCorrecaoAula" WHERE "encontroId"=_p."encontroId") THEN RETURN NULL; END IF;
  SELECT e.* INTO _e FROM "EncontroAgenda" e WHERE e.id=_p."encontroId" FOR UPDATE;
  IF NOT FOUND OR _e."matriculaId" IS NULL OR _e.finalidade::text<>'AULA' OR _e.status::text<>'MINISTRADO' THEN RETURN NULL; END IF;
  PERFORM m.id FROM "Matricula" m WHERE m.id=_e."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT d.* INTO _d FROM "AulaDiario" d WHERE d.id=_p."diarioId" FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Aula paga com horas pré-pagas devolve minutos ao saldo: fluxo próprio, fora desta fotografia.
  IF EXISTS (SELECT 1 FROM "ReservaHorasCompradas" WHERE "encontroId"=_e.id) THEN RETURN NULL; END IF;
  SELECT * INTO _o FROM "OcorrenciaParticular" WHERE "encontroId"=_e.id AND "matriculaId"=_e."matriculaId" ORDER BY versao DESC, id DESC LIMIT 1 FOR SHARE;
  SELECT * INTO _c FROM "ConferenciaOcorrenciaHoras" WHERE "encontroId"=_e.id AND "ocorrenciaId"=_o.id FOR UPDATE;
  IF NOT FOUND OR _o.tipo NOT IN ('REALIZADA','FALTA_ALUNO') OR _c.desfecho NOT IN ('REALIZADA','FALTA_COBRAVEL') OR _c.valor IS NULL OR _c.valor<=0
    OR _c.snapshot->>'ocorrenciaId' IS DISTINCT FROM _o.id OR _c.snapshot->>'matriculaId' IS DISTINCT FROM _e."matriculaId"
    OR (_c.snapshot->>'valorApurado')::numeric IS DISTINCT FROM _c.valor
    OR EXISTS (SELECT 1 FROM "AplicacaoRevisaoFinanceiraCorrecaoAula" a WHERE a."conferenciaId"=_c.id) THEN RETURN NULL; END IF;
  SELECT * INTO _cond FROM "CondicoesHorasMatricula" WHERE id=_c."condicoesId" FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO _item FROM "ItemFechamentoHoras" WHERE "conferenciaId"=_c.id FOR SHARE;
  IF NOT FOUND THEN
    _efeito:=jsonb_build_object('tipo','SEM_ITEM','valorAula',_c.valor,'moeda',_c.moeda);
    _informes:='[]'::jsonb; _recebimentos:='[]'::jsonb; _destinacoes:='[]'::jsonb;
  ELSE
    SELECT * INTO _emissao FROM "EmissaoFechamentoHoras" WHERE id=_item."emissaoId" FOR SHARE;
    SELECT * INTO _cobranca FROM "Cobranca" WHERE id=_emissao."cobrancaId" AND "matriculaId"=_e."matriculaId" FOR UPDATE;
    IF NOT FOUND OR _cobranca.moeda IS DISTINCT FROM _c.moeda OR _item.valor IS DISTINCT FROM _c.valor OR _cobranca.status::text='CANCELADA'
      OR _cobranca."suspensaPorItemPausaId" IS NOT NULL OR _cobranca."canceladaPorPausaId" IS NOT NULL
      OR EXISTS (SELECT 1 FROM "AjusteCobrancaAcerto" aj WHERE aj."cobrancaId"=_cobranca.id) THEN RETURN NULL; END IF;
    PERFORM 1 FROM "PagamentoInformado" WHERE "cobrancaId"=_cobranca.id FOR SHARE;
    PERFORM 1 FROM "Recebimento" WHERE "cobrancaId"=_cobranca.id FOR SHARE;
    PERFORM 1 FROM "DestinacaoRecebimento" WHERE "cobrancaId"=_cobranca.id FOR SHARE;
    IF EXISTS (SELECT 1 FROM "PagamentoInformado" pi WHERE pi."cobrancaId"=_cobranca.id AND pi.status::text='A_CONFERIR') THEN RETURN NULL; END IF;
    _liquidado:=coalesce(_cobranca."valorRecebido",0)+coalesce(_cobranca."valorLiquidadoCredito",0)+coalesce(_cobranca."valorCompensadoPermuta",0);
    IF _cobranca.status::text='PAGO' AND _liquidado>=_cobranca."valorNegociado" THEN
      -- Fatura quitada permanece como está; a diferença a favor do aluno vira crédito na matrícula.
      _efeito:=jsonb_build_object('tipo','GERA_CREDITO','valorAula',_c.valor,'moeda',_c.moeda,'cobrancaId',_cobranca.id,'versaoCobranca',_cobranca.versao,'valorNegociadoAnterior',_cobranca."valorNegociado",'creditoValor',_c.valor);
    ELSIF _cobranca.status::text IN ('PENDENTE','ATRASADO') AND _liquidado=0 AND _cobranca."valorNegociado">=_c.valor
      AND NOT EXISTS (SELECT 1 FROM "PropostaUsoCredito" uc LEFT JOIN "DecisaoUsoCredito" du ON du."propostaId"=uc.id WHERE uc."cobrancaId"=_cobranca.id AND (du.id IS NULL OR du.aprovada)) THEN
      _efeito:=jsonb_build_object('tipo','REDUZ_COBRANCA_ABERTA','valorAula',_c.valor,'moeda',_c.moeda,'cobrancaId',_cobranca.id,'versaoCobranca',_cobranca.versao,'valorNegociadoAnterior',_cobranca."valorNegociado",'valorNegociadoNovo',_cobranca."valorNegociado"-_c.valor);
    ELSE
      -- Pagamento parcial, crédito ou permuta em curso exigem conferência financeira específica.
      RETURN NULL;
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',pi.id,'versao',pi.versao,'status',pi.status::text,'hashDados',pi."hashDados",'valor',pi.valor,'moeda',pi.moeda) ORDER BY pi.id),'[]'::jsonb) INTO _informes FROM "PagamentoInformado" pi WHERE pi."cobrancaId"=_cobranca.id;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'hashDados',r."hashDados",'valor',r.valor,'moeda',r.moeda,'dataPagamento',r."dataPagamento") ORDER BY r.id),'[]'::jsonb) INTO _recebimentos FROM "Recebimento" r WHERE r."cobrancaId"=_cobranca.id;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',dr.id,'recebimentoId',dr."recebimentoId",'tipo',dr.tipo::text,'valor',dr.valor) ORDER BY dr.id),'[]'::jsonb) INTO _destinacoes FROM "DestinacaoRecebimento" dr WHERE dr."cobrancaId"=_cobranca.id;
  END IF;
  RETURN jsonb_build_object('versao',1,'tipo','AULA_NAO_COBRAVEL','propostaId',_p.id,'propostaHash',_p."entradaHash",'versaoCorrecaoAula',_p.versao,'estadoHash',_p."estadoHash",
    'encontro',jsonb_build_object('id',_e.id,'matriculaId',_e."matriculaId",'status',_e.status::text,'inicio',_e.inicio,'fim',_e.fim,'professorId',_e."professorId"),
    'diario',jsonb_build_object('id',_d.id,'conteudoHash',encode(digest(_d.conteudo,'sha256'),'hex')),
    'ocorrencia',jsonb_build_object('id',_o.id,'versao',_o.versao,'tipo',_o.tipo,'inicio',_o.inicio,'fim',_o.fim,'entradaHash',_o."entradaHash"),
    'conferencia',jsonb_build_object('id',_c.id,'condicoesId',_c."condicoesId",'minutos',_c.minutos,'valor',_c.valor,'moeda',_c.moeda,'desfecho',_c.desfecho,'entradaHash',_c."entradaHash"),
    'condicoes',jsonb_build_object('id',_cond.id,'versao',_cond.versao),
    'item',CASE WHEN _item.id IS NULL THEN NULL ELSE jsonb_build_object('id',_item.id,'valor',_item.valor,'emissaoId',_item."emissaoId") END,
    'cobranca',CASE WHEN _cobranca.id IS NULL THEN NULL ELSE jsonb_build_object('id',_cobranca.id,'versao',_cobranca.versao,'valorNegociado',_cobranca."valorNegociado",'valorRecebido',_cobranca."valorRecebido",'saldo',_cobranca.saldo,'valorLiquidadoCredito',_cobranca."valorLiquidadoCredito",'valorCompensadoPermuta',_cobranca."valorCompensadoPermuta",'moeda',_cobranca.moeda,'status',_cobranca.status::text) END,
    'efeito',_efeito,'informesPagamento',_informes,'recebimentos',_recebimentos,'destinacoes',_destinacoes);
END $$;

CREATE FUNCTION q23_fotografia_nao_cobravel_materializada_175(_proposta_id TEXT)
RETURNS TABLE(fotografia JSONB, "fotografiaHash" TEXT) LANGUAGE plpgsql AS $$
BEGIN
  fotografia:=q23_fotografia_nao_cobravel_175(_proposta_id);
  IF fotografia IS NULL THEN RETURN; END IF;
  "fotografiaHash":=q23_fotografia_hash_259(fotografia);
  RETURN NEXT;
END $$;

-- Proposta, decisão e aprovação acadêmica continuam validando por aqui; só muda quem recalcula a fotografia.
CREATE OR REPLACE FUNCTION q23_foto_financeira_valida_257(_proposta_id TEXT,_foto JSONB,_hash TEXT,_proposta_hash TEXT,_versao INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$ DECLARE _atual JSONB; BEGIN
  IF _foto->>'tipo'='AULA_NAO_COBRAVEL' THEN _atual:=q23_fotografia_nao_cobravel_175(_proposta_id);
  ELSE _atual:=q23_fotografia_financeira_atual_257(_proposta_id); END IF;
  RETURN _atual IS NOT NULL AND _proposta_hash=_atual->>'propostaHash' AND _versao=(_atual->>'versaoCorrecaoAula')::INTEGER
    AND _hash=q23_fotografia_hash_259(_foto) AND q23_json_canon_259(_foto)=q23_json_canon_259(_atual);
END $$;

-- A aplicação só nasce dentro da aprovação acadêmica que consumiu a revisão aprovada, e reproduz o efeito fotografado.
CREATE FUNCTION guardar_aplicacao_nao_cobravel_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _d "DecisaoRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _r "PropostaRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _a "AprovacaoCorrecaoAula"%ROWTYPE; _ef JSONB;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação da revisão financeira é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO _d FROM "DecisaoRevisaoFinanceiraCorrecaoAula" WHERE id=NEW."decisaoRevisaoId" FOR SHARE;
  SELECT * INTO _r FROM "PropostaRevisaoFinanceiraCorrecaoAula" WHERE id=_d."propostaId" FOR SHARE;
  SELECT * INTO _a FROM "AprovacaoCorrecaoAula" WHERE id=NEW."aprovacaoCorrecaoAulaId" FOR SHARE;
  IF _d.id IS NULL OR _d.aprovada IS DISTINCT FROM TRUE OR _r.tipo<>'AULA_NAO_COBRAVEL' OR _a.id IS NULL
    OR _a."revisaoFinanceiraDecisaoId" IS DISTINCT FROM _d.id OR _a."propostaId" IS DISTINCT FROM _r."propostaCorrecaoAulaId"
    OR NEW."fotografiaHash" IS DISTINCT FROM _r."fotografiaHash" THEN RAISE EXCEPTION 'Aplicação exige a aprovação acadêmica que consumiu a revisão financeira aprovada'; END IF;
  _ef:=_r.fotografia->'efeito';
  IF NEW.efeito IS DISTINCT FROM _ef->>'tipo' OR NEW."conferenciaId" IS DISTINCT FROM _r.fotografia->'conferencia'->>'id'
    OR NEW."matriculaId" IS DISTINCT FROM _r.fotografia->'encontro'->>'matriculaId' OR NEW."cobrancaId" IS DISTINCT FROM _ef->>'cobrancaId'
    OR NEW."valorAula" IS DISTINCT FROM (_ef->>'valorAula')::numeric OR NEW.moeda IS DISTINCT FROM _ef->>'moeda'
    OR NEW."versaoCobrancaAntes" IS DISTINCT FROM (_ef->>'versaoCobranca')::integer
    OR NEW."valorNegociadoAnterior" IS DISTINCT FROM (_ef->>'valorNegociadoAnterior')::numeric
    OR NEW."valorNegociadoNovo" IS DISTINCT FROM (_ef->>'valorNegociadoNovo')::numeric
    OR NEW."creditoValor" IS DISTINCT FROM (_ef->>'creditoValor')::numeric THEN RAISE EXCEPTION 'Aplicação diverge do efeito aprovado'; END IF;
  NEW."aplicadaEm":=CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_aplicacao_nao_cobravel_175 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoRevisaoFinanceiraCorrecaoAula"
  FOR EACH ROW EXECUTE FUNCTION guardar_aplicacao_nao_cobravel_175();

CREATE FUNCTION efetivar_aplicacao_nao_cobravel_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.efeito='REDUZ_COBRANCA_ABERTA' THEN
    UPDATE "Cobranca" SET "valorNegociado"=NEW."valorNegociadoNovo", saldo=CASE WHEN saldo IS NULL THEN NULL ELSE NEW."valorNegociadoNovo" END,
      status=CASE WHEN NEW."valorNegociadoNovo"=0 THEN 'CANCELADA'::"StatusCobranca" ELSE status END, versao=versao+1
    WHERE id=NEW."cobrancaId" AND versao=NEW."versaoCobrancaAntes" AND "valorNegociado"=NEW."valorNegociadoAnterior";
    IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança mudou antes da aplicação da correção'; END IF;
  ELSIF NEW.efeito='GERA_CREDITO' THEN
    PERFORM 1 FROM "Cobranca" WHERE id=NEW."cobrancaId" AND versao=NEW."versaoCobrancaAntes" AND status='PAGO';
    IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança mudou antes da aplicação da correção'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER efetivar_aplicacao_nao_cobravel_175 AFTER INSERT ON "AplicacaoRevisaoFinanceiraCorrecaoAula"
  FOR EACH ROW EXECUTE FUNCTION efetivar_aplicacao_nao_cobravel_175();

CREATE FUNCTION guardar_origem_credito_nao_cobravel_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _a "AplicacaoRevisaoFinanceiraCorrecaoAula"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Origem de crédito da correção é imutável'; END IF;
  SELECT * INTO _a FROM "AplicacaoRevisaoFinanceiraCorrecaoAula" WHERE id=NEW."aplicacaoId" FOR SHARE;
  IF _a.id IS NULL OR _a.efeito<>'GERA_CREDITO' OR NEW."matriculaId" IS DISTINCT FROM _a."matriculaId" OR NEW."cobrancaId" IS DISTINCT FROM _a."cobrancaId"
    OR NEW.valor IS DISTINCT FROM _a."creditoValor" OR NEW.moeda IS DISTINCT FROM _a.moeda THEN RAISE EXCEPTION 'Origem de crédito diverge da aplicação da correção'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_origem_credito_nao_cobravel_175 BEFORE INSERT OR UPDATE OR DELETE ON "OrigemCreditoRevisaoCorrecaoAula"
  FOR EACH ROW EXECUTE FUNCTION guardar_origem_credito_nao_cobravel_175();

CREATE FUNCTION guardar_credito_nao_cobravel_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _o "OrigemCreditoRevisaoCorrecaoAula"%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM "OrigemCreditoRevisaoCorrecaoAula" WHERE id=NEW."origemRevisaoCorrecaoAulaId" FOR SHARE;
  IF _o.id IS NULL OR NEW."matriculaId" IS DISTINCT FROM _o."matriculaId" OR NEW."valorInicial" IS DISTINCT FROM _o.valor OR NEW.moeda IS DISTINCT FROM _o.moeda
  THEN RAISE EXCEPTION 'Crédito diverge da origem da correção de aula'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_credito_nao_cobravel_175 BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW
  WHEN (NEW."origemRevisaoCorrecaoAulaId" IS NOT NULL) EXECUTE FUNCTION guardar_credito_nao_cobravel_175();

-- Atomicidade (Q175): publicar a correção com revisão AULA_NAO_COBRAVEL e não aplicar o efeito
-- financeiro — ou deixar o crédito devido sem nascer — desfaz a transação inteira.
CREATE FUNCTION exigir_aplicacao_nao_cobravel_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _tipo TEXT; _ap "AplicacaoRevisaoFinanceiraCorrecaoAula"%ROWTYPE;
BEGIN
  IF NEW."revisaoFinanceiraDecisaoId" IS NULL THEN RETURN NULL; END IF;
  SELECT r.tipo INTO _tipo FROM "DecisaoRevisaoFinanceiraCorrecaoAula" d JOIN "PropostaRevisaoFinanceiraCorrecaoAula" r ON r.id=d."propostaId" WHERE d.id=NEW."revisaoFinanceiraDecisaoId";
  IF _tipo IS DISTINCT FROM 'AULA_NAO_COBRAVEL' THEN RETURN NULL; END IF;
  SELECT * INTO _ap FROM "AplicacaoRevisaoFinanceiraCorrecaoAula" WHERE "aprovacaoCorrecaoAulaId"=NEW.id;
  IF _ap.id IS NULL THEN RAISE EXCEPTION 'Correção de aula não cobrável exige o acerto financeiro na mesma publicação'; END IF;
  IF _ap.efeito='GERA_CREDITO' AND NOT EXISTS (SELECT 1 FROM "OrigemCreditoRevisaoCorrecaoAula" o JOIN "CreditoMatricula" c ON c."origemRevisaoCorrecaoAulaId"=o.id WHERE o."aplicacaoId"=_ap.id)
  THEN RAISE EXCEPTION 'Correção de aula não cobrável com fatura paga exige o crédito na mesma publicação'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER exigir_aplicacao_nao_cobravel_175 AFTER INSERT ON "AprovacaoCorrecaoAula"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_aplicacao_nao_cobravel_175();

-- 249: o reconhecimento de crédito na desistência enumera as origens; passa a conhecer a oitava.
CREATE OR REPLACE FUNCTION q165_delta_reconhecimento_guard_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE; cr "CreditoMatricula"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Reconhecimento de crédito é imutável'; END IF;
 SELECT * INTO a FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=NEW."aplicacaoId" FOR SHARE;
 SELECT * INTO cr FROM "CreditoMatricula" WHERE id=NEW."creditoId" FOR SHARE;
 IF a.id IS NULL OR cr.id IS NULL OR cr."matriculaId" IS DISTINCT FROM a.fotografia->>'matriculaId' OR num_nonnulls(cr."origemLiberacaoId",cr."origemAcertoId",cr."origemPeriodoIntegralId",cr."origemDestinacaoRecebimentoId",cr."origemAcertoTaxaAditivoId",cr."origemAcertoDesistenciaContratualId",cr."origemReconferenciaDeltaDesistenciaId",cr."origemRevisaoCorrecaoAulaId")<>1 OR cr."origemAcertoDesistenciaContratualId" IS NOT NULL OR cr."origemReconferenciaDeltaDesistenciaId" IS NOT NULL OR NEW.valor IS DISTINCT FROM (cr."valorInicial"-coalesce((SELECT sum(u.valor) FROM "PropostaUsoCredito" u JOIN "DecisaoUsoCredito" d ON d."propostaId"=u.id AND d.aprovada WHERE u."creditoId"=cr.id),0)-coalesce((SELECT sum(r.valor) FROM "ReservaDevolucaoCredito" r WHERE r."creditoId"=cr.id AND r.estado<>'LIBERADA'),0)) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a."memoriaDelta"->'creditosExternos') x WHERE x->>'id'=cr.id AND (x->>'saldoDisponivel')::numeric=NEW.valor AND x->>'moeda'=cr.moeda) THEN RAISE EXCEPTION 'Reconhecimento exige crédito externo da fotografia delta'; END IF;
 RETURN NEW;
END $$;
