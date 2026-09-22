-- Q172 (decisão de 21/09/2026): aplicação do aditivo de adiantamento SOMENTE enquanto o
-- adiantamento da emissão inicial não foi pago nem utilizado. Proposta do Financeiro, decisão
-- independente e aplicação pelo próprio aprovador; o trigger altera a cobrança em aberto
-- (valor, saldo, vencimento, versão). Os minutos vigentes passam a ser os da última aplicação.
-- CreateTable
CREATE TABLE "PropostaAdiantamentoAditivo" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "propostaAditivoId" TEXT NOT NULL,
    "versaoCondicoesId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versaoCobranca" INTEGER NOT NULL,
    "valorAnterior" DECIMAL(12,2) NOT NULL,
    "valorNovo" DECIMAL(12,2) NOT NULL,
    "vencimentoAnterior" TIMESTAMP(3) NOT NULL,
    "vencimentoNovo" TIMESTAMP(3) NOT NULL,
    "minutosAnteriores" INTEGER NOT NULL,
    "minutosNovos" INTEGER NOT NULL,
    "fuso" TEXT NOT NULL,
    "fotografia" JSONB NOT NULL,
    "fotografiaHash" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaAdiantamentoAditivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoAdiantamentoAditivo" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "fotografiaHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoAdiantamentoAditivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacaoAdiantamentoAditivo" (
    "id" TEXT NOT NULL,
    "decisaoId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "fotografiaHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "versaoCobrancaAntes" INTEGER NOT NULL,
    "versaoCobrancaDepois" INTEGER NOT NULL,
    "valorAnterior" DECIMAL(12,2) NOT NULL,
    "valorNovo" DECIMAL(12,2) NOT NULL,
    "vencimentoAnterior" TIMESTAMP(3) NOT NULL,
    "vencimentoNovo" TIMESTAMP(3) NOT NULL,
    "minutosAnteriores" INTEGER NOT NULL,
    "minutosNovos" INTEGER NOT NULL,
    "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AplicacaoAdiantamentoAditivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaAdiantamentoAditivo_matriculaId_criadaEm_idx" ON "PropostaAdiantamentoAditivo"("matriculaId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaAdiantamentoAditivo_preparadorId_chaveIdempotencia_key" ON "PropostaAdiantamentoAditivo"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoAdiantamentoAditivo_propostaId_key" ON "DecisaoAdiantamentoAditivo"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoAdiantamentoAditivo_decisorId_chaveIdempotencia_key" ON "DecisaoAdiantamentoAditivo"("decisorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoAdiantamentoAditivo_decisaoId_key" ON "AplicacaoAdiantamentoAditivo"("decisaoId");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoAdiantamentoAditivo_executorId_chaveIdempotencia_key" ON "AplicacaoAdiantamentoAditivo"("executorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "PropostaAdiantamentoAditivo" ADD CONSTRAINT "PropostaAdiantamentoAditivo_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaAdiantamentoAditivo" ADD CONSTRAINT "PropostaAdiantamentoAditivo_propostaAditivoId_fkey" FOREIGN KEY ("propostaAditivoId") REFERENCES "PropostaAditivoContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaAdiantamentoAditivo" ADD CONSTRAINT "PropostaAdiantamentoAditivo_versaoCondicoesId_fkey" FOREIGN KEY ("versaoCondicoesId") REFERENCES "VersaoCondicoesAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaAdiantamentoAditivo" ADD CONSTRAINT "PropostaAdiantamentoAditivo_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaAdiantamentoAditivo" ADD CONSTRAINT "PropostaAdiantamentoAditivo_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoAdiantamentoAditivo" ADD CONSTRAINT "DecisaoAdiantamentoAditivo_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaAdiantamentoAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoAdiantamentoAditivo" ADD CONSTRAINT "DecisaoAdiantamentoAditivo_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AplicacaoAdiantamentoAditivo" ADD CONSTRAINT "AplicacaoAdiantamentoAditivo_decisaoId_fkey" FOREIGN KEY ("decisaoId") REFERENCES "DecisaoAdiantamentoAditivo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AplicacaoAdiantamentoAditivo" ADD CONSTRAINT "AplicacaoAdiantamentoAditivo_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


ALTER TABLE "AplicacaoAdiantamentoAditivo" ADD CONSTRAINT "AplicacaoAdiantamentoAditivo_versao_check" CHECK ("versaoCobrancaDepois" = "versaoCobrancaAntes" + 1);
ALTER TABLE "PropostaAdiantamentoAditivo" ADD CONSTRAINT "PropostaAdiantamentoAditivo_valores_check" CHECK ("valorNovo" > 0 AND "minutosNovos" > 0 AND "minutosAnteriores" > 0);

-- Minutos vigentes do adiantamento: última aplicação de aditivo; sem ela, os da emissão inicial.
CREATE FUNCTION minutos_adiantamento_vigentes_172(matricula_id TEXT, cobranca_id TEXT) RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT a."minutosNovos" FROM "AplicacaoAdiantamentoAditivo" a JOIN "DecisaoAdiantamentoAditivo" d ON d.id=a."decisaoId"
      JOIN "PropostaAdiantamentoAditivo" p ON p.id=d."propostaId" WHERE p."cobrancaId"=cobranca_id ORDER BY a."versaoCobrancaDepois" DESC LIMIT 1),
    (SELECT (ce.dados->'adiantamentoProposto'->>'minutos')::INTEGER FROM "ItemEmissaoEntrada" i JOIN "EmissaoCobrancasEntrada" e ON e.id=i."emissaoId"
      JOIN "CondicoesEntradaPreparacao" ce ON ce.id=e."condicoesId" WHERE i."cobrancaId"=cobranca_id AND i."matriculaId"=matricula_id LIMIT 1))
