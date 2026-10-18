-- CreateEnum
CREATE TYPE "MetricaMeta" AS ENUM ('MATRICULAS', 'VALOR_GANHO', 'EXPERIMENTAIS_REALIZADAS');

-- CreateTable
CREATE TABLE "MetaComercial" (
    "id" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "usuarioId" TEXT,
    "metrica" "MetricaMeta" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT,
    "criadaPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaComercial_competencia_idx" ON "MetaComercial"("competencia");

-- CreateIndex
CREATE UNIQUE INDEX "MetaComercial_competencia_usuarioId_metrica_moeda_key" ON "MetaComercial"("competencia", "usuarioId", "metrica", "moeda");

-- AddForeignKey
ALTER TABLE "MetaComercial" ADD CONSTRAINT "MetaComercial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Postgres trata NULL como distinto: índices parciais fecham os casos sem vendedor e sem moeda.
CREATE UNIQUE INDEX "MetaComercial_geral_key" ON "MetaComercial"("competencia", "metrica", COALESCE("moeda", '')) WHERE "usuarioId" IS NULL;
CREATE UNIQUE INDEX "MetaComercial_sem_moeda_key" ON "MetaComercial"("competencia", "usuarioId", "metrica") WHERE "moeda" IS NULL AND "usuarioId" IS NOT NULL;
