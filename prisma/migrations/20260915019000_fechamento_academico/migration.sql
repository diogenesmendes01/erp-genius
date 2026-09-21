-- Q154 — persistência do fechamento acadêmico final versionado.
--
-- Aplicar somente quando o serviço de conferência estiver pronto para montar e
-- revalidar o snapshot completo. O fato não substitui notas, correções,
-- recuperação, equivalências, frequência ou movimentação acadêmica.

CREATE TABLE "FechamentoAcademico" (
  id TEXT PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "nivelId" TEXT NOT NULL REFERENCES "Nivel"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "alocacaoReferenciaId" TEXT NOT NULL REFERENCES "AlocacaoTurma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "regraId" TEXT NOT NULL REFERENCES "VersaoRegraAvaliacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  versao INTEGER NOT NULL CHECK (versao > 0),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  "estadoHash" TEXT NOT NULL CHECK ("estadoHash" ~ '^[a-f0-9]{64}$'),
  "resultadoSuficiente" BOOLEAN NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) >= 5),
  "confirmadoPorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) > 0),
  "entradaHash" TEXT NOT NULL CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  "confirmadoEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "FechamentoAcademico_matricula_nivel_versao_key"
    UNIQUE ("matriculaId", "nivelId", versao),
  CONSTRAINT "FechamentoAcademico_idempotencia_key"
    UNIQUE ("confirmadoPorId", "chaveIdempotencia")
);
CREATE INDEX "FechamentoAcademico_matricula_nivel_confirmado_idx"
  ON "FechamentoAcademico" ("matriculaId", "nivelId", "confirmadoEm");
CREATE INDEX "FechamentoAcademico_alocacao_confirmado_idx"
  ON "FechamentoAcademico" ("alocacaoReferenciaId", "confirmadoEm");

