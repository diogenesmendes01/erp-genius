-- Q171: uso do saldo restrito a serviços. O uso aprovado nasce como AplicacaoCompensacaoPermuta (crédito de
-- serviço), então o contador valorCompensadoPermuta, a projeção e a proteção de saldo da cobrança continuam
-- valendo sem reescrita. A aplicação passa a ter exatamente uma origem: destino de proposta OU uso de saldo.

-- AlterTable
ALTER TABLE "AplicacaoCompensacaoPermuta" ADD COLUMN     "usoSaldoServicoId" TEXT,
ALTER COLUMN "destinoId" DROP NOT NULL,
ALTER COLUMN "decisaoId" DROP NOT NULL;
ALTER TABLE "AplicacaoCompensacaoPermuta" ADD CONSTRAINT "AplicacaoCompensacaoPermuta_origem_unica_171"
  CHECK (("destinoId" IS NOT NULL AND "decisaoId" IS NOT NULL AND "usoSaldoServicoId" IS NULL) OR ("destinoId" IS NULL AND "decisaoId" IS NULL AND "usoSaldoServicoId" IS NOT NULL));

-- CreateTable
CREATE TABLE "PropostaUsoSaldoServicoPermuta" (
    "id" TEXT NOT NULL,
    "saldoId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "versaoCobranca" INTEGER NOT NULL,
    "moeda" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropostaUsoSaldoServicoPermuta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PropostaUsoSaldoServicoPermuta_valor_positivo" CHECK ("valor" > 0)
);
-- CreateTable
CREATE TABLE "DecisaoUsoSaldoServicoPermuta" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisaoUsoSaldoServicoPermuta_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PropostaUsoSaldoServicoPermuta_saldoId_idx" ON "PropostaUsoSaldoServicoPermuta"("saldoId");
CREATE INDEX "PropostaUsoSaldoServicoPermuta_cobrancaId_idx" ON "PropostaUsoSaldoServicoPermuta"("cobrancaId");
CREATE INDEX "PropostaUsoSaldoServicoPermuta_matriculaId_idx" ON "PropostaUsoSaldoServicoPermuta"("matriculaId");
CREATE UNIQUE INDEX "PropostaUsoSaldoServicoPermuta_preparadorId_chaveIdempotenc_key" ON "PropostaUsoSaldoServicoPermuta"("preparadorId", "chaveIdempotencia");
CREATE UNIQUE INDEX "DecisaoUsoSaldoServicoPermuta_propostaId_key" ON "DecisaoUsoSaldoServicoPermuta"("propostaId");
CREATE UNIQUE INDEX "AplicacaoCompensacaoPermuta_usoSaldoServicoId_key" ON "AplicacaoCompensacaoPermuta"("usoSaldoServicoId");
-- AddForeignKey
ALTER TABLE "AplicacaoCompensacaoPermuta" ADD CONSTRAINT "AplicacaoCompensacaoPermuta_usoSaldoServicoId_fkey" FOREIGN KEY ("usoSaldoServicoId") REFERENCES "DecisaoUsoSaldoServicoPermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaUsoSaldoServicoPermuta" ADD CONSTRAINT "PropostaUsoSaldoServicoPermuta_saldoId_fkey" FOREIGN KEY ("saldoId") REFERENCES "SaldoServicoPermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaUsoSaldoServicoPermuta" ADD CONSTRAINT "PropostaUsoSaldoServicoPermuta_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaUsoSaldoServicoPermuta" ADD CONSTRAINT "PropostaUsoSaldoServicoPermuta_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaUsoSaldoServicoPermuta" ADD CONSTRAINT "PropostaUsoSaldoServicoPermuta_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoUsoSaldoServicoPermuta" ADD CONSTRAINT "DecisaoUsoSaldoServicoPermuta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaUsoSaldoServicoPermuta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoUsoSaldoServicoPermuta" ADD CONSTRAINT "DecisaoUsoSaldoServicoPermuta_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Saldo disponível = valor inicial − usos aprovados (a proposta pendente também reserva, para não prometer duas vezes).
CREATE FUNCTION saldo_servico_permuta_disponivel_171(saldo_id TEXT, ignorar_proposta TEXT DEFAULT NULL) RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT s."valorInicial" - coalesce((SELECT sum(p.valor) FROM "PropostaUsoSaldoServicoPermuta" p LEFT JOIN "DecisaoUsoSaldoServicoPermuta" d ON d."propostaId"=p.id
    WHERE p."saldoId"=s.id AND (d.id IS NULL OR d.aprovada) AND (ignorar_proposta IS NULL OR p.id<>ignorar_proposta)),0)
  FROM "SaldoServicoPermuta" s WHERE s.id=saldo_id
$$;

