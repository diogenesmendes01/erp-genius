-- Q175 fatia 2 (decisão de 21/09/2026): aula particular paga com HORAS PRÉ-PAGAS e declarada não
-- cobrável devolve os minutos à própria compra. Reserva e consumo permanecem imutáveis; o estorno
-- é o fato novo. Todo cálculo de saldo passa a ignorar o consumo estornado, como já faz com a
-- liberação para remarcação. Nenhum dinheiro se move. Não há prazo de validade de horas no sistema (Q96).
-- AlterTable
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" ADD COLUMN     "minutosDevolvidos" INTEGER,
ALTER COLUMN "conferenciaId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EstornoConsumoHorasCompradas" (
    "id" TEXT NOT NULL,
    "consumoId" TEXT NOT NULL,
    "aplicacaoId" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstornoConsumoHorasCompradas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstornoConsumoHorasCompradas_consumoId_key" ON "EstornoConsumoHorasCompradas"("consumoId");

-- CreateIndex
CREATE UNIQUE INDEX "EstornoConsumoHorasCompradas_aplicacaoId_key" ON "EstornoConsumoHorasCompradas"("aplicacaoId");

-- CreateIndex
CREATE INDEX "EstornoConsumoHorasCompradas_compraId_idx" ON "EstornoConsumoHorasCompradas"("compraId");

-- AddForeignKey
ALTER TABLE "EstornoConsumoHorasCompradas" ADD CONSTRAINT "EstornoConsumoHorasCompradas_consumoId_fkey" FOREIGN KEY ("consumoId") REFERENCES "ConsumoHorasCompradas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstornoConsumoHorasCompradas" ADD CONSTRAINT "EstornoConsumoHorasCompradas_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "AplicacaoRevisaoFinanceiraCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstornoConsumoHorasCompradas" ADD CONSTRAINT "EstornoConsumoHorasCompradas_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "CompraHorasAntecipadas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


-- A aplicação passa a admitir o efeito DEVOLVE_MINUTOS: sem cobrança, sem dinheiro, só minutos.
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" DROP CONSTRAINT "AplicacaoRevFinCorrecaoAula_efeito_check";
ALTER TABLE "AplicacaoRevisaoFinanceiraCorrecaoAula" ADD CONSTRAINT "AplicacaoRevFinCorrecaoAula_efeito_check" CHECK (
  "fotografiaHash" ~ '^[a-f0-9]{64}$' AND (
    (efeito = 'SEM_ITEM' AND "valorAula" > 0 AND "conferenciaId" IS NOT NULL AND "minutosDevolvidos" IS NULL AND "cobrancaId" IS NULL AND "versaoCobrancaAntes" IS NULL AND "valorNegociadoAnterior" IS NULL AND "valorNegociadoNovo" IS NULL AND "creditoValor" IS NULL)
    OR (efeito = 'REDUZ_COBRANCA_ABERTA' AND "valorAula" > 0 AND "conferenciaId" IS NOT NULL AND "minutosDevolvidos" IS NULL AND "cobrancaId" IS NOT NULL AND "versaoCobrancaAntes" IS NOT NULL AND "valorNegociadoNovo" >= 0 AND "valorNegociadoNovo" = "valorNegociadoAnterior" - "valorAula" AND "creditoValor" IS NULL)
    OR (efeito = 'GERA_CREDITO' AND "valorAula" > 0 AND "conferenciaId" IS NOT NULL AND "minutosDevolvidos" IS NULL AND "cobrancaId" IS NOT NULL AND "versaoCobrancaAntes" IS NOT NULL AND "valorNegociadoAnterior" IS NOT NULL AND "valorNegociadoNovo" IS NULL AND "creditoValor" = "valorAula")
    OR (efeito = 'DEVOLVE_MINUTOS' AND "valorAula" = 0 AND "minutosDevolvidos" > 0 AND "cobrancaId" IS NULL AND "versaoCobrancaAntes" IS NULL AND "valorNegociadoAnterior" IS NULL AND "valorNegociadoNovo" IS NULL AND "creditoValor" IS NULL)));
ALTER TABLE "EstornoConsumoHorasCompradas" ADD CONSTRAINT "EstornoConsumoHoras_minutos_check" CHECK (minutos > 0);

-- Ramo com reserva de horas pré-pagas já consumida. Mesma ordem de locks da 257 vigente:
-- advisory -> proposta -> encontro -> matrícula -> reserva -> consumo -> compra.
CREATE FUNCTION q23_fotografia_nao_cobravel_reserva_175(_proposta_id TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE _p "PropostaCorrecaoAula"%ROWTYPE; _e "EncontroAgenda"%ROWTYPE; _d "AulaDiario"%ROWTYPE;
  _res "ReservaHorasCompradas"%ROWTYPE; _con "ConsumoHorasCompradas"%ROWTYPE; _cmp "CompraHorasAntecipadas"%ROWTYPE;
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
  IF (SELECT count(*) FROM "ReservaHorasCompradas" r WHERE r."encontroId"=_e.id)<>1 THEN RETURN NULL; END IF;
  SELECT r.* INTO _res FROM "ReservaHorasCompradas" r WHERE r."encontroId"=_e.id FOR UPDATE;
  SELECT c.* INTO _con FROM "ConsumoHorasCompradas" c WHERE c."reservaId"=_res.id FOR UPDATE;
  SELECT c.* INTO _cmp FROM "CompraHorasAntecipadas" c WHERE c.id=_res."compraId" FOR UPDATE;
  SELECT d.* INTO _d FROM "AulaDiario" d WHERE d.id=_p."diarioId" FOR SHARE;
  IF _con.id IS NULL OR _cmp.id IS NULL OR _d.id IS NULL OR _cmp."matriculaId" IS DISTINCT FROM _e."matriculaId"
    OR _res.inicio IS DISTINCT FROM _e.inicio OR _res.fim IS DISTINCT FROM _e.fim
    OR _res.minutos IS DISTINCT FROM extract(epoch FROM (_e.fim-_e.inicio))::integer/60
    OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" l WHERE l."reservaId"=_res.id AND l.aprovada)
    OR EXISTS (SELECT 1 FROM "EstornoConsumoHorasCompradas" es WHERE es."consumoId"=_con.id)
    -- Compra já liquidada no encerramento não recebe minutos de volta.
    OR EXISTS (SELECT 1 FROM "LiquidacaoHorasAcerto" lq WHERE lq."compraId"=_cmp.id) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('versao',1,'tipo','AULA_NAO_COBRAVEL','propostaId',_p.id,'propostaHash',_p."entradaHash",'versaoCorrecaoAula',_p.versao,'estadoHash',_p."estadoHash",
    'encontro',jsonb_build_object('id',_e.id,'matriculaId',_e."matriculaId",'status',_e.status::text,'inicio',_e.inicio,'fim',_e.fim,'professorId',_e."professorId"),
    'diario',jsonb_build_object('id',_d.id,'conteudoHash',encode(digest(_d.conteudo,'sha256'),'hex')),
    'conferencia',CASE WHEN _con."conferenciaOcorrenciaId" IS NULL THEN NULL ELSE jsonb_build_object('id',_con."conferenciaOcorrenciaId") END,
    'reservaConsumida',jsonb_build_object('id',_res.id,'minutos',_res.minutos,'inicio',_res.inicio,'fim',_res.fim,'consumoId',_con.id,'conferenciaOcorrenciaId',_con."conferenciaOcorrenciaId"),
    'compraAntecipada',jsonb_build_object('id',_cmp.id,'cobrancaId',_cmp."cobrancaId",'minutosComprados',_cmp."minutosComprados",'valorPagoAlocado',_cmp."valorPagoAlocado",'moeda',_cmp.moeda,'entradaHash',_cmp."entradaHash"),
    'cobranca',NULL,'item',NULL,
    'efeito',jsonb_build_object('tipo','DEVOLVE_MINUTOS','valorAula',0,'moeda',_cmp.moeda,'reservaId',_res.id,'consumoId',_con.id,'compraId',_cmp.id,'minutos',_res.minutos),
    'informesPagamento','[]'::jsonb,'recebimentos','[]'::jsonb,'destinacoes','[]'::jsonb);
END $$;

-- O estorno só nasce da aplicação DEVOLVE_MINUTOS aprovada, para o consumo que ela fotografou.
CREATE FUNCTION guardar_estorno_consumo_horas_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _a "AplicacaoRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _r "PropostaRevisaoFinanceiraCorrecaoAula"%ROWTYPE; _ef JSONB;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Estorno de consumo de horas é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO _a FROM "AplicacaoRevisaoFinanceiraCorrecaoAula" WHERE id=NEW."aplicacaoId" FOR SHARE;
  SELECT r.* INTO _r FROM "DecisaoRevisaoFinanceiraCorrecaoAula" d JOIN "PropostaRevisaoFinanceiraCorrecaoAula" r ON r.id=d."propostaId" WHERE d.id=_a."decisaoRevisaoId";
  _ef:=_r.fotografia->'efeito';
  PERFORM 1 FROM "CompraHorasAntecipadas" WHERE id=NEW."compraId" FOR UPDATE;
  IF _a.id IS NULL OR _a.efeito<>'DEVOLVE_MINUTOS' OR NEW."consumoId" IS DISTINCT FROM _ef->>'consumoId' OR NEW."compraId" IS DISTINCT FROM _ef->>'compraId'
    OR NEW.minutos IS DISTINCT FROM (_ef->>'minutos')::integer OR NEW.minutos IS DISTINCT FROM _a."minutosDevolvidos"
    OR EXISTS (SELECT 1 FROM "LiquidacaoHorasAcerto" lq WHERE lq."compraId"=NEW."compraId")
  THEN RAISE EXCEPTION 'Estorno diverge da aplicação aprovada ou a compra já foi liquidada'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_estorno_consumo_horas_175 BEFORE INSERT OR UPDATE OR DELETE ON "EstornoConsumoHorasCompradas"
  FOR EACH ROW EXECUTE FUNCTION guardar_estorno_consumo_horas_175();

-- Definições vigentes copiadas integralmente, com o tratamento do estorno acrescentado.
CREATE OR REPLACE FUNCTION proteger_reserva_horas_compradas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE compra "CompraHorasAntecipadas"; encontro "EncontroAgenda"; reservado BIGINT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Reserva de horas preservada; alteração exige fluxo próprio'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
 SELECT * INTO compra FROM "CompraHorasAntecipadas" WHERE id = NEW."compraId" FOR UPDATE;
 SELECT * INTO encontro FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR SHARE;
 IF compra.id IS NULL OR encontro.id IS NULL OR encontro."matriculaId" IS DISTINCT FROM compra."matriculaId" OR encontro.status <> 'PREVISTO' OR encontro.inicio <= CURRENT_TIMESTAMP OR NEW.inicio IS DISTINCT FROM encontro.inicio OR NEW.fim IS DISTINCT FROM encontro.fim OR EXTRACT(EPOCH FROM (NEW.fim - NEW.inicio)) <> NEW.minutos * 60 THEN RAISE EXCEPTION 'Reserva incompatível com o encontro e a compra'; END IF;
 SELECT coalesce(sum(r.minutos),0) INTO reservado FROM "ReservaHorasCompradas" r WHERE r."compraId" = compra.id AND NOT EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" d WHERE d."reservaId" = r.id AND d.aprovada AND EXISTS (SELECT 1 FROM "PropostaLiberacaoHoras" p WHERE p.id = d."propostaId" AND p.destino = 'REMARCACAO'))
   AND NOT EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" co JOIN "EstornoConsumoHorasCompradas" es ON es."consumoId" = co.id WHERE co."reservaId" = r.id);
 IF reservado + NEW.minutos > compra."minutosComprados" THEN RAISE EXCEPTION 'Saldo de horas insuficiente'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION conferir_liquidacao_horas_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "CompraHorasAntecipadas"; s JSONB; consumidos BIGINT; liquidados BIGINT; anterior NUMERIC; pendentes BIGINT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO c FROM "CompraHorasAntecipadas" WHERE id=NEW."compraId" FOR UPDATE;
 SELECT r.snapshot INTO s FROM "DecisaoAcertoEncerramento" d JOIN "RascunhoAcertoEncerramento" r ON r.id=d."rascunhoId" WHERE d.id=NEW."decisaoId" AND d.aprovada;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s->'contratos') ct, jsonb_array_elements(ct->'lancamentos'->'plano'->'horasALiquidar') h
  WHERE ct->'lancamentos'->'plano'->>'matriculaId'=c."matriculaId" AND ct->'lancamentos'->'plano'->>'moeda'=c.moeda
  AND h->>'compraId'=c.id AND (h->>'minutos')::integer=NEW.minutos AND (h->>'valor')::numeric=NEW.valor)
 THEN RAISE EXCEPTION 'Liquidação de horas diverge do plano aprovado'; END IF;
 SELECT coalesce(sum(r.minutos),0) INTO consumidos FROM "ReservaHorasCompradas" r JOIN "ConsumoHorasCompradas" co ON co."reservaId"=r.id WHERE r."compraId"=c.id
  AND NOT EXISTS (SELECT 1 FROM "EstornoConsumoHorasCompradas" es WHERE es."consumoId"=co.id);
 SELECT coalesce(sum(r.minutos),0), coalesce(sum(cr."valorInicial"),0) INTO liquidados, anterior
 FROM "ReservaHorasCompradas" r JOIN "DecisaoLiberacaoHoras" d ON d."reservaId"=r.id AND d.aprovada
 JOIN "PropostaLiberacaoHoras" p ON p.id=d."propostaId" AND p.destino='CREDITO'
 JOIN "CreditoMatricula" cr ON cr."origemLiberacaoId"=d.id WHERE r."compraId"=c.id;
 SELECT count(*) INTO pendentes FROM "ReservaHorasCompradas" r WHERE r."compraId"=c.id
 AND NOT EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" co WHERE co."reservaId"=r.id)
 AND NOT EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" d WHERE d."reservaId"=r.id AND d.aprovada);
 IF pendentes > 0 OR NEW.minutos <> c."minutosComprados"-consumidos-liquidados
 OR NEW.valor <> round(c."valorPagoAlocado"*(c."minutosComprados"-consumidos)/c."minutosComprados",2)-anterior
 THEN RAISE EXCEPTION 'Saldo de horas mudou ou possui reservas pendentes'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION q23_fotografia_nao_cobravel_175(_proposta_id TEXT)
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
  IF EXISTS (SELECT 1 FROM "ReservaHorasCompradas" WHERE "encontroId"=_e.id) THEN RETURN q23_fotografia_nao_cobravel_reserva_175(_proposta_id); END IF;
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

