-- 211: referência imutável da gravação institucional de uma aula. Esta
-- publicação ainda não altera o status do encontro; a conclusão é uma ação
-- posterior que deve validar a chamada e esta fonte sob a mesma trava.
CREATE TABLE "PublicacaoGravacaoAula" (
  "id" TEXT NOT NULL,
  "encontroId" TEXT NOT NULL,
  "publicadorId" TEXT NOT NULL,
  "arquivoOficialId" TEXT NOT NULL,
  "driveOrganizacaoId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "conferidaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  snapshot JSONB NOT NULL,

  CONSTRAINT "PublicacaoGravacaoAula_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicacaoGravacaoAula_arquivoOficialId_formato_check" CHECK ("arquivoOficialId" ~ '^[A-Za-z0-9_-]{3,500}$'),
  CONSTRAINT "PublicacaoGravacaoAula_driveOrganizacaoId_formato_check" CHECK ("driveOrganizacaoId" ~ '^[A-Za-z0-9_-]{3,500}$'),
  CONSTRAINT "PublicacaoGravacaoAula_mimeType_video_check" CHECK ("mimeType" ~* '^video/[A-Za-z0-9][A-Za-z0-9.!#$&^_+-]*$'),
  CONSTRAINT "PublicacaoGravacaoAula_chave_tamanho_check" CHECK (length(btrim("chaveIdempotencia")) BETWEEN 8 AND 100),
  CONSTRAINT "PublicacaoGravacaoAula_chave_sem_espacos_check" CHECK ("chaveIdempotencia" = btrim("chaveIdempotencia")),
  CONSTRAINT "PublicacaoGravacaoAula_entradaHash_formato_check" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PublicacaoGravacaoAula_snapshot_objeto_check" CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE UNIQUE INDEX "PublicacaoGravacaoAula_encontroId_key"
  ON "PublicacaoGravacaoAula"("encontroId");
CREATE UNIQUE INDEX "PublicacaoGravacaoAula_publicadorId_chaveIdempotencia_key"
  ON "PublicacaoGravacaoAula"("publicadorId", "chaveIdempotencia");

ALTER TABLE "PublicacaoGravacaoAula"
  ADD CONSTRAINT "PublicacaoGravacaoAula_encontroId_fkey"
    FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PublicacaoGravacaoAula_publicadorId_fkey"
    FOREIGN KEY ("publicadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION validar_publicacao_gravacao_aula_211()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  encontro_finalidade TEXT;
  encontro_status TEXT;
  encontro_fim TIMESTAMP(3);
  encontro_professor_id TEXT;
  diario_id TEXT;
  diario_professor_id TEXT;
  publicador_ativo BOOLEAN;
  publicador_papeis "Papel"[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Publicações de gravação de aula são imutáveis';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  SELECT encontro.finalidade::text, encontro.status::text, encontro.fim, encontro."professorId",
    diario.id, diario."professorId"
    INTO encontro_finalidade, encontro_status, encontro_fim, encontro_professor_id,
      diario_id, diario_professor_id
    FROM "EncontroAgenda" encontro
    JOIN "AulaDiario" diario ON diario."encontroId" = encontro.id
    WHERE encontro.id = NEW."encontroId"
    FOR UPDATE OF encontro, diario;
  IF NOT FOUND
    OR encontro_finalidade IS DISTINCT FROM 'AULA'
    OR encontro_status IS DISTINCT FROM 'PREVISTO'
    OR encontro_fim > (clock_timestamp() AT TIME ZONE 'UTC')
    OR diario_id IS NULL
    OR diario_professor_id IS DISTINCT FROM encontro_professor_id THEN
    RAISE EXCEPTION 'Publicação exige aula prevista já encerrada com diário do professor original';
  END IF;

  SELECT ativo, papeis INTO publicador_ativo, publicador_papeis
    FROM "Usuario" WHERE id = NEW."publicadorId" FOR SHARE;
  IF NOT FOUND OR NOT publicador_ativo THEN
    RAISE EXCEPTION 'Publicação exige usuário ativo';
  END IF;

  IF NEW."publicadorId" IS DISTINCT FROM encontro_professor_id
    OR 'PROFESSOR'::"Papel" <> ALL(publicador_papeis) THEN
    IF ('PROFESSOR'::"Papel" <> ALL(publicador_papeis)
        AND 'GERENTE_PEDAGOGICO'::"Papel" <> ALL(publicador_papeis)
        AND 'ADMINISTRADOR'::"Papel" <> ALL(publicador_papeis))
      OR NOT EXISTS (
        SELECT 1
        FROM "DesignacaoRegularizacaoAula" designacao
        WHERE designacao."encontroId" = NEW."encontroId"
          AND designacao."responsavelId" = NEW."publicadorId"
          AND NOT EXISTS (
            SELECT 1 FROM "RevogacaoDesignacaoRegularizacaoAula" revogacao
            WHERE revogacao."designacaoId" = designacao.id
          )
      ) THEN
      RAISE EXCEPTION 'Publicação exige professor original ativo ou designação de regularização vigente';
    END IF;
  END IF;

  IF jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.snapshot -> 'encontroId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW.snapshot -> 'diarioId') IS DISTINCT FROM 'string'
    OR NEW.snapshot ->> 'encontroId' IS DISTINCT FROM NEW."encontroId"
    OR NEW.snapshot ->> 'diarioId' IS DISTINCT FROM diario_id THEN
    RAISE EXCEPTION 'Snapshot da publicação deve identificar o encontro e o diário originais';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "PublicacaoGravacaoAula_validar_211"
  BEFORE INSERT OR UPDATE OR DELETE ON "PublicacaoGravacaoAula"
  FOR EACH ROW EXECUTE FUNCTION validar_publicacao_gravacao_aula_211();
