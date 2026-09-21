-- Q24: a regularização pode ser delegada pontualmente em aula já encerrada,
-- sem substituir professor, turma ou fatos já lançados no diário.
CREATE TABLE "DesignacaoRegularizacaoAula" (
  "id" TEXT NOT NULL,
  "encontroId" TEXT NOT NULL,
  "responsavelId" TEXT NOT NULL,
  "designadorId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "DesignacaoRegularizacaoAula_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DesignacaoRegularizacaoAula_motivo_tamanho_check" CHECK (length(btrim("motivo")) BETWEEN 5 AND 2000),
  CONSTRAINT "DesignacaoRegularizacaoAula_chave_tamanho_check" CHECK (length(btrim("chaveIdempotencia")) BETWEEN 8 AND 200),
  CONSTRAINT "DesignacaoRegularizacaoAula_chave_sem_espacos_check" CHECK ("chaveIdempotencia" = btrim("chaveIdempotencia")),
  CONSTRAINT "DesignacaoRegularizacaoAula_entradaHash_formato_check" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "RevogacaoDesignacaoRegularizacaoAula" (
  "id" TEXT NOT NULL,
  "designacaoId" TEXT NOT NULL,
  "revogadorId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "RevogacaoDesignacaoRegularizacaoAula_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RevogacaoDesignacaoRegularizacaoAula_motivo_tamanho_check" CHECK (length(btrim("motivo")) BETWEEN 5 AND 2000)
);

CREATE UNIQUE INDEX "DesignacaoRegularizacaoAula_designadorId_chaveIdempotencia_key"
  ON "DesignacaoRegularizacaoAula"("designadorId", "chaveIdempotencia");
CREATE INDEX "DesignacaoRegularizacaoAula_encontroId_idx"
  ON "DesignacaoRegularizacaoAula"("encontroId");
CREATE UNIQUE INDEX "RevogacaoDesignacaoRegularizacaoAula_designacaoId_key"
  ON "RevogacaoDesignacaoRegularizacaoAula"("designacaoId");

ALTER TABLE "DesignacaoRegularizacaoAula"
  ADD CONSTRAINT "DesignacaoRegularizacaoAula_encontroId_fkey"
    FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "DesignacaoRegularizacaoAula_responsavelId_fkey"
    FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "DesignacaoRegularizacaoAula_designadorId_fkey"
    FOREIGN KEY ("designadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "RevogacaoDesignacaoRegularizacaoAula"
  ADD CONSTRAINT "RevogacaoDesignacaoRegularizacaoAula_designacaoId_fkey"
    FOREIGN KEY ("designacaoId") REFERENCES "DesignacaoRegularizacaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "RevogacaoDesignacaoRegularizacaoAula_revogadorId_fkey"
    FOREIGN KEY ("revogadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION validar_designacao_regularizacao_aula_q24()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  encontro_finalidade TEXT;
  encontro_status TEXT;
  encontro_fim TIMESTAMP(3);
  designador_ativo BOOLEAN;
  designador_papeis "Papel"[];
  responsavel_ativo BOOLEAN;
  responsavel_papeis "Papel"[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Designações de regularização de aula são imutáveis';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  SELECT finalidade::text, status::text, fim
    INTO encontro_finalidade, encontro_status, encontro_fim
    FROM "EncontroAgenda"
    WHERE id = NEW."encontroId"
    FOR UPDATE;
  IF NOT FOUND
    OR encontro_finalidade IS DISTINCT FROM 'AULA'
    OR encontro_status IS DISTINCT FROM 'PREVISTO'
    OR encontro_fim > (clock_timestamp() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Designação exige aula prevista já encerrada';
  END IF;

  SELECT ativo, papeis INTO designador_ativo, designador_papeis
    FROM "Usuario" WHERE id = NEW."designadorId" FOR SHARE;
  IF NOT FOUND OR NOT designador_ativo
    OR ('GERENTE_PEDAGOGICO'::"Papel" <> ALL(designador_papeis)
      AND 'ADMINISTRADOR'::"Papel" <> ALL(designador_papeis)) THEN
    RAISE EXCEPTION 'Designação exige gestor pedagógico ou administrador ativo';
  END IF;

  SELECT ativo, papeis INTO responsavel_ativo, responsavel_papeis
    FROM "Usuario" WHERE id = NEW."responsavelId" FOR SHARE;
  IF NOT FOUND OR NOT responsavel_ativo
    OR ('PROFESSOR'::"Papel" <> ALL(responsavel_papeis)
      AND 'GERENTE_PEDAGOGICO'::"Papel" <> ALL(responsavel_papeis)
      AND 'ADMINISTRADOR'::"Papel" <> ALL(responsavel_papeis)) THEN
    RAISE EXCEPTION 'Responsável exige professor, gestor pedagógico ou administrador ativo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "DesignacaoRegularizacaoAula" designacao
    WHERE designacao."encontroId" = NEW."encontroId"
      AND NOT EXISTS (
        SELECT 1 FROM "RevogacaoDesignacaoRegularizacaoAula" revogacao
        WHERE revogacao."designacaoId" = designacao.id
      )
  ) THEN
    RAISE EXCEPTION 'Aula já possui designação de regularização vigente';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validar_revogacao_designacao_regularizacao_aula_q24()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  encontro_finalidade TEXT;
  encontro_status TEXT;
  encontro_fim TIMESTAMP(3);
  revogador_ativo BOOLEAN;
  revogador_papeis "Papel"[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Revogações de designação de regularização de aula são imutáveis';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  SELECT encontro.finalidade::text, encontro.status::text, encontro.fim
    INTO encontro_finalidade, encontro_status, encontro_fim
    FROM "DesignacaoRegularizacaoAula" designacao
    JOIN "EncontroAgenda" encontro ON encontro.id = designacao."encontroId"
    WHERE designacao.id = NEW."designacaoId"
    FOR UPDATE OF designacao, encontro;
  IF NOT FOUND
    OR encontro_finalidade IS DISTINCT FROM 'AULA'
    OR encontro_status IS DISTINCT FROM 'PREVISTO'
    OR encontro_fim > (clock_timestamp() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Revogação exige designação de aula prevista já encerrada';
  END IF;

  SELECT ativo, papeis INTO revogador_ativo, revogador_papeis
    FROM "Usuario" WHERE id = NEW."revogadorId" FOR SHARE;
  IF NOT FOUND OR NOT revogador_ativo
    OR ('GERENTE_PEDAGOGICO'::"Papel" <> ALL(revogador_papeis)
      AND 'ADMINISTRADOR'::"Papel" <> ALL(revogador_papeis)) THEN
    RAISE EXCEPTION 'Revogação exige gestor pedagógico ou administrador ativo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "RevogacaoDesignacaoRegularizacaoAula"
    WHERE "designacaoId" = NEW."designacaoId"
  ) THEN
    RAISE EXCEPTION 'Designação de regularização já foi revogada';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "DesignacaoRegularizacaoAula_validar_q24"
  BEFORE INSERT OR UPDATE OR DELETE ON "DesignacaoRegularizacaoAula"
  FOR EACH ROW EXECUTE FUNCTION validar_designacao_regularizacao_aula_q24();

CREATE TRIGGER "RevogacaoDesignacaoRegularizacaoAula_validar_q24"
  BEFORE INSERT OR UPDATE OR DELETE ON "RevogacaoDesignacaoRegularizacaoAula"
  FOR EACH ROW EXECUTE FUNCTION validar_revogacao_designacao_regularizacao_aula_q24();