-- Proposta: Financeiro ativo; cobrança da mesma matrícula e moeda do saldo, aberta, dos tipos abatíveis; valor dentro do saldo e do saldo da cobrança.
CREATE FUNCTION guardar_proposta_uso_saldo_servico_171() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; s "SaldoServicoPermuta"%ROWTYPE; c "Cobranca"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de uso do saldo de serviços é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  PERFORM id FROM "Matricula" WHERE id=NEW."matriculaId" FOR UPDATE;
  SELECT * INTO c FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
  SELECT * INTO s FROM "SaldoServicoPermuta" WHERE id=NEW."saldoId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
  IF u.id IS NULL OR NOT u.ativo OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Preparação exige Financeiro ativo'; END IF;
  IF s.id IS NULL OR s."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR s.moeda IS DISTINCT FROM NEW.moeda THEN RAISE EXCEPTION 'Saldo de serviços incompatível com a matrícula ou a moeda'; END IF;
  IF c.id IS NULL OR c."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR c.moeda IS DISTINCT FROM NEW.moeda OR c.versao IS DISTINCT FROM NEW."versaoCobranca"
    OR c.tipo NOT IN ('MENSALIDADE','HORA_PARTICULAR','MATRICULA') OR c.status NOT IN ('PENDENTE','ATRASADO') OR c.saldo IS NULL OR NEW.valor > c.saldo
  THEN RAISE EXCEPTION 'O saldo de serviços só abate mensalidade, hora particular ou taxa em aberto da mesma matrícula, na mesma moeda e até o saldo da cobrança'; END IF;
  IF NEW.valor > saldo_servico_permuta_disponivel_171(s.id, NEW.id) THEN RAISE EXCEPTION 'Valor acima do saldo de serviços disponível'; END IF;
  IF EXISTS (SELECT 1 FROM "PropostaUsoSaldoServicoPermuta" o LEFT JOIN "DecisaoUsoSaldoServicoPermuta" d ON d."propostaId"=o.id WHERE o."cobrancaId"=NEW."cobrancaId" AND d.id IS NULL)
  THEN RAISE EXCEPTION 'Já existe uso de saldo de serviços aguardando decisão para esta cobrança'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_proposta_uso_saldo_servico_171 BEFORE INSERT OR UPDATE OR DELETE ON "PropostaUsoSaldoServicoPermuta" FOR EACH ROW EXECUTE FUNCTION guardar_proposta_uso_saldo_servico_171();

-- Decisão: aprovador financeiro independente; aprovação exige cobrança na versão proposta e saldo ainda disponível.
CREATE FUNCTION guardar_decisao_uso_saldo_servico_171() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; p "PropostaUsoSaldoServicoPermuta"%ROWTYPE; c "Cobranca"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão do uso do saldo de serviços é imutável'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO p FROM "PropostaUsoSaldoServicoPermuta" WHERE id=NEW."propostaId" FOR UPDATE;
  PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
  SELECT * INTO c FROM "Cobranca" WHERE id=p."cobrancaId" FOR UPDATE;
  PERFORM id FROM "SaldoServicoPermuta" WHERE id=p."saldoId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR u.id IS NULL OR NOT u.ativo
    OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
  THEN RAISE EXCEPTION 'Decisão exige aprovador financeiro independente'; END IF;
  IF NOT NEW.aprovada THEN RETURN NEW; END IF;
  IF c.versao IS DISTINCT FROM p."versaoCobranca" OR c.status NOT IN ('PENDENTE','ATRASADO') OR c.saldo IS NULL OR p.valor > c.saldo THEN RAISE EXCEPTION 'A cobrança mudou depois da proposta; prepare novo uso'; END IF;
  IF p.valor > saldo_servico_permuta_disponivel_171(p."saldoId", p.id) THEN RAISE EXCEPTION 'Saldo de serviços insuficiente para aprovar este uso'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_decisao_uso_saldo_servico_171 BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoUsoSaldoServicoPermuta" FOR EACH ROW EXECUTE FUNCTION guardar_decisao_uso_saldo_servico_171();

-- Aprovação sem aplicação não existe: a aplicação nasce na mesma transação da decisão aprovada (constraint deferred).
CREATE FUNCTION exigir_aplicacao_uso_saldo_servico_171() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.aprovada AND NOT EXISTS (SELECT 1 FROM "AplicacaoCompensacaoPermuta" a WHERE a."usoSaldoServicoId"=NEW.id) THEN RAISE EXCEPTION 'Uso aprovado do saldo de serviços exige a aplicação na mesma transação'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER exigir_aplicacao_uso_saldo_servico_171 AFTER INSERT ON "DecisaoUsoSaldoServicoPermuta" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_aplicacao_uso_saldo_servico_171();

