-- Q153 — persistência de propostas, decisões e aplicações de equivalência.
--
-- Transferência equivalente no mesmo nível. As fontes de avaliação ficam em
-- snapshot/mapeamentos JSONB deliberadamente: há fontes regulares agora e as
-- futuras fontes oficiais de recuperação/aproveitamento anterior precisam ser
-- acrescentadas sem uma FK que as descarte. O serviço revalida cada referência
-- tipada antes da proposta e da aplicação.
--
-- Não há trigger global para MovimentacaoAluno.tipo = TROCA_TURMA. A mudança de
-- nível por exceção também usa esse tipo; este fluxo é distinguido pela própria
-- AplicacaoEquivalenciaAvaliacao vinculada à decisão aprovada.

CREATE TABLE "PropostaEquivalenciaAvaliacao" (
  id TEXT PRIMARY KEY,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "alocacaoOrigemId" TEXT NOT NULL REFERENCES "AlocacaoTurma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "turmaOrigemId" TEXT NOT NULL REFERENCES "Turma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "turmaDestinoId" TEXT NOT NULL REFERENCES "Turma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "regraOrigemId" TEXT NOT NULL REFERENCES "VersaoRegraAvaliacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "regraDestinoId" TEXT NOT NULL REFERENCES "VersaoRegraAvaliacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  versao INTEGER NOT NULL CHECK (versao > 0),
  mapeamentos JSONB NOT NULL CHECK (jsonb_typeof(mapeamentos) = 'array'),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) > 0),
  "preparadorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "chaveIdempotencia" TEXT NOT NULL CHECK (length(btrim("chaveIdempotencia")) > 0),
  "entradaHash" TEXT NOT NULL CHECK (length(btrim("entradaHash")) > 0),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT "PropostaEquivalenciaAvaliacao_contexto_versao_key"
    UNIQUE ("matriculaId", "alocacaoOrigemId", "turmaDestinoId", versao),
  CONSTRAINT "PropostaEquivalenciaAvaliacao_idempotencia_key"
    UNIQUE ("preparadorId", "chaveIdempotencia")
);
CREATE INDEX "PropostaEquivalenciaAvaliacao_matricula_destino_criada_idx"
  ON "PropostaEquivalenciaAvaliacao" ("matriculaId", "turmaDestinoId", "criadaEm");
CREATE INDEX "PropostaEquivalenciaAvaliacao_origem_criada_idx"
  ON "PropostaEquivalenciaAvaliacao" ("alocacaoOrigemId", "criadaEm");

CREATE TABLE "DecisaoEquivalenciaAvaliacao" (
  id TEXT PRIMARY KEY,
  "propostaId" TEXT NOT NULL UNIQUE REFERENCES "PropostaEquivalenciaAvaliacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL CHECK (length(btrim(motivo)) > 0),
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);

