-- Q167C/Q171 (decisões de 21/09/2026): destinação NEGOCIADA do excedente de permuta. Financeiro propõe,
-- registram-se as concordâncias do aluno (ou responsável) e da escola, outro aprovador financeiro decide, e os
-- destinos escolhidos no acordo nascem na mesma transação: saldo restrito a serviços e/ou crédito financeiro.
-- Nada é convertido automaticamente; o mesmo excedente não pode ser destinado duas vezes.
-- AlterTable
ALTER TABLE "CreditoMatricula" ADD COLUMN     "origemExcedentePermutaId" TEXT;

-- CreateTable
CREATE TABLE "PropostaDestinacaoExcedentePermuta" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "versaoCobranca" INTEGER NOT NULL,
    "moeda" TEXT NOT NULL,
    "valorDevidoAcordado" DECIMAL(12,2) NOT NULL,
    "valorExcedente" DECIMAL(12,2) NOT NULL,
    "fotografia" JSONB NOT NULL,
    "fotografiaHash" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaDestinacaoExcedentePermuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrigemExcedentePermuta" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "aplicacaoPermutaId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrigemExcedentePermuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDestinacaoExcedentePermuta" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ItemDestinacaoExcedentePermuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcordanciaDestinacaoExcedentePermuta" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "parte" TEXT NOT NULL,
    "nomeDeclarante" TEXT NOT NULL,
    "meio" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "registradaPorId" TEXT NOT NULL,
    "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConcordanciaDestinacaoExcedentePermuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoDestinacaoExcedentePermuta" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "fotografiaHash" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoDestinacaoExcedentePermuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoServicoPermuta" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "decisaoId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "moeda" TEXT NOT NULL,
    "valorInicial" DECIMAL(12,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaldoServicoPermuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrigemCreditoExcedentePermuta" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "decisaoId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrigemCreditoExcedentePermuta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaDestinacaoExcedentePermuta_cobrancaId_criadaEm_idx" ON "PropostaDestinacaoExcedentePermuta"("cobrancaId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaDestinacaoExcedentePermuta_preparadorId_chaveIdempo_key" ON "PropostaDestinacaoExcedentePermuta"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE INDEX "OrigemExcedentePermuta_aplicacaoPermutaId_idx" ON "OrigemExcedentePermuta"("aplicacaoPermutaId");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemExcedentePermuta_propostaId_aplicacaoPermutaId_key" ON "OrigemExcedentePermuta"("propostaId", "aplicacaoPermutaId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemDestinacaoExcedentePermuta_propostaId_tipo_key" ON "ItemDestinacaoExcedentePermuta"("propostaId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "ConcordanciaDestinacaoExcedentePermuta_propostaId_parte_key" ON "ConcordanciaDestinacaoExcedentePermuta"("propostaId", "parte");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoDestinacaoExcedentePermuta_propostaId_key" ON "DecisaoDestinacaoExcedentePermuta"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoServicoPermuta_itemId_key" ON "SaldoServicoPermuta"("itemId");

-- CreateIndex
CREATE INDEX "SaldoServicoPermuta_matriculaId_idx" ON "SaldoServicoPermuta"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemCreditoExcedentePermuta_itemId_key" ON "OrigemCreditoExcedentePermuta"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditoMatricula_origemExcedentePermutaId_key" ON "CreditoMatricula"("origemExcedentePermutaId");

-- AddForeignKey
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "CreditoMatricula_origemExcedentePermutaId_fkey" FOREIGN KEY ("origemExcedentePermutaId") REFERENCES "OrigemCreditoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaDestinacaoExcedentePermuta" ADD CONSTRAINT "PropostaDestinacaoExcedentePermuta_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaDestinacaoExcedentePermuta" ADD CONSTRAINT "PropostaDestinacaoExcedentePermuta_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaDestinacaoExcedentePermuta" ADD CONSTRAINT "PropostaDestinacaoExcedentePermuta_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemExcedentePermuta" ADD CONSTRAINT "OrigemExcedentePermuta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaDestinacaoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemExcedentePermuta" ADD CONSTRAINT "OrigemExcedentePermuta_aplicacaoPermutaId_fkey" FOREIGN KEY ("aplicacaoPermutaId") REFERENCES "AplicacaoCompensacaoPermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ItemDestinacaoExcedentePermuta" ADD CONSTRAINT "ItemDestinacaoExcedentePermuta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaDestinacaoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConcordanciaDestinacaoExcedentePermuta" ADD CONSTRAINT "ConcordanciaDestinacaoExcedentePermuta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaDestinacaoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConcordanciaDestinacaoExcedentePermuta" ADD CONSTRAINT "ConcordanciaDestinacaoExcedentePermuta_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoDestinacaoExcedentePermuta" ADD CONSTRAINT "DecisaoDestinacaoExcedentePermuta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaDestinacaoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoDestinacaoExcedentePermuta" ADD CONSTRAINT "DecisaoDestinacaoExcedentePermuta_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaldoServicoPermuta" ADD CONSTRAINT "SaldoServicoPermuta_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemDestinacaoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaldoServicoPermuta" ADD CONSTRAINT "SaldoServicoPermuta_decisaoId_fkey" FOREIGN KEY ("decisaoId") REFERENCES "DecisaoDestinacaoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaldoServicoPermuta" ADD CONSTRAINT "SaldoServicoPermuta_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemCreditoExcedentePermuta" ADD CONSTRAINT "OrigemCreditoExcedentePermuta_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemDestinacaoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemCreditoExcedentePermuta" ADD CONSTRAINT "OrigemCreditoExcedentePermuta_decisaoId_fkey" FOREIGN KEY ("decisaoId") REFERENCES "DecisaoDestinacaoExcedentePermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemCreditoExcedentePermuta" ADD CONSTRAINT "OrigemCreditoExcedentePermuta_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrigemCreditoExcedentePermuta" ADD CONSTRAINT "OrigemCreditoExcedentePermuta_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


ALTER TABLE "PropostaDestinacaoExcedentePermuta" ADD CONSTRAINT "PropDestExcedentePermuta_valores_check" CHECK ("valorExcedente" > 0 AND "valorDevidoAcordado" >= 0 AND "fotografiaHash" ~ '^[a-f0-9]{64}$' AND "entradaHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "OrigemExcedentePermuta" ADD CONSTRAINT "OrigemExcedentePermuta_valor_check" CHECK (valor > 0);
ALTER TABLE "ItemDestinacaoExcedentePermuta" ADD CONSTRAINT "ItemDestExcedentePermuta_check" CHECK (valor > 0 AND tipo IN ('SALDO_SERVICOS','CREDITO_FINANCEIRO'));
ALTER TABLE "ConcordanciaDestinacaoExcedentePermuta" ADD CONSTRAINT "ConcordanciaDestExcedentePermuta_check" CHECK (
  parte IN ('ALUNO_OU_RESPONSAVEL','ESCOLA') AND length(trim("nomeDeclarante")) BETWEEN 2 AND 200 AND length(trim(meio)) BETWEEN 2 AND 100 AND length(trim(evidencia)) BETWEEN 5 AND 4000);

-- Nona origem de crédito.
ALTER TABLE "CreditoMatricula" DROP CONSTRAINT "credito_matricula_origem_unica_check";
ALTER TABLE "CreditoMatricula" ADD CONSTRAINT "credito_matricula_origem_unica_check"
  CHECK(num_nonnulls("origemLiberacaoId","origemAcertoId","origemPeriodoIntegralId","origemDestinacaoRecebimentoId","origemAcertoTaxaAditivoId","origemAcertoDesistenciaContratualId","origemReconferenciaDeltaDesistenciaId","origemRevisaoCorrecaoAulaId","origemExcedentePermutaId")=1);

CREATE FUNCTION guardar_destinacao_excedente_permuta_171() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; p "PropostaDestinacaoExcedentePermuta"%ROWTYPE; c "Cobranca"%ROWTYPE; ap "AplicacaoCompensacaoPermuta"%ROWTYPE; usado NUMERIC;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Registros da destinação do excedente de permuta são imutáveis'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  IF TG_TABLE_NAME='PropostaDestinacaoExcedentePermuta' THEN
    PERFORM id FROM "Matricula" WHERE id=NEW."matriculaId" FOR UPDATE;
    SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
    SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
    IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Financeiro ativo'; END IF;
    IF c.id IS NULL OR c."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR c.versao IS DISTINCT FROM NEW."versaoCobranca" OR c.moeda IS DISTINCT FROM NEW.moeda
      OR c."valorCompensadoPermuta" <= 0 THEN RAISE EXCEPTION 'Cobrança incompatível, desatualizada ou sem compensação por permuta'; END IF;
    IF EXISTS (SELECT 1 FROM "PropostaDestinacaoExcedentePermuta" o LEFT JOIN "DecisaoDestinacaoExcedentePermuta" d ON d."propostaId"=o.id WHERE o."cobrancaId"=NEW."cobrancaId" AND d.id IS NULL)
    THEN RAISE EXCEPTION 'Já existe destinação de excedente aguardando decisão para esta cobrança'; END IF;
    -- O cálculo do excedente não conhece destinações anteriores: uma segunda destinação contaria o mesmo excedente de novo.
    IF EXISTS (SELECT 1 FROM "PropostaDestinacaoExcedentePermuta" o JOIN "DecisaoDestinacaoExcedentePermuta" d ON d."propostaId"=o.id AND d.aprovada WHERE o."cobrancaId"=NEW."cobrancaId")
    THEN RAISE EXCEPTION 'Esta cobrança já possui destinação de excedente aprovada; nova redução exige conferência específica'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO p FROM "PropostaDestinacaoExcedentePermuta" WHERE id=NEW."propostaId" FOR UPDATE;
  IF p.id IS NULL OR EXISTS (SELECT 1 FROM "DecisaoDestinacaoExcedentePermuta" d WHERE d."propostaId"=p.id) THEN RAISE EXCEPTION 'A proposta de destinação não admite novos registros'; END IF;
  IF TG_TABLE_NAME='OrigemExcedentePermuta' THEN
    SELECT * INTO ap FROM "AplicacaoCompensacaoPermuta" WHERE id=NEW."aplicacaoPermutaId" FOR SHARE;
    -- O mesmo serviço não pode ser destinado duas vezes: soma das destinações aprovadas por aplicação <= valor aplicado.
    SELECT coalesce(sum(o.valor),0) INTO usado FROM "OrigemExcedentePermuta" o JOIN "DecisaoDestinacaoExcedentePermuta" d ON d."propostaId"=o."propostaId" AND d.aprovada WHERE o."aplicacaoPermutaId"=ap.id;
    IF ap.id IS NULL OR ap."cobrancaId" IS DISTINCT FROM p."cobrancaId" OR usado+NEW.valor>ap.valor THEN RAISE EXCEPTION 'Origem do excedente diverge da compensação de permuta ou já foi destinada'; END IF;
  ELSIF TG_TABLE_NAME='ConcordanciaDestinacaoExcedentePermuta' THEN
    SELECT * INTO u FROM "Usuario" WHERE id=NEW."registradaPorId" FOR SHARE;
    IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR','SECRETARIA_ACADEMICA']::"Papel"[]) THEN RAISE EXCEPTION 'Concordância exige equipe autorizada'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_proposta_destinacao_excedente_171 BEFORE INSERT OR UPDATE OR DELETE ON "PropostaDestinacaoExcedentePermuta" FOR EACH ROW EXECUTE FUNCTION guardar_destinacao_excedente_permuta_171();
CREATE TRIGGER guardar_origem_excedente_171 BEFORE INSERT OR UPDATE OR DELETE ON "OrigemExcedentePermuta" FOR EACH ROW EXECUTE FUNCTION guardar_destinacao_excedente_permuta_171();
CREATE TRIGGER guardar_item_destinacao_excedente_171 BEFORE INSERT OR UPDATE OR DELETE ON "ItemDestinacaoExcedentePermuta" FOR EACH ROW EXECUTE FUNCTION guardar_destinacao_excedente_permuta_171();
CREATE TRIGGER guardar_concordancia_excedente_171 BEFORE INSERT OR UPDATE OR DELETE ON "ConcordanciaDestinacaoExcedentePermuta" FOR EACH ROW EXECUTE FUNCTION guardar_destinacao_excedente_permuta_171();

CREATE FUNCTION guardar_decisao_destinacao_excedente_171() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; p "PropostaDestinacaoExcedentePermuta"%ROWTYPE; c "Cobranca"%ROWTYPE; ap RECORD;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão da destinação do excedente é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO p FROM "PropostaDestinacaoExcedentePermuta" WHERE id=NEW."propostaId" FOR UPDATE;
  PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
  SELECT * INTO c FROM "Cobranca" WHERE id=p."cobrancaId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR u.id IS NULL OR NOT u.ativo
    OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
  THEN RAISE EXCEPTION 'Decisão exige aprovador financeiro independente'; END IF;
  IF NOT NEW.aprovada THEN RETURN NEW; END IF;
  IF c.versao IS DISTINCT FROM p."versaoCobranca" THEN RAISE EXCEPTION 'A cobrança mudou depois da proposta; prepare nova destinação'; END IF;
  -- Q167C: sem a concordância das duas partes o excedente permanece pendente.
  IF (SELECT count(*) FROM "ConcordanciaDestinacaoExcedentePermuta" k WHERE k."propostaId"=p.id)<>2 THEN RAISE EXCEPTION 'A destinação exige a concordância do aluno ou responsável e da escola'; END IF;
  IF (SELECT coalesce(sum(valor),0) FROM "ItemDestinacaoExcedentePermuta" WHERE "propostaId"=p.id) IS DISTINCT FROM p."valorExcedente"
    OR (SELECT coalesce(sum(valor),0) FROM "OrigemExcedentePermuta" WHERE "propostaId"=p.id) IS DISTINCT FROM p."valorExcedente"
  THEN RAISE EXCEPTION 'Itens e origens precisam somar exatamente o excedente'; END IF;
  FOR ap IN SELECT o."aplicacaoPermutaId" AS id, a.valor AS limite FROM "OrigemExcedentePermuta" o JOIN "AplicacaoCompensacaoPermuta" a ON a.id=o."aplicacaoPermutaId" WHERE o."propostaId"=p.id LOOP
    IF (SELECT coalesce(sum(o2.valor),0) FROM "OrigemExcedentePermuta" o2 LEFT JOIN "DecisaoDestinacaoExcedentePermuta" d2 ON d2."propostaId"=o2."propostaId"
        WHERE o2."aplicacaoPermutaId"=ap.id AND (o2."propostaId"=p.id OR d2.aprovada)) > ap.limite THEN RAISE EXCEPTION 'O excedente desta compensação já foi destinado'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_decisao_destinacao_excedente_171 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoDestinacaoExcedentePermuta" FOR EACH ROW EXECUTE FUNCTION guardar_decisao_destinacao_excedente_171();

-- Os dois destinos nascem só de decisão aprovada, para o item correspondente, com o mesmo valor.
CREATE FUNCTION guardar_destino_excedente_permuta_171() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE i "ItemDestinacaoExcedentePermuta"%ROWTYPE; d "DecisaoDestinacaoExcedentePermuta"%ROWTYPE; p "PropostaDestinacaoExcedentePermuta"%ROWTYPE; esperado TEXT; linha JSONB; valor_novo NUMERIC;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Destino do excedente de permuta é imutável'; END IF;
  -- As duas tabelas têm colunas diferentes; a leitura por JSONB evita resolver coluna inexistente em NEW.
  linha := to_jsonb(NEW);
  SELECT * INTO i FROM "ItemDestinacaoExcedentePermuta" WHERE id=linha->>'itemId' FOR SHARE;
  SELECT * INTO d FROM "DecisaoDestinacaoExcedentePermuta" WHERE id=linha->>'decisaoId' FOR SHARE;
  SELECT * INTO p FROM "PropostaDestinacaoExcedentePermuta" WHERE id=i."propostaId";
  IF TG_TABLE_NAME='SaldoServicoPermuta' THEN esperado:='SALDO_SERVICOS'; valor_novo:=(linha->>'valorInicial')::numeric;
  ELSE esperado:='CREDITO_FINANCEIRO'; valor_novo:=(linha->>'valor')::numeric; END IF;
  IF i.id IS NULL OR d.id IS NULL OR d.aprovada IS DISTINCT FROM TRUE OR d."propostaId" IS DISTINCT FROM i."propostaId" OR i.tipo IS DISTINCT FROM esperado
    OR valor_novo IS DISTINCT FROM i.valor OR linha->>'matriculaId' IS DISTINCT FROM p."matriculaId" OR linha->>'moeda' IS DISTINCT FROM p.moeda
    OR (esperado='CREDITO_FINANCEIRO' AND linha->>'cobrancaId' IS DISTINCT FROM p."cobrancaId")
  THEN RAISE EXCEPTION 'Destino diverge do item aprovado da destinação'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_saldo_servico_permuta_171 BEFORE INSERT OR UPDATE OR DELETE ON "SaldoServicoPermuta" FOR EACH ROW EXECUTE FUNCTION guardar_destino_excedente_permuta_171();
CREATE TRIGGER guardar_origem_credito_excedente_171 BEFORE INSERT OR UPDATE OR DELETE ON "OrigemCreditoExcedentePermuta" FOR EACH ROW EXECUTE FUNCTION guardar_destino_excedente_permuta_171();

CREATE FUNCTION guardar_credito_excedente_permuta_171() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE o "OrigemCreditoExcedentePermuta"%ROWTYPE;
BEGIN
  SELECT * INTO o FROM "OrigemCreditoExcedentePermuta" WHERE id=NEW."origemExcedentePermutaId" FOR SHARE;
  IF o.id IS NULL OR NEW."matriculaId" IS DISTINCT FROM o."matriculaId" OR NEW."valorInicial" IS DISTINCT FROM o.valor OR NEW.moeda IS DISTINCT FROM o.moeda
  THEN RAISE EXCEPTION 'Crédito diverge da origem do excedente de permuta'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_credito_excedente_permuta_171 BEFORE INSERT ON "CreditoMatricula" FOR EACH ROW
  WHEN (NEW."origemExcedentePermutaId" IS NOT NULL) EXECUTE FUNCTION guardar_credito_excedente_permuta_171();

-- Decisão aprovada e destinos nascem na mesma transação: nenhum item aprovado fica sem efeito.
CREATE FUNCTION exigir_destinos_excedente_permuta_171() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.aprovada THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM "ItemDestinacaoExcedentePermuta" i WHERE i."propostaId"=NEW."propostaId" AND (
      (i.tipo='SALDO_SERVICOS' AND NOT EXISTS (SELECT 1 FROM "SaldoServicoPermuta" s WHERE s."itemId"=i.id))
      OR (i.tipo='CREDITO_FINANCEIRO' AND NOT EXISTS (SELECT 1 FROM "OrigemCreditoExcedentePermuta" o JOIN "CreditoMatricula" cr ON cr."origemExcedentePermutaId"=o.id WHERE o."itemId"=i.id))))
  THEN RAISE EXCEPTION 'A destinação aprovada exige todos os destinos na mesma operação'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER exigir_destinos_excedente_permuta_171 AFTER INSERT ON "DecisaoDestinacaoExcedentePermuta"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_destinos_excedente_permuta_171();

-- 249: o reconhecimento de crédito na desistência passa a conhecer a nona origem.
CREATE OR REPLACE FUNCTION q165_delta_reconhecimento_guard_249() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoReconferenciaDeltaDesistencia"%ROWTYPE; cr "CreditoMatricula"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Reconhecimento de crédito é imutável'; END IF;
 SELECT * INTO a FROM "AplicacaoReconferenciaDeltaDesistencia" WHERE id=NEW."aplicacaoId" FOR SHARE;
 SELECT * INTO cr FROM "CreditoMatricula" WHERE id=NEW."creditoId" FOR SHARE;
 IF a.id IS NULL OR cr.id IS NULL OR cr."matriculaId" IS DISTINCT FROM a.fotografia->>'matriculaId' OR num_nonnulls(cr."origemLiberacaoId",cr."origemAcertoId",cr."origemPeriodoIntegralId",cr."origemDestinacaoRecebimentoId",cr."origemAcertoTaxaAditivoId",cr."origemAcertoDesistenciaContratualId",cr."origemReconferenciaDeltaDesistenciaId",cr."origemRevisaoCorrecaoAulaId",cr."origemExcedentePermutaId")<>1 OR cr."origemAcertoDesistenciaContratualId" IS NOT NULL OR cr."origemReconferenciaDeltaDesistenciaId" IS NOT NULL OR NEW.valor IS DISTINCT FROM (cr."valorInicial"-coalesce((SELECT sum(u.valor) FROM "PropostaUsoCredito" u JOIN "DecisaoUsoCredito" d ON d."propostaId"=u.id AND d.aprovada WHERE u."creditoId"=cr.id),0)-coalesce((SELECT sum(r.valor) FROM "ReservaDevolucaoCredito" r WHERE r."creditoId"=cr.id AND r.estado<>'LIBERADA'),0)) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a."memoriaDelta"->'creditosExternos') x WHERE x->>'id'=cr.id AND (x->>'saldoDisponivel')::numeric=NEW.valor AND x->>'moeda'=cr.moeda) THEN RAISE EXCEPTION 'Reconhecimento exige crédito externo da fotografia delta'; END IF;
 RETURN NEW;
END $$;
