-- Q131 — rascunho de exceção de frequência por matrícula e nível.
-- A proposta preserva a apuração real no snapshot e não altera qualquer aula,
-- presença, impedimento, falta ou reposição.

CREATE TABLE "PropostaExcecaoFrequencia" (
  id TEXT PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "nivelId" TEXT NOT NULL REFERENCES "Nivel"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "alocacaoReferenciaId" TEXT NOT NULL REFERENCES "AlocacaoTurma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "regraId" TEXT NOT NULL REFERENCES "VersaoRegraAvaliacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "fonteHash" TEXT NOT NULL CHECK ("fonteHash" ~ '^[a-f0-9]{64}$'),
  versao INTEGER NOT NULL CHECK (versao > 0),
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) >= 5),
  frequencia JSONB NOT NULL CHECK (jsonb_typeof(frequencia) = 'object'),
  evidencias TEXT NOT NULL CHECK (length(btrim(evidencias)) >= 5),
  "autorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) > 0),
  "entradaHash" TEXT NOT NULL CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "PropostaExcecaoFrequencia_matricula_nivel_versao_key"
    UNIQUE ("matriculaId", "nivelId", versao),
  CONSTRAINT "PropostaExcecaoFrequencia_idempotencia_key"
    UNIQUE ("autorId", "chaveIdempotencia")
);
CREATE INDEX "PropostaExcecaoFrequencia_matricula_nivel_criada_idx"
  ON "PropostaExcecaoFrequencia" ("matriculaId", "nivelId", "criadaEm");
CREATE INDEX "PropostaExcecaoFrequencia_alocacao_criada_idx"
  ON "PropostaExcecaoFrequencia" ("alocacaoReferenciaId", "criadaEm");

CREATE TABLE "DecisaoExcecaoFrequencia" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaExcecaoFrequencia"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) >= 5),
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);

CREATE OR REPLACE FUNCTION "validar_proposta_excecao_frequencia"()
RETURNS TRIGGER AS $$
DECLARE
  turma_referencia TEXT;
  nivel_turma TEXT;
  regra_turma TEXT;
  criada_referencia TIMESTAMP(3);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'excecao-frequencia:' || NEW."matriculaId" || ':' || NEW."nivelId", 0));

  PERFORM id FROM "Usuario"
    WHERE id = NEW."autorId" AND ativo
      AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exceção de frequência exige gestão pedagógica ou administração ativa';
  END IF;

  SELECT a."turmaId", a."criadoEm" INTO turma_referencia, criada_referencia
    FROM "AlocacaoTurma" a
    WHERE a.id = NEW."alocacaoReferenciaId" AND a."matriculaId" = NEW."matriculaId"
    FOR SHARE;
  IF turma_referencia IS NULL THEN
    RAISE EXCEPTION 'Alocação de referência não pertence à matrícula da exceção';
  END IF;
  SELECT t."nivelId", t."regraAvaliacaoId" INTO nivel_turma, regra_turma
    FROM "Turma" t WHERE t.id = turma_referencia;
  IF nivel_turma IS DISTINCT FROM NEW."nivelId" OR regra_turma IS DISTINCT FROM NEW."regraId" THEN
    RAISE EXCEPTION 'Nível ou regra não corresponde à alocação de referência';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "VersaoRegraAvaliacao" r WHERE r.id = NEW."regraId" AND r."nivelId" = NEW."nivelId") THEN
    RAISE EXCEPTION 'Regra da exceção pertence a outro nível';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "AlocacaoTurma" posterior
      JOIN "Turma" turma_posterior ON turma_posterior.id = posterior."turmaId"
    WHERE posterior."matriculaId" = NEW."matriculaId"
      AND turma_posterior."nivelId" = NEW."nivelId"
      AND (posterior."criadoEm", posterior.id) > (criada_referencia, NEW."alocacaoReferenciaId")
  ) THEN
    RAISE EXCEPTION 'Exceção exige a alocação mais recente da matrícula neste nível';
  END IF;
  IF jsonb_typeof(NEW.frequencia) IS DISTINCT FROM 'object'
    OR NEW.frequencia->>'matriculaId' IS DISTINCT FROM NEW."matriculaId"
    OR NEW.frequencia->>'nivelId' IS DISTINCT FROM NEW."nivelId"
    OR NEW.frequencia->>'fonteHash' IS DISTINCT FROM NEW."fonteHash" THEN
    RAISE EXCEPTION 'Snapshot de frequência diverge do contexto ou da fonte informada';
  END IF;
  IF NEW.frequencia->'atendeMinimo' IS DISTINCT FROM 'false'::jsonb
    OR NEW.frequencia->'pendencias' IS DISTINCT FROM '[]'::jsonb
    OR NEW.frequencia->'pendenciasHistoricas' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'Exceção exige frequência insuficiente e apurada sem pendências';
  END IF;
  IF NEW.versao <> COALESCE((
    SELECT MAX(p.versao) + 1 FROM "PropostaExcecaoFrequencia" p
    WHERE p."matriculaId" = NEW."matriculaId" AND p."nivelId" = NEW."nivelId"
  ), 1) THEN
    RAISE EXCEPTION 'Versão da proposta de exceção de frequência está desatualizada';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PropostaExcecaoFrequencia_validar"
  BEFORE INSERT ON "PropostaExcecaoFrequencia"
  FOR EACH ROW EXECUTE FUNCTION "validar_proposta_excecao_frequencia"();