CREATE TABLE "AplicacaoEquivalenciaAvaliacao" (
  id TEXT PRIMARY KEY,
  "decisaoId" TEXT NOT NULL UNIQUE REFERENCES "DecisaoEquivalenciaAvaliacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "alocacaoOrigemId" TEXT NOT NULL REFERENCES "AlocacaoTurma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "alocacaoDestinoId" TEXT NOT NULL UNIQUE REFERENCES "AlocacaoTurma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "turmaOrigemId" TEXT NOT NULL REFERENCES "Turma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "turmaDestinoId" TEXT NOT NULL REFERENCES "Turma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "regraOrigemId" TEXT NOT NULL REFERENCES "VersaoRegraAvaliacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "regraDestinoId" TEXT NOT NULL REFERENCES "VersaoRegraAvaliacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "movimentacaoId" TEXT NOT NULL UNIQUE REFERENCES "MovimentacaoAluno"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "mapeamentosAplicados" JSONB NOT NULL CHECK (jsonb_typeof("mapeamentosAplicados") = 'array'),
  "snapshotAplicado" JSONB NOT NULL CHECK (jsonb_typeof("snapshotAplicado") = 'object'),
  "aplicacaoHash" TEXT NOT NULL CHECK (length(btrim("aplicacaoHash")) > 0),
  "aplicadoPorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE INDEX "AplicacaoEquivalenciaAvaliacao_matricula_aplicada_idx"
  ON "AplicacaoEquivalenciaAvaliacao" ("matriculaId", "aplicadaEm");
CREATE INDEX "AplicacaoEquivalenciaAvaliacao_origem_aplicada_idx"
  ON "AplicacaoEquivalenciaAvaliacao" ("alocacaoOrigemId", "aplicadaEm");

-- Contexto e versão da proposta. O serviço ainda compara o snapshot às fontes
-- oficiais atuais; este guard preserva o vínculo de matrícula, turma e regra
-- mesmo quando alguém tentar inserir pela camada SQL.
CREATE OR REPLACE FUNCTION "validar_proposta_equivalencia_avaliacao"()
RETURNS TRIGGER AS $$
DECLARE
  nivel_origem TEXT;
  nivel_destino TEXT;
  turma_da_alocacao TEXT;
  regra_origem TEXT;
  regra_destino TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'equivalencia-avaliacao:' || NEW."matriculaId" || ':' || NEW."alocacaoOrigemId" || ':' || NEW."turmaDestinoId", 0));

  PERFORM id FROM "Usuario"
    WHERE id = NEW."preparadorId" AND ativo
      AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta de equivalência exige gestão pedagógica ou administração ativa';
  END IF;

  SELECT a."turmaId" INTO turma_da_alocacao
    FROM "AlocacaoTurma" a
    WHERE a.id = NEW."alocacaoOrigemId" AND a."matriculaId" = NEW."matriculaId";
  IF turma_da_alocacao IS DISTINCT FROM NEW."turmaOrigemId" THEN
    RAISE EXCEPTION 'Alocação de origem não pertence à matrícula ou turma informadas';
  END IF;

  SELECT t."nivelId", t."regraAvaliacaoId" INTO nivel_origem, regra_origem
    FROM "Turma" t WHERE t.id = NEW."turmaOrigemId";
  SELECT t."nivelId", t."regraAvaliacaoId" INTO nivel_destino, regra_destino
    FROM "Turma" t WHERE t.id = NEW."turmaDestinoId";
  IF nivel_origem IS NULL OR nivel_destino IS NULL OR nivel_origem <> nivel_destino
     OR NEW."turmaOrigemId" = NEW."turmaDestinoId" THEN
    RAISE EXCEPTION 'Equivalência exige turmas distintas do mesmo nível';
  END IF;
  IF regra_origem IS DISTINCT FROM NEW."regraOrigemId"
     OR regra_destino IS DISTINCT FROM NEW."regraDestinoId" THEN
    RAISE EXCEPTION 'Versões de regra não correspondem às turmas da proposta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "VersaoRegraAvaliacao" r WHERE r.id = NEW."regraOrigemId" AND r."nivelId" = nivel_origem)
     OR NOT EXISTS (SELECT 1 FROM "VersaoRegraAvaliacao" r WHERE r.id = NEW."regraDestinoId" AND r."nivelId" = nivel_destino) THEN
    RAISE EXCEPTION 'Regra de avaliação pertence a outro nível';
  END IF;
  IF NEW.versao <> COALESCE((
    SELECT MAX(p.versao) + 1 FROM "PropostaEquivalenciaAvaliacao" p
    WHERE p."matriculaId" = NEW."matriculaId"
      AND p."alocacaoOrigemId" = NEW."alocacaoOrigemId"
      AND p."turmaDestinoId" = NEW."turmaDestinoId"
  ), 1) THEN
    RAISE EXCEPTION 'Versão da proposta de equivalência está desatualizada';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PropostaEquivalenciaAvaliacao_validar"
  BEFORE INSERT ON "PropostaEquivalenciaAvaliacao"
  FOR EACH ROW EXECUTE FUNCTION "validar_proposta_equivalencia_avaliacao"();