$$;

CREATE FUNCTION fotografia_adiantamento_aditivo_172(versao_id TEXT, cobranca_id TEXT, fuso TEXT, valor_novo NUMERIC, vencimento_novo TIMESTAMP, minutos_novos INTEGER)
RETURNS JSONB LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('versaoCondicoesId',v.id,'propostaAditivoId',v."propostaId",'condicoesHash',v."condicoesHash",
 'conferenciaFinalId',v."conferenciaFinalId",'cobrancaId',c.id,'versaoCobranca',c.versao,'cobranca',to_jsonb(c),'fuso',fuso,
 'minutosAnteriores',minutos_adiantamento_vigentes_172(c."matriculaId",c.id),
 'valorNovo',valor_novo,'vencimentoNovo',vencimento_novo,'minutosNovos',minutos_novos)
 FROM "VersaoCondicoesAditivo" v JOIN "Cobranca" c ON c."matriculaId"=v."matriculaId"
 WHERE v.id=versao_id AND c.id=cobranca_id;
$$;

CREATE FUNCTION conferir_fonte_adiantamento_aditivo_172(p "PropostaAdiantamentoAditivo") RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE c "Cobranca"%ROWTYPE; v "VersaoCondicoesAditivo"%ROWTYPE; quantidade INTEGER; foto JSONB; minutos_atuais INTEGER;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
 SELECT * INTO c FROM "Cobranca" WHERE id=p."cobrancaId" FOR UPDATE;
 SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id=p."versaoCondicoesId";
 IF c."matriculaId" IS DISTINCT FROM p."matriculaId" OR c.tipo<>'HORA_PARTICULAR'
 OR c.versao IS DISTINCT FROM p."versaoCobranca" OR c.vencimento IS DISTINCT FROM p."vencimentoAnterior" OR c."valorNegociado" IS DISTINCT FROM p."valorAnterior"
 OR v."matriculaId" IS DISTINCT FROM p."matriculaId" OR v."propostaId" IS DISTINCT FROM p."propostaAditivoId"
 THEN RAISE EXCEPTION 'Origem ou fotografia do adiantamento divergente'; END IF;
 SELECT count(*) INTO quantidade FROM "ItemEmissaoEntrada" i JOIN "Cobranca" x ON x.id=i."cobrancaId"
 WHERE i."matriculaId"=p."matriculaId" AND x.tipo='HORA_PARTICULAR';
 IF quantidade<>1 OR NOT EXISTS (SELECT 1 FROM "ItemEmissaoEntrada" WHERE "matriculaId"=p."matriculaId" AND "cobrancaId"=c.id)
 THEN RAISE EXCEPTION 'Adiantamento exige origem de emissão inequívoca'; END IF;
 -- Q172: só alcança adiantamento ainda não pago nem utilizado.
 IF c.status NOT IN ('PENDENTE','ATRASADO') OR COALESCE(c."valorRecebido",0)<>0 OR c."valorLiquidadoCredito"<>0 OR c."pagoEm" IS NOT NULL
 OR EXISTS (SELECT 1 FROM "DestinacaoRecebimento" dr WHERE dr."cobrancaId"=c.id)
 OR EXISTS (SELECT 1 FROM "PagamentoInformado" pi WHERE pi."cobrancaId"=c.id AND pi.status='A_CONFERIR')
 OR EXISTS (SELECT 1 FROM "PropostaUsoCredito" uc LEFT JOIN "DecisaoUsoCredito" du ON du."propostaId"=uc.id WHERE uc."cobrancaId"=c.id AND (du.id IS NULL OR du.aprovada))
 OR EXISTS (SELECT 1 FROM "CompraHorasAntecipadas" ch WHERE ch."cobrancaId"=c.id)
 THEN RAISE EXCEPTION 'Adiantamento já pago, em conferência ou utilizado não admite aplicação do aditivo'; END IF;
 IF c."suspensaPorItemPausaId" IS NOT NULL OR c."canceladaPorPausaId" IS NOT NULL OR EXISTS (SELECT 1 FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId"=c.id)
 THEN RAISE EXCEPTION 'Cobrança em pausa ou acerto exige conferência específica'; END IF;
 IF EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" WHERE "matriculaId"=p."matriculaId" AND versao>v.versao)
 THEN RAISE EXCEPTION 'Versão contratual superada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "PropostaAditivoContratual" pa, jsonb_array_elements(pa.snapshot->'entrada'->'alteracoes') a
 WHERE pa.id=p."propostaAditivoId" AND a->>'origem'=ANY(ARRAY['ADIANTAMENTO_VALOR','ADIANTAMENTO_MINUTOS','ADIANTAMENTO_VENCIMENTO']))
 THEN RAISE EXCEPTION 'Condição herdada não autoriza novo acerto'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "ConferenciaFinalAditivo" f JOIN "ConclusaoAssinaturaAditivo" ca ON ca.id=f."conclusaoId"
 JOIN "ProcessoAssinaturaAditivo" pr ON pr.id=ca."processoId"
 WHERE f.id=v."conferenciaFinalId" AND pr."propostaId"=p."propostaAditivoId" AND pr.ambiente='PRODUCAO')
 THEN RAISE EXCEPTION 'Acerto exige aditivo assinado e conferido'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" posterior JOIN "PropostaAditivoContratual" origem ON origem.id=p."propostaAditivoId"
 WHERE posterior."matriculaId"=p."matriculaId" AND posterior.versao>origem.versao)
 THEN RAISE EXCEPTION 'Proposta contratual superada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=p.fuso) THEN RAISE EXCEPTION 'Fuso inválido'; END IF;
 -- Cada condição formalizada define o novo valor; condição ausente preserva o atual.
 IF v.condicoes ? 'ADIANTAMENTO_VALOR' THEN
   IF v.condicoes->'ADIANTAMENTO_VALOR'->>'tipo' IS DISTINCT FROM 'DINHEIRO' OR v.condicoes->'ADIANTAMENTO_VALOR'->>'moeda' IS DISTINCT FROM c.moeda
   OR (v.condicoes->'ADIANTAMENTO_VALOR'->>'valor')::NUMERIC IS DISTINCT FROM p."valorNovo" THEN RAISE EXCEPTION 'Valor diverge da condição contratual formalizada'; END IF;
 ELSIF p."valorNovo" IS DISTINCT FROM c."valorNegociado" THEN RAISE EXCEPTION 'Valor sem condição contratual formalizada'; END IF;
 IF v.condicoes ? 'ADIANTAMENTO_VENCIMENTO' THEN
   IF v.condicoes->'ADIANTAMENTO_VENCIMENTO'->>'tipo' IS DISTINCT FROM 'DATA'
   OR to_char(p."vencimentoNovo" AT TIME ZONE 'UTC' AT TIME ZONE p.fuso,'YYYY-MM-DD') IS DISTINCT FROM v.condicoes->'ADIANTAMENTO_VENCIMENTO'->>'data'
   THEN RAISE EXCEPTION 'Vencimento diverge da condição contratual formalizada'; END IF;
 ELSIF p."vencimentoNovo" IS DISTINCT FROM c.vencimento THEN RAISE EXCEPTION 'Vencimento sem condição contratual formalizada'; END IF;
 minutos_atuais := minutos_adiantamento_vigentes_172(p."matriculaId", c.id);
 IF minutos_atuais IS NULL OR minutos_atuais IS DISTINCT FROM p."minutosAnteriores" THEN RAISE EXCEPTION 'Minutos vigentes do adiantamento divergentes'; END IF;
 IF v.condicoes ? 'ADIANTAMENTO_MINUTOS' THEN
   IF v.condicoes->'ADIANTAMENTO_MINUTOS'->>'tipo' IS DISTINCT FROM 'MINUTOS' OR (v.condicoes->'ADIANTAMENTO_MINUTOS'->>'minutos')::INTEGER IS DISTINCT FROM p."minutosNovos"
   THEN RAISE EXCEPTION 'Minutos divergem da condição contratual formalizada'; END IF;
 ELSIF p."minutosNovos" IS DISTINCT FROM minutos_atuais THEN RAISE EXCEPTION 'Minutos sem condição contratual formalizada'; END IF;
 foto := fotografia_adiantamento_aditivo_172(v.id,c.id,p.fuso,p."valorNovo",p."vencimentoNovo",p."minutosNovos");
 IF p.fotografia IS DISTINCT FROM foto OR p."fotografiaHash" IS DISTINCT FROM encode(sha256(convert_to(p.fotografia::TEXT,'UTF8')),'hex')
 THEN RAISE EXCEPTION 'Fotografia financeira incompatível'; END IF;