-- A validação da aplicação ganha o ramo do uso de saldo; o ramo original (destino de proposta) é preservado.
CREATE OR REPLACE FUNCTION validar_aplicacao_permuta_223() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destino "DestinoPropostaCompensacaoPermuta"%ROWTYPE; decisao "DecisaoCompensacaoPermuta"%ROWTYPE; cobranca "Cobranca"%ROWTYPE; uso "DecisaoUsoSaldoServicoPermuta"%ROWTYPE; proposta_uso "PropostaUsoSaldoServicoPermuta"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação de permuta é imutável'; END IF;
 SELECT * INTO cobranca FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
 IF NEW."usoSaldoServicoId" IS NOT NULL THEN
  -- Q171: uso aprovado do saldo restrito a serviços. Mesma matrícula e moeda já foram conferidas na proposta; aqui a cadeia e o valor.
  SELECT * INTO uso FROM "DecisaoUsoSaldoServicoPermuta" WHERE id=NEW."usoSaldoServicoId" FOR SHARE;
  SELECT * INTO proposta_uso FROM "PropostaUsoSaldoServicoPermuta" WHERE id=uso."propostaId" FOR SHARE;
  IF uso.id IS NULL OR NOT uso.aprovada OR proposta_uso.id IS NULL OR NEW."cobrancaId" IS DISTINCT FROM proposta_uso."cobrancaId" OR NEW.valor IS DISTINCT FROM proposta_uso.valor
    OR cobranca."matriculaId" IS DISTINCT FROM proposta_uso."matriculaId" OR cobranca.moeda IS DISTINCT FROM proposta_uso.moeda OR cobranca.versao IS DISTINCT FROM proposta_uso."versaoCobranca"
    OR cobranca.tipo NOT IN ('MENSALIDADE','HORA_PARTICULAR','MATRICULA') OR cobranca.status NOT IN ('PENDENTE','ATRASADO') OR cobranca.saldo IS NULL OR NEW.valor>cobranca.saldo
  THEN RAISE EXCEPTION 'Aplicação do saldo de serviços exige uso aprovado e cobrança na versão proposta'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO destino FROM "DestinoPropostaCompensacaoPermuta" WHERE id=NEW."destinoId" FOR SHARE;
 SELECT * INTO decisao FROM "DecisaoCompensacaoPermuta" WHERE id=NEW."decisaoId" FOR SHARE;
 IF destino.id IS NULL OR decisao.id IS NULL OR NOT decisao.aprovada OR decisao."propostaId" IS DISTINCT FROM destino."propostaId" OR NEW."cobrancaId" IS DISTINCT FROM destino."cobrancaId" OR NEW.valor IS DISTINCT FROM destino.valor OR cobranca.tipo<>'MENSALIDADE' OR cobranca.status NOT IN ('PENDENTE','ATRASADO') OR cobranca.saldo IS NULL OR NEW.valor>cobranca.saldo THEN RAISE EXCEPTION 'Aplicação exige destino aprovado e saldo disponível'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Usuario" WHERE id=decisao."decisorId" AND ativo AND ('ADMINISTRADOR'=ANY(papeis) OR ('FINANCEIRO'=ANY(papeis) AND 'financeiro.aprovar_acertos'=ANY(permissoes)))) THEN RAISE EXCEPTION 'Executor financeiro não autorizado'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "PropostaCompensacaoPermuta" p CROSS JOIN LATERAL jsonb_array_elements(p.snapshot->'destinos') f WHERE p.id=destino."propostaId" AND f->>'cobrancaId'=cobranca.id AND (f->>'versao')::integer=cobranca.versao AND (f->>'saldo')::numeric=cobranca.saldo) THEN RAISE EXCEPTION 'Aplicação de proposta obsoleta'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaCompensacaoPermuta" p JOIN "ConfirmacaoServicoPermuta" c ON c.id=p."confirmacaoId" JOIN "AcordoPermutaCobranca" e ON e."acordoId"=c."acordoId" AND e."cobrancaId"=NEW."cobrancaId" WHERE p.id=destino."propostaId" AND NEW.valor+coalesce((SELECT sum(ap.valor) FROM "AplicacaoCompensacaoPermuta" ap JOIN "DestinoPropostaCompensacaoPermuta" dp ON dp.id=ap."destinoId" JOIN "PropostaCompensacaoPermuta" pp ON pp.id=dp."propostaId" JOIN "ConfirmacaoServicoPermuta" cp ON cp.id=pp."confirmacaoId" WHERE cp."acordoId"=c."acordoId" AND ap."cobrancaId"=NEW."cobrancaId"),0)>e."valorMaximo") THEN RAISE EXCEPTION 'Limite cumulativo da cobrança excedido'; END IF;
 RETURN NEW;
END $$;
