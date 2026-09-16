-- AlterTable
ALTER TABLE "PagamentoInformado" ADD COLUMN     "suspenderLembretesAte" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ConfiguracaoOperacional" (
    "id" TEXT NOT NULL DEFAULT 'escola',
    "exigirPrimeiraMensalidade" BOOLEAN NOT NULL DEFAULT false,
    "prazoConferenciaHoras" INTEGER NOT NULL DEFAULT 48,
    "alteradaPorId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoOperacional_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ConfiguracaoOperacional" ADD CONSTRAINT "ConfiguracaoOperacional_singleton_check" CHECK ("id" = 'escola');
ALTER TABLE "ConfiguracaoOperacional" ADD CONSTRAINT "ConfiguracaoOperacional_prazo_check" CHECK ("prazoConferenciaHoras" BETWEEN 1 AND 720);