END;
$$;

CREATE FUNCTION guardar_adiantamento_aditivo_172() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; p "PropostaAdiantamentoAditivo"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta e decisão de adiantamento são imutáveis'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 IF TG_TABLE_NAME='PropostaAdiantamentoAditivo' THEN
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
  IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Financeiro ativo'; END IF;
  IF EXISTS (SELECT 1 FROM "PropostaAdiantamentoAditivo" o LEFT JOIN "DecisaoAdiantamentoAditivo" d ON d."propostaId"=o.id
    LEFT JOIN "AplicacaoAdiantamentoAditivo" a ON a."decisaoId"=d.id
    WHERE o."cobrancaId"=NEW."cobrancaId" AND (d.id IS NULL OR (d.aprovada AND a.id IS NULL)))
  THEN RAISE EXCEPTION 'Já existe acerto de adiantamento em andamento para esta cobrança'; END IF;
  PERFORM conferir_fonte_adiantamento_aditivo_172(NEW);
 ELSE
  SELECT * INTO p FROM "PropostaAdiantamentoAditivo" WHERE id=NEW."propostaId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash"
  OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
  THEN RAISE EXCEPTION 'Decisão exige aprovador financeiro independente'; END IF;
  IF NEW.aprovada THEN PERFORM conferir_fonte_adiantamento_aditivo_172(p); END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guardar_proposta_adiantamento_172 BEFORE INSERT OR UPDATE OR DELETE ON "PropostaAdiantamentoAditivo" FOR EACH ROW EXECUTE FUNCTION guardar_adiantamento_aditivo_172();
