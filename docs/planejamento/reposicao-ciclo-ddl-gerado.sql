-- CreateEnum
CREATE TYPE "ResultadoCancelamentoAgendaReposicao" AS ENUM ('DEVOLVE_BENEFICIO', 'CONSOME_BENEFICIO', 'ISENTA_SEM_SALDO');

-- DropIndex
DROP INDEX "EncontroAgenda_reposicaoIndividualId_key";

-- CreateTable
CREATE TABLE "PropostaCancelamentoAgendaReposicaoIndividual" (
    "id" TEXT NOT NULL,
    "agendaId" TEXT NOT NULL,
    "encontroId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "solicitadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" JSONB NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,

    CONSTRAINT "PropostaCancelamentoAgendaReposicaoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoCancelamentoAgendaReposicaoIndividual" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "resultado" "ResultadoCancelamentoAgendaReposicao",
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoCancelamentoAgendaReposicaoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" (
    "id" TEXT NOT NULL,
    "agendaId" TEXT NOT NULL,
    "encontroOriginalId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "fusoOrigem" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "estado" JSONB NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,

    CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "encontroNovoId" TEXT,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoRemarcacaoAgendaReposicaoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCancelamentoAgendaReposicaoIndividual_agendaId_vers_key" ON "PropostaCancelamentoAgendaReposicaoIndividual"("agendaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCancelamentoAgendaReposicaoIndividual_autorId_chave_key" ON "PropostaCancelamentoAgendaReposicaoIndividual"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoCancelamentoAgendaReposicaoIndividual_propostaId_key" ON "DecisaoCancelamentoAgendaReposicaoIndividual"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaRemarcacaoAgendaReposicaoIndividual_agendaId_versao_key" ON "PropostaRemarcacaoAgendaReposicaoIndividual"("agendaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaRemarcacaoAgendaReposicaoIndividual_autorId_chaveId_key" ON "PropostaRemarcacaoAgendaReposicaoIndividual"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoRemarcacaoAgendaReposicaoIndividual_propostaId_key" ON "DecisaoRemarcacaoAgendaReposicaoIndividual"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoRemarcacaoAgendaReposicaoIndividual_encontroNovoId_key" ON "DecisaoRemarcacaoAgendaReposicaoIndividual"("encontroNovoId");

-- AddForeignKey
ALTER TABLE "PropostaCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaCancelamentoAgendaReposicaoIndividual_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "AgendaReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaCancelamentoAgendaReposicaoIndividual_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaCancelamentoAgendaReposicaoIndividual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoCancelamentoAgendaReposicaoIndividual_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCancelamentoAgendaReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCancelamentoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoCancelamentoAgendaReposicaoIndividual_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "AgendaReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_encontroOrigin_fkey" FOREIGN KEY ("encontroOriginalId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "PropostaRemarcacaoAgendaReposicaoIndividual_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoRemarcacaoAgendaReposicaoIndividual_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaRemarcacaoAgendaReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoRemarcacaoAgendaReposicaoIndividual_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoRemarcacaoAgendaReposicaoIndividual" ADD CONSTRAINT "DecisaoRemarcacaoAgendaReposicaoIndividual_encontroNovoId_fkey" FOREIGN KEY ("encontroNovoId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

