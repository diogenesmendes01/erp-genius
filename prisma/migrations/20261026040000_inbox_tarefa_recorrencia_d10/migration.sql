BEGIN;
CREATE TYPE "RecorrenciaTarefa" AS ENUM ('NAO_REPETE','DIARIA','SEMANAL','MENSAL');
CREATE TYPE "EstadoIntencaoRecorrenciaTarefa" AS ENUM ('PENDENTE','MATERIALIZADA','CANCELADA_REABERTURA','IMPEDIDA_CONTEXTO');
ALTER TABLE "Tarefa"
  ADD COLUMN "recorrencia" "RecorrenciaTarefa" NOT NULL DEFAULT 'NAO_REPETE',
  ADD COLUMN "recorrenciaAncoraDataCivil" TEXT,
  ADD COLUMN "recorrenciaAncoraHora" TEXT,
  ADD COLUMN "recorrenciaAncoraFuso" TEXT,
  ADD COLUMN "recorrenciaPoliticaVersao" INTEGER,
  ADD COLUMN "recorrenciaIndice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recorrenciaAnteriorId" TEXT,
  ADD CONSTRAINT "Tarefa_recorrencia_indice_check" CHECK ("recorrenciaIndice">=0),
  ADD CONSTRAINT "Tarefa_recorrencia_ancora_check" CHECK (
    "recorrencia"='NAO_REPETE' OR (
      "recorrenciaAncoraDataCivil" IS NOT NULL AND "recorrenciaAncoraFuso" IS NOT NULL
      AND "recorrenciaPoliticaVersao" IS NOT NULL AND "recorrenciaPoliticaVersao"=1)),
  ADD CONSTRAINT "Tarefa_recorrencia_hora_check" CHECK (
    "recorrenciaAncoraHora" IS NULL OR "recorrenciaAncoraHora" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "Tarefa_recorrencia_predecessor_check" CHECK ("recorrenciaAnteriorId" IS NULL OR "recorrenciaAnteriorId"<>id);
CREATE UNIQUE INDEX "Tarefa_recorrenciaAnteriorId_key" ON "Tarefa"("recorrenciaAnteriorId");
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_recorrenciaAnteriorId_fkey"
  FOREIGN KEY ("recorrenciaAnteriorId") REFERENCES "Tarefa"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "IntencaoRecorrenciaTarefa" (
  id TEXT NOT NULL,
  "tarefaId" TEXT NOT NULL,
  "conclusaoVersao" INTEGER NOT NULL,
  estado "EstadoIntencaoRecorrenciaTarefa" NOT NULL DEFAULT 'PENDENTE',
  versao INTEGER NOT NULL DEFAULT 0,
  "corteEm" TIMESTAMP(3) NOT NULL,
  snapshot JSONB NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadaEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntencaoRecorrenciaTarefa_pkey" PRIMARY KEY (id),
  CONSTRAINT "IntencaoRecorrenciaTarefa_versoes_check" CHECK (versao>=0 AND "conclusaoVersao">=0),
  CONSTRAINT "IntencaoRecorrenciaTarefa_snapshot_check" CHECK ((jsonb_typeof(snapshot)='object' AND snapshot->'versao' = '1'::jsonb) IS TRUE),
  CONSTRAINT "IntencaoRecorrenciaTarefa_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IntencaoRecorrenciaTarefa_tarefaId_conclusaoVersao_key" ON "IntencaoRecorrenciaTarefa"("tarefaId","conclusaoVersao");
CREATE UNIQUE INDEX "IntencaoRecorrenciaTarefa_pendente_unica" ON "IntencaoRecorrenciaTarefa"("tarefaId") WHERE estado='PENDENTE';
CREATE INDEX "IntencaoRecorrenciaTarefa_estado_criadaEm_id_idx" ON "IntencaoRecorrenciaTarefa"(estado,"criadaEm",id);
COMMIT;
