-- P02/Q89/Q98: acordo de permuta, confirmação pedagógica e compensação sem fato de caixa.
CREATE TYPE "UnidadePermutaServico" AS ENUM ('HORA','AULA','UNIDADE');
CREATE TABLE "AcordoPermutaServico" (
 "id" TEXT NOT NULL, "matriculaId" TEXT NOT NULL, "preparadorId" TEXT NOT NULL,
 "vigenciaInicio" DATE NOT NULL, "vigenciaFim" DATE NOT NULL, "moeda" TEXT NOT NULL,
 "unidade" "UnidadePermutaServico" NOT NULL, "quantidadePactuada" DECIMAL(12,2) NOT NULL,
 "valorPorUnidade" DECIMAL(12,2) NOT NULL, "valorTotalPactuado" DECIMAL(12,2) NOT NULL,
 "contrapartida" TEXT NOT NULL, "formulaDescricao" TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL,
 "entradaHash" TEXT NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AcordoPermutaServico_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "aps_preparador_chave_key" ON "AcordoPermutaServico"("preparadorId","chaveIdempotencia");
CREATE INDEX "aps_matricula_vigencia_idx" ON "AcordoPermutaServico"("matriculaId","vigenciaInicio","vigenciaFim");
ALTER TABLE "AcordoPermutaServico" ADD CONSTRAINT "aps_matricula_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT;
ALTER TABLE "AcordoPermutaServico" ADD CONSTRAINT "aps_preparador_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
CREATE TABLE "AcordoPermutaCobranca" ("id" TEXT NOT NULL, "acordoId" TEXT NOT NULL, "cobrancaId" TEXT NOT NULL, "valorMaximo" DECIMAL(12,2) NOT NULL, CONSTRAINT "AcordoPermutaCobranca_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "apc_acordo_cobranca_key" ON "AcordoPermutaCobranca"("acordoId","cobrancaId"); CREATE INDEX "apc_cobranca_idx" ON "AcordoPermutaCobranca"("cobrancaId");
ALTER TABLE "AcordoPermutaCobranca" ADD CONSTRAINT "apc_acordo_fkey" FOREIGN KEY ("acordoId") REFERENCES "AcordoPermutaServico"("id") ON DELETE RESTRICT;
ALTER TABLE "AcordoPermutaCobranca" ADD CONSTRAINT "apc_cobranca_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT;
CREATE TABLE "ConfirmacaoServicoPermuta" ("id" TEXT NOT NULL, "acordoId" TEXT NOT NULL, "confirmadorId" TEXT NOT NULL, "periodoInicio" DATE NOT NULL, "periodoFim" DATE NOT NULL, "quantidadeComprovada" DECIMAL(12,2) NOT NULL, "evidencia" TEXT NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ConfirmacaoServicoPermuta_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "csp_confirmador_chave_key" ON "ConfirmacaoServicoPermuta"("confirmadorId","chaveIdempotencia"); CREATE INDEX "csp_acordo_periodo_idx" ON "ConfirmacaoServicoPermuta"("acordoId","periodoInicio","periodoFim");
ALTER TABLE "ConfirmacaoServicoPermuta" ADD CONSTRAINT "csp_acordo_fkey" FOREIGN KEY ("acordoId") REFERENCES "AcordoPermutaServico"("id") ON DELETE RESTRICT;
ALTER TABLE "ConfirmacaoServicoPermuta" ADD CONSTRAINT "csp_confirmador_fkey" FOREIGN KEY ("confirmadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
CREATE TABLE "PropostaCompensacaoPermuta" ("id" TEXT NOT NULL, "confirmacaoId" TEXT NOT NULL, "preparadorId" TEXT NOT NULL, "valor" DECIMAL(12,2) NOT NULL, "snapshot" JSONB NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PropostaCompensacaoPermuta_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "pcp_preparador_chave_key" ON "PropostaCompensacaoPermuta"("preparadorId","chaveIdempotencia"); CREATE INDEX "pcp_confirmacao_idx" ON "PropostaCompensacaoPermuta"("confirmacaoId");
ALTER TABLE "PropostaCompensacaoPermuta" ADD CONSTRAINT "pcp_confirmacao_fkey" FOREIGN KEY ("confirmacaoId") REFERENCES "ConfirmacaoServicoPermuta"("id") ON DELETE RESTRICT;
ALTER TABLE "PropostaCompensacaoPermuta" ADD CONSTRAINT "pcp_preparador_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
CREATE TABLE "DecisaoCompensacaoPermuta" ("id" TEXT NOT NULL, "propostaId" TEXT NOT NULL, "decisorId" TEXT NOT NULL, "aprovada" BOOLEAN NOT NULL, "motivo" TEXT NOT NULL, "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DecisaoCompensacaoPermuta_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "dcp_proposta_key" ON "DecisaoCompensacaoPermuta"("propostaId"); ALTER TABLE "DecisaoCompensacaoPermuta" ADD CONSTRAINT "dcp_proposta_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCompensacaoPermuta"("id") ON DELETE RESTRICT; ALTER TABLE "DecisaoCompensacaoPermuta" ADD CONSTRAINT "dcp_decisor_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "ConfirmacaoServicoPermuta" ADD COLUMN "referenciaServico" TEXT NOT NULL;
CREATE UNIQUE INDEX "csp_acordo_referencia_key" ON "ConfirmacaoServicoPermuta"("acordoId","referenciaServico");
CREATE TABLE "DestinoPropostaCompensacaoPermuta" ("id" TEXT NOT NULL, "propostaId" TEXT NOT NULL, "cobrancaId" TEXT NOT NULL, "valor" DECIMAL(12,2) NOT NULL, CONSTRAINT "DestinoPropostaCompensacaoPermuta_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "dpcp_proposta_cobranca_key" ON "DestinoPropostaCompensacaoPermuta"("propostaId","cobrancaId"); CREATE INDEX "dpcp_cobranca_idx" ON "DestinoPropostaCompensacaoPermuta"("cobrancaId");
ALTER TABLE "DestinoPropostaCompensacaoPermuta" ADD CONSTRAINT "dpcp_proposta_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCompensacaoPermuta"("id") ON DELETE RESTRICT;
ALTER TABLE "DestinoPropostaCompensacaoPermuta" ADD CONSTRAINT "dpcp_cobranca_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION proteger_permuta_servico() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Registros de permuta são imutáveis'; END $$;
-- Regras finais: serializam no acordo/cobrança e fecham cada conjunto antes da decisão.
CREATE OR REPLACE FUNCTION conferir_permuta_servico() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "AcordoPermutaServico"%ROWTYPE; p "PropostaCompensacaoPermuta"%ROWTYPE; u "Usuario"%ROWTYPE; limite DECIMAL(12,2); comprovado DECIMAL(12,2);
BEGIN
 IF TG_TABLE_NAME='AcordoPermutaServico' THEN
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
  IF NEW."vigenciaFim"<NEW."vigenciaInicio" OR NEW."quantidadePactuada"<=0 OR NEW."valorPorUnidade"<=0 OR NEW."valorTotalPactuado" IS DISTINCT FROM round(NEW."quantidadePactuada"*NEW."valorPorUnidade",2) OR btrim(NEW.moeda)='' OR btrim(NEW.contrapartida)='' OR btrim(NEW."formulaDescricao")='' OR NOT FOUND OR NOT u.ativo OR NOT ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'Acordo de permuta inválido'; END IF;
 ELSIF TG_TABLE_NAME='AcordoPermutaCobranca' THEN
  SELECT * INTO a FROM "AcordoPermutaServico" WHERE id=NEW."acordoId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "ConfirmacaoServicoPermuta" WHERE "acordoId"=NEW."acordoId") OR NEW."valorMaximo"<=0 OR NOT EXISTS (SELECT 1 FROM "Cobranca" c WHERE c.id=NEW."cobrancaId" AND c."matriculaId"=a."matriculaId" AND c.moeda=a.moeda AND c.tipo='MENSALIDADE'::"TipoCobranca" AND c.status IN ('PENDENTE','ATRASADO')) THEN RAISE EXCEPTION 'Elegibilidade fechada ou inválida'; END IF;
 ELSIF TG_TABLE_NAME='ConfirmacaoServicoPermuta' THEN
  SELECT * INTO a FROM "AcordoPermutaServico" WHERE id=NEW."acordoId" FOR UPDATE; SELECT * INTO u FROM "Usuario" WHERE id=NEW."confirmadorId" FOR SHARE;
  IF NOT FOUND OR NOT u.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) OR NEW."periodoFim"<NEW."periodoInicio" OR NEW."periodoInicio"<a."vigenciaInicio" OR NEW."periodoFim">a."vigenciaFim" OR NEW."quantidadeComprovada"<=0 OR btrim(NEW."referenciaServico")='' OR btrim(NEW.evidencia)='' OR EXISTS (SELECT 1 FROM "ConfirmacaoServicoPermuta" c WHERE c."acordoId"=NEW."acordoId" AND c."periodoInicio"<=NEW."periodoFim" AND NEW."periodoInicio"<=c."periodoFim") OR NEW."quantidadeComprovada" + COALESCE((SELECT sum(c."quantidadeComprovada") FROM "ConfirmacaoServicoPermuta" c WHERE c."acordoId"=NEW."acordoId"),0)>a."quantidadePactuada" THEN RAISE EXCEPTION 'Confirmação de permuta inválida'; END IF;
 ELSIF TG_TABLE_NAME='PropostaCompensacaoPermuta' THEN
  SELECT c."quantidadeComprovada",a."valorPorUnidade" INTO comprovado,limite FROM "ConfirmacaoServicoPermuta" c JOIN "AcordoPermutaServico" a ON a.id=c."acordoId" WHERE c.id=NEW."confirmacaoId" FOR UPDATE OF c,a; SELECT * INTO u FROM "Usuario" WHERE id=NEW."preparadorId" FOR SHARE;
  IF NOT FOUND OR NOT u.ativo OR NOT ('FINANCEIRO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) OR NEW.valor<=0 OR NEW.valor>round(comprovado*limite,2) OR EXISTS (SELECT 1 FROM "PropostaCompensacaoPermuta" x LEFT JOIN "DecisaoCompensacaoPermuta" d ON d."propostaId"=x.id WHERE x."confirmacaoId"=NEW."confirmacaoId" AND (d.id IS NULL OR d.aprovada)) THEN RAISE EXCEPTION 'Proposta de permuta inválida ou já consumida'; END IF;
 ELSIF TG_TABLE_NAME='DestinoPropostaCompensacaoPermuta' THEN
  SELECT * INTO p FROM "PropostaCompensacaoPermuta" WHERE id=NEW."propostaId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "DecisaoCompensacaoPermuta" WHERE "propostaId"=NEW."propostaId") OR NEW.valor<=0 OR NOT EXISTS (SELECT 1 FROM "ConfirmacaoServicoPermuta" c JOIN "AcordoPermutaCobranca" e ON e."acordoId"=c."acordoId" AND e."cobrancaId"=NEW."cobrancaId" WHERE c.id=p."confirmacaoId" AND NEW.valor<=e."valorMaximo") THEN RAISE EXCEPTION 'Destino fechado ou inválido'; END IF;
 ELSIF TG_TABLE_NAME='DecisaoCompensacaoPermuta' THEN
  SELECT * INTO p FROM "PropostaCompensacaoPermuta" WHERE id=NEW."propostaId" FOR UPDATE; SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
  IF p.id IS NULL OR NOT u.ativo OR p."preparadorId"=NEW."decisorId" OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN RAISE EXCEPTION 'Decisão de permuta exige aprovador independente autorizado'; END IF;
  IF NEW.aprovada AND (NOT EXISTS (SELECT 1 FROM "DestinoPropostaCompensacaoPermuta" d WHERE d."propostaId"=p.id) OR p.valor IS DISTINCT FROM (SELECT sum(d.valor) FROM "DestinoPropostaCompensacaoPermuta" d WHERE d."propostaId"=p.id) OR EXISTS (SELECT 1 FROM "DestinoPropostaCompensacaoPermuta" destino JOIN "ConfirmacaoServicoPermuta" c ON c.id=p."confirmacaoId" JOIN "AcordoPermutaServico" a ON a.id=c."acordoId" LEFT JOIN "AcordoPermutaCobranca" elegivel ON elegivel."acordoId"=a.id AND elegivel."cobrancaId"=destino."cobrancaId" LEFT JOIN "Cobranca" cobranca ON cobranca.id=destino."cobrancaId" WHERE destino."propostaId"=p.id AND (elegivel.id IS NULL OR cobranca."matriculaId"<>a."matriculaId" OR cobranca.moeda<>a.moeda OR cobranca.tipo IS DISTINCT FROM 'MENSALIDADE'::"TipoCobranca" OR cobranca.status NOT IN ('PENDENTE','ATRASADO') OR destino.valor>elegivel."valorMaximo"))) THEN RAISE EXCEPTION 'Decisão de permuta aprovada exige destinos ainda válidos'; END IF;
 END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION proteger_permuta_servico() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Registros de permuta são imutáveis'; END $$;
CREATE TRIGGER conferir_acordo_permuta BEFORE INSERT ON "AcordoPermutaServico" FOR EACH ROW EXECUTE FUNCTION conferir_permuta_servico();
CREATE TRIGGER conferir_elegibilidade_permuta BEFORE INSERT ON "AcordoPermutaCobranca" FOR EACH ROW EXECUTE FUNCTION conferir_permuta_servico();
CREATE TRIGGER conferir_confirmacao_permuta BEFORE INSERT ON "ConfirmacaoServicoPermuta" FOR EACH ROW EXECUTE FUNCTION conferir_permuta_servico();
CREATE TRIGGER conferir_proposta_permuta BEFORE INSERT ON "PropostaCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION conferir_permuta_servico();
CREATE TRIGGER conferir_destino_permuta BEFORE INSERT ON "DestinoPropostaCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION conferir_permuta_servico();
CREATE TRIGGER conferir_decisao_permuta BEFORE INSERT ON "DecisaoCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION conferir_permuta_servico();
CREATE TRIGGER proteger_acordo_permuta BEFORE UPDATE OR DELETE ON "AcordoPermutaServico" FOR EACH ROW EXECUTE FUNCTION proteger_permuta_servico();
CREATE TRIGGER proteger_elegibilidade_permuta BEFORE UPDATE OR DELETE ON "AcordoPermutaCobranca" FOR EACH ROW EXECUTE FUNCTION proteger_permuta_servico();
CREATE TRIGGER proteger_confirmacao_permuta BEFORE UPDATE OR DELETE ON "ConfirmacaoServicoPermuta" FOR EACH ROW EXECUTE FUNCTION proteger_permuta_servico();
CREATE TRIGGER proteger_proposta_permuta BEFORE UPDATE OR DELETE ON "PropostaCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION proteger_permuta_servico();
CREATE TRIGGER proteger_destino_permuta BEFORE UPDATE OR DELETE ON "DestinoPropostaCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION proteger_permuta_servico();
CREATE TRIGGER proteger_decisao_permuta BEFORE UPDATE OR DELETE ON "DecisaoCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION proteger_permuta_servico();