CREATE OR REPLACE FUNCTION "validar_decisao_excecao_frequencia"()
RETURNS TRIGGER AS $$
DECLARE
  proposta "PropostaExcecaoFrequencia"%ROWTYPE;
BEGIN
  SELECT * INTO proposta FROM "PropostaExcecaoFrequencia" WHERE id = NEW."propostaId" FOR SHARE;
  IF proposta.id IS NULL THEN RAISE EXCEPTION 'Proposta de exceção de frequência inexistente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'excecao-frequencia:' || proposta."matriculaId" || ':' || proposta."nivelId", 0));
  IF proposta."autorId" = NEW."decisorId" THEN
    RAISE EXCEPTION 'Exceção de frequência exige decisão por outra pessoa';
  END IF;
  PERFORM id FROM "Usuario"
    WHERE id = NEW."decisorId" AND ativo
      AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decisão de exceção de frequência exige gestão ativa';
  END IF;
  IF NEW.aprovada AND proposta.versao <> (
    SELECT MAX(versao) FROM "PropostaExcecaoFrequencia"
    WHERE "matriculaId" = proposta."matriculaId" AND "nivelId" = proposta."nivelId"
  ) THEN
    RAISE EXCEPTION 'Há proposta de exceção de frequência mais recente';
  END IF;
  IF NEW.aprovada THEN
    PERFORM id FROM "Usuario" WHERE id=proposta."autorId" AND ativo
      AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Autor da proposta precisa manter autorização para aprovação'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DecisaoExcecaoFrequencia_validar"
  BEFORE INSERT ON "DecisaoExcecaoFrequencia"
  FOR EACH ROW EXECUTE FUNCTION "validar_decisao_excecao_frequencia"();

CREATE OR REPLACE FUNCTION "proteger_historico_excecao_frequencia"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% é histórico e não pode ser alterado ou removido', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PropostaExcecaoFrequencia_proteger"
  BEFORE UPDATE OR DELETE ON "PropostaExcecaoFrequencia"
  FOR EACH ROW EXECUTE FUNCTION "proteger_historico_excecao_frequencia"();
CREATE TRIGGER "DecisaoExcecaoFrequencia_proteger"
  BEFORE UPDATE OR DELETE ON "DecisaoExcecaoFrequencia"
  FOR EACH ROW EXECUTE FUNCTION "proteger_historico_excecao_frequencia"();