CREATE OR REPLACE FUNCTION "validar_decisao_equivalencia_avaliacao"()
RETURNS TRIGGER AS $$
DECLARE proposta "PropostaEquivalenciaAvaliacao"%ROWTYPE;
BEGIN
  SELECT * INTO proposta FROM "PropostaEquivalenciaAvaliacao" WHERE id = NEW."propostaId" FOR SHARE;
  IF proposta.id IS NULL THEN RAISE EXCEPTION 'Proposta de equivalência inexistente'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'equivalencia-avaliacao:' || proposta."matriculaId" || ':' || proposta."alocacaoOrigemId" || ':' || proposta."turmaDestinoId", 0));
  IF proposta."preparadorId" = NEW."decisorId" THEN
    RAISE EXCEPTION 'Equivalência exige decisão por outra pessoa';
  END IF;
  PERFORM id FROM "Usuario"
    WHERE id = NEW."decisorId" AND ativo
      AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decisão de equivalência exige gestão ativa';
  END IF;
  IF NEW.aprovada AND proposta.versao <> (
    SELECT MAX(versao) FROM "PropostaEquivalenciaAvaliacao"
    WHERE "matriculaId" = proposta."matriculaId"
      AND "alocacaoOrigemId" = proposta."alocacaoOrigemId"
      AND "turmaDestinoId" = proposta."turmaDestinoId"
  ) THEN
    RAISE EXCEPTION 'Há proposta de equivalência mais recente';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DecisaoEquivalenciaAvaliacao_validar"
  BEFORE INSERT ON "DecisaoEquivalenciaAvaliacao"
  FOR EACH ROW EXECUTE FUNCTION "validar_decisao_equivalencia_avaliacao"();

CREATE OR REPLACE FUNCTION "validar_aplicacao_equivalencia_avaliacao"()
RETURNS TRIGGER AS $$
DECLARE
  proposta "PropostaEquivalenciaAvaliacao"%ROWTYPE;
  a_origem "AlocacaoTurma"%ROWTYPE;
  a_destino "AlocacaoTurma"%ROWTYPE;
  movimento "MovimentacaoAluno"%ROWTYPE;