-- O serviço grava o seguinte contrato estável, sem instante de leitura volátil:
-- {
--   versao: 1,
--   contexto: {matriculaId,nivelId,alocacaoReferenciaId,regraId},
--   consolidado, frequencia, pendenciasPorVinculo,
--   elegibilidade: {situacao:'SUFICIENTE'|'INSUFICIENTE',podeFechar,
--                   podeProgredir,pendencias:[...],insuficiencias:[...]},
--   fontesOficiais: [...]
-- }
CREATE OR REPLACE FUNCTION "validar_fechamento_academico"()
RETURNS TRIGGER AS $$
DECLARE
  turma_referencia TEXT;
  nivel_turma TEXT;
  regra_turma TEXT;
  criada_referencia TIMESTAMP(3);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'fechamento-academico:' || NEW."matriculaId" || ':' || NEW."nivelId", 0));

  PERFORM id FROM "Usuario"
    WHERE id = NEW."confirmadoPorId" AND ativo
      AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fechamento acadêmico exige gestão pedagógica ou administração ativa';
  END IF;

  SELECT a."turmaId", a."criadoEm" INTO turma_referencia, criada_referencia
    FROM "AlocacaoTurma" a
    WHERE a.id = NEW."alocacaoReferenciaId"
      AND a."matriculaId" = NEW."matriculaId"
    FOR SHARE;
  IF turma_referencia IS NULL THEN
    RAISE EXCEPTION 'Alocação de referência não pertence à matrícula do fechamento';
  END IF;

  SELECT t."nivelId", t."regraAvaliacaoId" INTO nivel_turma, regra_turma
    FROM "Turma" t WHERE t.id = turma_referencia;
  IF nivel_turma IS DISTINCT FROM NEW."nivelId"
    OR regra_turma IS DISTINCT FROM NEW."regraId" THEN
    RAISE EXCEPTION 'Nível ou regra não corresponde à alocação de referência';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "VersaoRegraAvaliacao" r
    WHERE r.id = NEW."regraId" AND r."nivelId" = NEW."nivelId"
  ) THEN
    RAISE EXCEPTION 'Regra do fechamento pertence a outro nível';
  END IF;
  -- O serviço já bloqueia o estado acadêmico; esta verificação impede também
  -- inserção SQL para uma alocação histórica quando há referência posterior
  -- no mesmo nível da matrícula.
  IF EXISTS (
    SELECT 1 FROM "AlocacaoTurma" posterior
      JOIN "Turma" turma_posterior ON turma_posterior.id = posterior."turmaId"
    WHERE posterior."matriculaId" = NEW."matriculaId"
      AND turma_posterior."nivelId" = NEW."nivelId"
      AND (posterior."criadoEm", posterior.id) > (criada_referencia, NEW."alocacaoReferenciaId")
  ) THEN
    RAISE EXCEPTION 'Fechamento exige a alocação mais recente da matrícula neste nível';
  END IF;

  IF NEW.versao <> COALESCE((
    SELECT MAX(f.versao) + 1 FROM "FechamentoAcademico" f
    WHERE f."matriculaId" = NEW."matriculaId" AND f."nivelId" = NEW."nivelId"
  ), 1) THEN
    RAISE EXCEPTION 'Versão do fechamento acadêmico está desatualizada';
  END IF;

  IF jsonb_typeof(NEW.snapshot->'contexto') IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.snapshot->'consolidado') IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.snapshot #> '{consolidado,resultado}') IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.snapshot->'frequencia') IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.snapshot->'pendenciasPorVinculo') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW.snapshot->'elegibilidade') IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.snapshot->'fontesOficiais') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Snapshot do fechamento acadêmico está incompleto';
  END IF;
  IF (NEW.snapshot->>'versao') IS DISTINCT FROM '1'
    OR NEW.snapshot #>> '{contexto,matriculaId}' IS DISTINCT FROM NEW."matriculaId"
    OR NEW.snapshot #>> '{contexto,nivelId}' IS DISTINCT FROM NEW."nivelId"
    OR NEW.snapshot #>> '{contexto,alocacaoReferenciaId}' IS DISTINCT FROM NEW."alocacaoReferenciaId"
    OR NEW.snapshot #>> '{contexto,regraId}' IS DISTINCT FROM NEW."regraId" THEN
    RAISE EXCEPTION 'Contexto do snapshot diverge do fechamento';
  END IF;
  IF NEW.snapshot #> '{elegibilidade,podeFechar}' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Fechamento exige elegibilidade atual para fechar';
  END IF;
  IF jsonb_typeof(NEW.snapshot #> '{elegibilidade,pendencias}') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Snapshot precisa declarar as pendências de elegibilidade';
  END IF;
  IF jsonb_array_length(NEW.snapshot #> '{elegibilidade,pendencias}') <> 0 THEN
    RAISE EXCEPTION 'Pendências impedem o fechamento acadêmico';
  END IF;

  IF NEW.snapshot #>> '{consolidado,resultado,completa}' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Fechamento exige consolidado completo';
  END IF;
  IF NEW."resultadoSuficiente" THEN
    IF NEW.snapshot #>> '{consolidado,resultado,atendeRequisitosNotas}' IS DISTINCT FROM 'true'
      OR NEW.snapshot #>> '{elegibilidade,situacao}' IS DISTINCT FROM 'SUFICIENTE'
      OR NEW.snapshot #> '{elegibilidade,podeProgredir}' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'Fechamento suficiente exige elegibilidade coerente para progressão';
    END IF;
  ELSIF NEW.snapshot #>> '{elegibilidade,situacao}' IS DISTINCT FROM 'INSUFICIENTE'
    OR NEW.snapshot #> '{elegibilidade,podeProgredir}' IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'Fechamento insuficiente exige elegibilidade coerente';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "FechamentoAcademico_validar"
  BEFORE INSERT ON "FechamentoAcademico"
  FOR EACH ROW EXECUTE FUNCTION "validar_fechamento_academico"();

CREATE OR REPLACE FUNCTION "proteger_historico_fechamento_academico"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'FechamentoAcademico é histórico e não pode ser alterado ou removido';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "FechamentoAcademico_proteger"
  BEFORE UPDATE OR DELETE ON "FechamentoAcademico"
  FOR EACH ROW EXECUTE FUNCTION "proteger_historico_fechamento_academico"();
