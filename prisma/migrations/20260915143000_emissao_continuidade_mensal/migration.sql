-- Q30/Q64/Q160/Q161/Q162: ledger imutável da mensalidade recorrente.
CREATE TABLE "EmissaoContinuidadeMensal" (
  "id" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "cobrancaId" TEXT NOT NULL,
  "anteriorCobrancaId" TEXT NOT NULL,
  "coberturaInicio" DATE NOT NULL,
  "coberturaFim" DATE NOT NULL,
  "emissaoEm" DATE NOT NULL,
  snapshot JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmissaoContinuidadeMensal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmissaoContinuidadeMensal_cobrancaId_key" UNIQUE ("cobrancaId"),
  CONSTRAINT "EmissaoContinuidadeMensal_matricula_ancora_key" UNIQUE ("matriculaId", "anteriorCobrancaId"),
  CONSTRAINT "EmissaoContinuidadeMensal_matricula_cobertura_key" UNIQUE ("matriculaId", "coberturaInicio", "coberturaFim"),
  CONSTRAINT "EmissaoContinuidadeMensal_intervalo_check" CHECK ("coberturaInicio" <= "coberturaFim")
);
CREATE INDEX "EmissaoContinuidadeMensal_matricula_emitida_idx" ON "EmissaoContinuidadeMensal"("matriculaId", "emitidaEm");
ALTER TABLE "EmissaoContinuidadeMensal" ADD CONSTRAINT "EmissaoContinuidadeMensal_matricula_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "EmissaoContinuidadeMensal" ADD CONSTRAINT "EmissaoContinuidadeMensal_cobranca_fkey" FOREIGN KEY ("cobrancaId", "matriculaId") REFERENCES "Cobranca"("id", "matriculaId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "EmissaoContinuidadeMensal" ADD CONSTRAINT "EmissaoContinuidadeMensal_anterior_fkey" FOREIGN KEY ("anteriorCobrancaId", "matriculaId") REFERENCES "Cobranca"("id", "matriculaId") DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION validar_emissao_continuidade_mensal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE nova "Cobranca"%ROWTYPE; anterior "Cobranca"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Emissões de continuidade mensal são preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  SELECT * INTO nova FROM "Cobranca" WHERE id = NEW."cobrancaId" AND "matriculaId" = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança nova de continuidade não encontrada.'; END IF;
  SELECT * INTO anterior FROM "Cobranca" WHERE id = NEW."anteriorCobrancaId" AND "matriculaId" = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Âncora de continuidade não encontrada.'; END IF;
  IF nova.id = anterior.id OR nova.tipo <> 'MENSALIDADE' OR anterior.tipo <> 'MENSALIDADE'
    OR nova."coberturaInicio" IS DISTINCT FROM NEW."coberturaInicio" OR nova."coberturaFim" IS DISTINCT FROM NEW."coberturaFim"
    OR anterior."coberturaFim" IS NULL OR anterior."coberturaFim" + 1 IS DISTINCT FROM NEW."coberturaInicio" OR NEW."snapshotHash" !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(NEW.snapshot) <> 'object'
    OR NEW.snapshot #>> '{plano,status}' IS DISTINCT FROM 'PRONTA_PARA_EMISSAO'
    OR NEW.snapshot #>> '{oferta,estado}' IS DISTINCT FROM 'SEM_RELATO'
    OR COALESCE(NEW.snapshot #>> '{comprovacaoOferta,estado}', '') NOT IN ('COMPROVADA_POR_AGENDA', 'CONFIRMADA_PELA_GESTAO')
    OR NEW.snapshot #>> '{plano,cobertura,inicio}' IS DISTINCT FROM to_char(NEW."coberturaInicio", 'YYYY-MM-DD')
    OR NEW.snapshot #>> '{plano,cobertura,fim}' IS DISTINCT FROM to_char(NEW."coberturaFim", 'YYYY-MM-DD')
    OR NEW.snapshot #>> '{plano,emissaoEm}' IS DISTINCT FROM to_char(NEW."emissaoEm", 'YYYY-MM-DD')
    OR NEW.snapshot #>> '{plano,moeda}' IS DISTINCT FROM nova.moeda
    OR (NEW.snapshot #>> '{plano,valorOriginal}')::numeric IS DISTINCT FROM nova."valorOriginal"
    OR (NEW.snapshot #>> '{plano,valorNegociado}')::numeric IS DISTINCT FROM nova."valorNegociado"
  THEN RAISE EXCEPTION 'Ledger de continuidade mensal inválido.'; END IF;
  IF EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId" = NEW."matriculaId" AND c.tipo = 'MENSALIDADE' AND c.id <> nova.id AND c.status <> 'CANCELADA' AND c."coberturaInicio" <= NEW."coberturaFim" AND c."coberturaFim" >= NEW."coberturaInicio") THEN RAISE EXCEPTION 'Cobertura mensal sobreposta.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_emissao_continuidade_mensal BEFORE INSERT OR UPDATE OR DELETE ON "EmissaoContinuidadeMensal" FOR EACH ROW EXECUTE FUNCTION validar_emissao_continuidade_mensal();
