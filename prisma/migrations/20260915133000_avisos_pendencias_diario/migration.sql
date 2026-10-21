-- Q22: avisos internos de pendências do diário. Não há canal externo,
-- cobrança, arquivo de gravação ou dados de aluno nesta estrutura.
ALTER TABLE "ConfiguracaoOperacional"
  ADD COLUMN "prazoRegularizacaoDiarioMinutos" INTEGER,
  ADD COLUMN "intervaloLembreteDiarioMinutos" INTEGER;

ALTER TABLE "ConfiguracaoOperacional"
  ADD CONSTRAINT "ConfiguracaoOperacional_avisos_diario_politica_completa"
  CHECK (
    ("prazoRegularizacaoDiarioMinutos" IS NULL AND "intervaloLembreteDiarioMinutos" IS NULL)
    OR ("prazoRegularizacaoDiarioMinutos" IS NOT NULL AND "intervaloLembreteDiarioMinutos" IS NOT NULL
        AND "prazoRegularizacaoDiarioMinutos" > 0 AND "intervaloLembreteDiarioMinutos" > 0)
  );

CREATE TYPE "TipoAvisoPendenciaDiario" AS ENUM ('DOCENTE', 'GESTAO');
CREATE TYPE "EncerramentoAvisoPendenciaDiario" AS ENUM ('RESOLVIDO', 'CANCELADO');

CREATE TABLE "AvisoPendenciaDiario" (
  "id" TEXT NOT NULL,
  "encontroId" TEXT NOT NULL,
  "destinatarioId" TEXT NOT NULL,
  "tipo" "TipoAvisoPendenciaDiario" NOT NULL,
  "vencimento" TIMESTAMP(3) NOT NULL,
  "ultimoLembreteEm" TIMESTAMP(3),
  "proximoLembreteEm" TIMESTAMP(3),
  "quantidadeLembretes" INTEGER NOT NULL DEFAULT 0,
  "indiceLembrete" INTEGER NOT NULL DEFAULT 0,
  "encerramento" "EncerramentoAvisoPendenciaDiario",
  "encerradoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "AvisoPendenciaDiario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AvisoPendenciaDiario_contadores_nao_negativos"
    CHECK ("quantidadeLembretes" >= 0 AND "indiceLembrete" >= 0),
  CONSTRAINT "AvisoPendenciaDiario_encerramento_consistente"
    CHECK (("encerramento" IS NULL) = ("encerradoEm" IS NULL))
);

CREATE UNIQUE INDEX "AvisoPendenciaDiario_encontroId_destinatarioId_tipo_key"
  ON "AvisoPendenciaDiario"("encontroId", "destinatarioId", "tipo");
CREATE INDEX "AvisoPendenciaDiario_destinatarioId_encerradoEm_vencimento_idx"
  ON "AvisoPendenciaDiario"("destinatarioId", "encerradoEm", "vencimento");
CREATE INDEX "AvisoPendenciaDiario_encontroId_idx"
  ON "AvisoPendenciaDiario"("encontroId");

ALTER TABLE "AvisoPendenciaDiario"
  ADD CONSTRAINT "AvisoPendenciaDiario_encontroId_fkey"
    FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "AvisoPendenciaDiario_destinatarioId_fkey"
    FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