CREATE TRIGGER guardar_decisao_adiantamento_172 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAdiantamentoAditivo" FOR EACH ROW EXECUTE FUNCTION guardar_adiantamento_aditivo_172();

CREATE FUNCTION guardar_aplicacao_adiantamento_172() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAdiantamentoAditivo"%ROWTYPE; d "DecisaoAdiantamentoAditivo"%ROWTYPE; u "Usuario"%ROWTYPE; vigencia TIMESTAMP;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Aplicação de adiantamento é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO d FROM "DecisaoAdiantamentoAditivo" WHERE id=NEW."decisaoId";
 SELECT * INTO p FROM "PropostaAdiantamentoAditivo" WHERE id=d."propostaId";
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
 IF d.aprovada IS DISTINCT FROM true OR u.ativo IS DISTINCT FROM true
 OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR NEW."executorId"=p."preparadorId"
 OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
 THEN RAISE EXCEPTION 'Execução exige o aprovador financeiro autorizado'; END IF;
 SELECT v."vigenciaInicio" INTO vigencia FROM "VersaoCondicoesAditivo" v WHERE v.id=p."versaoCondicoesId";
 IF vigencia IS NULL OR vigencia > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Aguarde a vigência aprovada antes de aplicar o adiantamento'; END IF;
 PERFORM conferir_fonte_adiantamento_aditivo_172(p);
 IF NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR d."fotografiaHash" IS DISTINCT FROM p."fotografiaHash"
 OR NEW."versaoCobrancaAntes" IS DISTINCT FROM p."versaoCobranca"
 OR NEW."valorAnterior" IS DISTINCT FROM p."valorAnterior" OR NEW."valorNovo" IS DISTINCT FROM p."valorNovo"
 OR NEW."vencimentoAnterior" IS DISTINCT FROM p."vencimentoAnterior" OR NEW."vencimentoNovo" IS DISTINCT FROM p."vencimentoNovo"
 OR NEW."minutosAnteriores" IS DISTINCT FROM p."minutosAnteriores" OR NEW."minutosNovos" IS DISTINCT FROM p."minutosNovos"
 THEN RAISE EXCEPTION 'Aplicação diverge da proposta aprovada'; END IF;
 NEW."aplicadaEm" := CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER guardar_aplicacao_adiantamento_172 BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoAdiantamentoAditivo"
 FOR EACH ROW EXECUTE FUNCTION guardar_aplicacao_adiantamento_172();

