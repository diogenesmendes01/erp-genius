-- Q121: registro preparatório. Não cancela matrícula, contrato, cobrança, reserva
-- ou alocação; decisão e efetivação pertencem a incrementos posteriores.
CREATE TABLE "PedidoDesistenciaPreparacao" (
  "id" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  "registradorId" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "motivo" TEXT NOT NULL,
  "evidenciaPedido" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "PedidoDesistenciaPreparacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PedidoDesistenciaPreparacao_versao_positiva" CHECK ("versao" > 0),
  CONSTRAINT "PedidoDesistenciaPreparacao_motivo_tamanho" CHECK (length(btrim("motivo")) BETWEEN 5 AND 3000),
  CONSTRAINT "PedidoDesistenciaPreparacao_evidencia_tamanho" CHECK (length(btrim("evidenciaPedido")) BETWEEN 10 AND 3000),
  CONSTRAINT "PedidoDesistenciaPreparacao_chave_tamanho" CHECK (length(btrim("chaveIdempotencia")) BETWEEN 8 AND 100),
  CONSTRAINT "PedidoDesistenciaPreparacao_hashes_formato" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$' AND "estadoHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PedidoDesistenciaPreparacao_snapshot_objeto" CHECK (jsonb_typeof("snapshotJson") = 'object')
);

CREATE UNIQUE INDEX "PedidoDesistenciaPreparacao_registradorId_chaveIdempotencia_key"
  ON "PedidoDesistenciaPreparacao"("registradorId", "chaveIdempotencia");
CREATE UNIQUE INDEX "PedidoDesistenciaPreparacao_matriculaId_versao_key"
  ON "PedidoDesistenciaPreparacao"("matriculaId", "versao");
CREATE INDEX "PedidoDesistenciaPreparacao_matriculaId_criadaEm_idx"
  ON "PedidoDesistenciaPreparacao"("matriculaId", "criadaEm");

ALTER TABLE "PedidoDesistenciaPreparacao"
  ADD CONSTRAINT "PedidoDesistenciaPreparacao_matriculaId_fkey"
    FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "PedidoDesistenciaPreparacao_registradorId_fkey"
    FOREIGN KEY ("registradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION validar_pedido_desistencia_preparacao()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  matricula_atual RECORD;
  ultima_versao INTEGER;
  usuario_atual RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Pedido de desistência deve permanecer preservado';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  SELECT status, "ativadaEm" INTO matricula_atual FROM "Matricula" WHERE id = NEW."matriculaId";
  IF NOT FOUND OR matricula_atual.status NOT IN ('RASCUNHO', 'AGUARDANDO') OR matricula_atual."ativadaEm" IS NOT NULL THEN
    RAISE EXCEPTION 'Pedido exige matrícula ainda em preparação';
  END IF;
  PERFORM id FROM "Usuario" WHERE id = NEW."registradorId" FOR SHARE;
  SELECT ativo, papeis INTO usuario_atual FROM "Usuario" WHERE id = NEW."registradorId";
  IF NOT FOUND OR NOT usuario_atual.ativo OR NOT ('SECRETARIA_ACADEMICA'::"Papel" = ANY(usuario_atual.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(usuario_atual.papeis)) THEN
    RAISE EXCEPTION 'Pedido exige Secretaria ou Administração ativa';
  END IF;
  IF NEW."snapshotJson"->>'matriculaId' IS DISTINCT FROM NEW."matriculaId" THEN
    RAISE EXCEPTION 'Snapshot não corresponde à matrícula do pedido';
  END IF;
  SELECT COALESCE(max(versao), 0) INTO ultima_versao FROM "PedidoDesistenciaPreparacao" WHERE "matriculaId" = NEW."matriculaId";
  IF NEW.versao <> ultima_versao + 1 THEN
    RAISE EXCEPTION 'Versão de pedido de desistência inválida';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PedidoDesistenciaPreparacao_validar"
  BEFORE INSERT OR UPDATE OR DELETE ON "PedidoDesistenciaPreparacao"
  FOR EACH ROW EXECUTE FUNCTION validar_pedido_desistencia_preparacao();