BEGIN
  SELECT prop.* INTO proposta
    FROM "DecisaoEquivalenciaAvaliacao" d
    JOIN "PropostaEquivalenciaAvaliacao" prop ON prop.id = d."propostaId"
    WHERE d.id = NEW."decisaoId" AND d.aprovada
    FOR SHARE OF prop;
  IF proposta.id IS NULL THEN RAISE EXCEPTION 'Aplicação exige decisão de equivalência aprovada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'equivalencia-avaliacao:' || proposta."matriculaId" || ':' || proposta."alocacaoOrigemId" || ':' || proposta."turmaDestinoId", 0));
  IF proposta.versao <> (
    SELECT MAX(versao) FROM "PropostaEquivalenciaAvaliacao"
    WHERE "matriculaId" = proposta."matriculaId"
      AND "alocacaoOrigemId" = proposta."alocacaoOrigemId"
      AND "turmaDestinoId" = proposta."turmaDestinoId"
  ) THEN
    RAISE EXCEPTION 'Uma proposta de equivalência mais recente exige nova decisão';
  END IF;

  PERFORM id FROM "Usuario"
    WHERE id = NEW."aplicadoPorId" AND ativo
      AND papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aplicação exige secretaria acadêmica ou administração ativa'; END IF;

  IF (NEW."matriculaId", NEW."alocacaoOrigemId", NEW."turmaOrigemId", NEW."turmaDestinoId", NEW."regraOrigemId", NEW."regraDestinoId")
      IS DISTINCT FROM
     (proposta."matriculaId", proposta."alocacaoOrigemId", proposta."turmaOrigemId", proposta."turmaDestinoId", proposta."regraOrigemId", proposta."regraDestinoId") THEN
    RAISE EXCEPTION 'Aplicação diverge do contexto aprovado';
  END IF;
  IF NEW."mapeamentosAplicados" IS DISTINCT FROM proposta.mapeamentos THEN
    RAISE EXCEPTION 'Aplicação diverge dos mapeamentos aprovados';
  END IF;

  SELECT * INTO a_origem FROM "AlocacaoTurma"
    WHERE id = NEW."alocacaoOrigemId" AND "matriculaId" = NEW."matriculaId" FOR SHARE;
  SELECT * INTO a_destino FROM "AlocacaoTurma"
    WHERE id = NEW."alocacaoDestinoId" AND "matriculaId" = NEW."matriculaId" FOR SHARE;
  IF a_origem.id IS NULL OR a_origem."turmaId" <> proposta."turmaOrigemId" OR a_origem.ativa
     OR a_origem."encerradaEm" IS NULL
     OR a_destino.id IS NULL OR a_destino."turmaId" <> proposta."turmaDestinoId" OR NOT a_destino.ativa
     OR a_origem."alunoId" IS DISTINCT FROM a_destino."alunoId"
     OR a_origem."encerradaEm" > a_destino."criadoEm" THEN
    RAISE EXCEPTION 'Aplicação exige alocações cronológicas, de mesmo aluno, origem encerrada e destino ativo';
  END IF;

  SELECT * INTO movimento FROM "MovimentacaoAluno" WHERE id = NEW."movimentacaoId" FOR SHARE;
  IF movimento.id IS NULL OR movimento."matriculaId" IS DISTINCT FROM NEW."matriculaId"
     OR movimento."alunoId" IS DISTINCT FROM a_destino."alunoId" OR movimento.tipo <> 'TROCA_TURMA'
     OR movimento."turmaOrigemId" IS DISTINCT FROM proposta."turmaOrigemId"
     OR movimento."turmaDestinoId" IS DISTINCT FROM proposta."turmaDestinoId"
     OR movimento."usuarioId" IS DISTINCT FROM NEW."aplicadoPorId"
     OR a_destino."criadoEm" > movimento."criadoEm"
     OR a_origem."encerradaEm" > movimento."criadoEm"
     OR movimento."criadoEm" > NEW."aplicadaEm" THEN
    RAISE EXCEPTION 'Movimentação não corresponde à transferência de equivalência aprovada';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AplicacaoEquivalenciaAvaliacao_validar"
  BEFORE INSERT ON "AplicacaoEquivalenciaAvaliacao"
  FOR EACH ROW EXECUTE FUNCTION "validar_aplicacao_equivalencia_avaliacao"();

CREATE OR REPLACE FUNCTION "proteger_historico_equivalencia_avaliacao"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% é histórico e não pode ser alterado ou removido', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PropostaEquivalenciaAvaliacao_proteger"
  BEFORE UPDATE OR DELETE ON "PropostaEquivalenciaAvaliacao"
  FOR EACH ROW EXECUTE FUNCTION "proteger_historico_equivalencia_avaliacao"();
CREATE TRIGGER "DecisaoEquivalenciaAvaliacao_proteger"
  BEFORE UPDATE OR DELETE ON "DecisaoEquivalenciaAvaliacao"
  FOR EACH ROW EXECUTE FUNCTION "proteger_historico_equivalencia_avaliacao"();
CREATE TRIGGER "AplicacaoEquivalenciaAvaliacao_proteger"
  BEFORE UPDATE OR DELETE ON "AplicacaoEquivalenciaAvaliacao"
  FOR EACH ROW EXECUTE FUNCTION "proteger_historico_equivalencia_avaliacao"();