CREATE OR REPLACE FUNCTION guardar_aplicacao_nao_cobravel_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
    OR NEW."creditoValor" IS DISTINCT FROM (_ef->>'creditoValor')::numeric
    OR NEW."minutosDevolvidos" IS DISTINCT FROM (_ef->>'minutos')::integer THEN RAISE EXCEPTION 'Aplicação diverge do efeito aprovado'; END IF;
  NEW."aplicadaEm":=CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION exigir_aplicacao_nao_cobravel_175() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _tipo TEXT; _ap "AplicacaoRevisaoFinanceiraCorrecaoAula"%ROWTYPE;
BEGIN
  IF NEW."revisaoFinanceiraDecisaoId" IS NULL THEN RETURN NULL; END IF;
  SELECT r.tipo INTO _tipo FROM "DecisaoRevisaoFinanceiraCorrecaoAula" d JOIN "PropostaRevisaoFinanceiraCorrecaoAula" r ON r.id=d."propostaId" WHERE d.id=NEW."revisaoFinanceiraDecisaoId";
  IF _tipo IS DISTINCT FROM 'AULA_NAO_COBRAVEL' THEN RETURN NULL; END IF;
  SELECT * INTO _ap FROM "AplicacaoRevisaoFinanceiraCorrecaoAula" WHERE "aprovacaoCorrecaoAulaId"=NEW.id;
  IF _ap.id IS NULL THEN RAISE EXCEPTION 'Correção de aula não cobrável exige o acerto financeiro na mesma publicação'; END IF;
  IF _ap.efeito='GERA_CREDITO' AND NOT EXISTS (SELECT 1 FROM "OrigemCreditoRevisaoCorrecaoAula" o JOIN "CreditoMatricula" c ON c."origemRevisaoCorrecaoAulaId"=o.id WHERE o."aplicacaoId"=_ap.id)
  THEN RAISE EXCEPTION 'Correção de aula não cobrável com fatura paga exige o crédito na mesma publicação'; END IF;
  IF _ap.efeito='DEVOLVE_MINUTOS' AND NOT EXISTS (SELECT 1 FROM "EstornoConsumoHorasCompradas" es WHERE es."aplicacaoId"=_ap.id)
  THEN RAISE EXCEPTION 'Correção de aula não cobrável paga com horas pré-pagas exige o estorno dos minutos na mesma publicação'; END IF;
  RETURN NULL;
END $$;