-- A cobrança em aberto passa ao valor e ao vencimento contratados; nada foi recebido, então saldo = valor.
CREATE FUNCTION efetivar_adiantamento_aditivo_172() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAdiantamentoAditivo"%ROWTYPE;
BEGIN
 SELECT p0.* INTO p FROM "PropostaAdiantamentoAditivo" p0
 JOIN "DecisaoAdiantamentoAditivo" d ON d."propostaId"=p0.id WHERE d.id=NEW."decisaoId";
 UPDATE "Cobranca" SET "valorNegociado"=NEW."valorNovo", saldo=CASE WHEN saldo IS NULL THEN NULL ELSE NEW."valorNovo" END,
 vencimento=NEW."vencimentoNovo", versao=NEW."versaoCobrancaDepois",
 status=CASE WHEN (NEW."vencimentoNovo" AT TIME ZONE 'UTC' AT TIME ZONE p.fuso)::date < (CURRENT_TIMESTAMP AT TIME ZONE p.fuso)::date
   THEN 'ATRASADO'::"StatusCobranca" ELSE 'PENDENTE'::"StatusCobranca" END
 WHERE id=p."cobrancaId" AND versao=NEW."versaoCobrancaAntes";
 IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança mudou antes da aplicação do adiantamento'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER efetivar_adiantamento_aditivo_172 AFTER INSERT ON "AplicacaoAdiantamentoAditivo"
 FOR EACH ROW EXECUTE FUNCTION efetivar_adiantamento_aditivo_172();

-- 231: o ramo do adiantamento passa a reconhecer a aplicação própria. Demais ramos copiados
-- integralmente da definição vigente (20260917163000).
CREATE OR REPLACE FUNCTION conferir_campos_aplicacao_direta_231(versao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE atual "VersaoCondicoesAditivo"%ROWTYPE; origem "VersaoCondicoesAditivo"%ROWTYPE; campo TEXT;
BEGIN
 SELECT * INTO atual FROM "VersaoCondicoesAditivo" WHERE id=versao_id;
 IF atual.id IS NULL THEN RAISE EXCEPTION 'Versão indisponível'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PropostaAditivoContratual" p, LATERAL jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a WHERE p.id=atual."propostaId" AND a->>'origem'=ANY(ARRAY['ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','MENSALIDADE_VALOR','HORA_VALOR','AGENDA_PARTICULAR'])) THEN RAISE EXCEPTION 'A proposta contém somente condições com aplicação própria'; END IF;
 FOR campo IN SELECT jsonb_object_keys(atual.condicoes) LOOP
   WITH RECURSIVE cadeia AS (
     SELECT v.* FROM "VersaoCondicoesAditivo" v WHERE v.id=atual.id
     UNION ALL SELECT anterior.* FROM "VersaoCondicoesAditivo" anterior JOIN cadeia c ON anterior.id=c."anteriorId" AND anterior."matriculaId"=c."matriculaId" AND anterior.versao=c.versao-1
   ) SELECT c.* INTO origem FROM cadeia c JOIN "PropostaAditivoContratual" p ON p.id=c."propostaId" AND p."matriculaId"=c."matriculaId"
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a WHERE a->>'origem'=campo AND a->'valorEstruturado'=atual.condicoes->campo)
   AND NOT EXISTS(SELECT 1 FROM cadeia nova JOIN "PropostaAditivoContratual" np ON np.id=nova."propostaId" WHERE nova.versao>c.versao AND EXISTS(SELECT 1 FROM jsonb_array_elements(np.snapshot->'entrada'->'alteracoes') na WHERE na->>'origem'=campo))
   ORDER BY c.versao DESC LIMIT 1;
   IF origem.id IS NULL THEN RAISE EXCEPTION 'Origem explícita do campo divergente'; END IF;
   IF campo='PRIMEIRA_MENSALIDADE_VENCIMENTO' THEN
     IF NOT EXISTS(SELECT 1 FROM "AplicacaoVencimentoAditivo" a JOIN "DecisaoVencimentoAditivo" d ON d.id=a."decisaoId" AND d.aprovada JOIN "PropostaVencimentoAditivo" p ON p.id=d."propostaId" WHERE p."versaoCondicoesId"=origem.id AND p."propostaAditivoId"=origem."propostaId" AND p."matriculaId"=atual."matriculaId") THEN RAISE EXCEPTION 'Vencimento exige aplicação própria'; END IF;
   ELSIF campo = ANY(ARRAY['COBERTURA_INICIO','COBERTURA_FIM']) THEN
     IF NOT EXISTS (
       SELECT 1 FROM "ConjuntoImpactosCoberturaAditivo" c
       JOIN "DecisaoConjuntoImpactosCoberturaAditivo" d ON d."conjuntoId"=c.id AND d.aprovada AND d."decisorId"<>c."preparadorId" AND d."fotografiaHash"=c."fotografiaHash"
       WHERE c.status='COMPLETO' AND c."versaoCondicoesId"=origem.id AND c."propostaAditivoId"=origem."propostaId" AND c."matriculaId"=atual."matriculaId"
     ) THEN RAISE EXCEPTION 'Cobertura exige conjunto de impactos completo'; END IF;
   ELSIF campo = ANY(ARRAY['TAXA_VALOR','TAXA_VENCIMENTO']) THEN
     IF NOT EXISTS (
       SELECT 1 FROM "ConjuntoImpactosTaxaAditivo" c
       JOIN "DecisaoConjuntoImpactosTaxaAditivo" d ON d."conjuntoId"=c.id AND d.aprovada AND d."fotografiaHash"=c."fotografiaHash" AND d."decisorId"<>c."preparadorId"
       WHERE c.status='COMPLETO' AND c."versaoCondicoesId"=origem.id
         AND c."propostaAditivoId"=origem."propostaId" AND c."matriculaId"=atual."matriculaId"
     ) THEN RAISE EXCEPTION 'Taxa exige conjunto de impactos completo'; END IF;
   ELSIF campo = ANY(ARRAY['ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','MENSALIDADE_VALOR','HORA_VALOR','AGENDA_PARTICULAR']) THEN
     IF origem.id<>atual.id AND NOT EXISTS(SELECT 1 FROM "AplicacaoCondicoesAditivo" a WHERE a."versaoCondicoesId"=origem.id AND a."condicoesHash"=origem."condicoesHash" AND a."matriculaId"=atual."matriculaId") THEN RAISE EXCEPTION 'Campo herdado aguarda aplicação da origem'; END IF;
   ELSIF campo = ANY(ARRAY['ADIANTAMENTO_VALOR','ADIANTAMENTO_MINUTOS','ADIANTAMENTO_VENCIMENTO']) THEN
     IF NOT EXISTS(SELECT 1 FROM "AplicacaoAdiantamentoAditivo" a JOIN "DecisaoAdiantamentoAditivo" d ON d.id=a."decisaoId" AND d.aprovada
       JOIN "PropostaAdiantamentoAditivo" p ON p.id=d."propostaId" WHERE p."versaoCondicoesId"=origem.id AND p."propostaAditivoId"=origem."propostaId" AND p."matriculaId"=atual."matriculaId")
     THEN RAISE EXCEPTION 'Adiantamento exige aplicação financeira própria'; END IF;
   ELSE RAISE EXCEPTION 'Condição financeira exige fluxo próprio antes da aplicação';
   END IF;
 END LOOP;
END $$;
