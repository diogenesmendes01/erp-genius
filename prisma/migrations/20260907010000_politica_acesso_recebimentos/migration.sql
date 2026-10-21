-- CreateEnum
CREATE TYPE "StatusPagamentoInformado" AS ENUM ('A_CONFERIR', 'CONFIRMADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "TipoComissao" AS ENUM ('PERCENTUAL', 'VALOR_FIXO');

-- CreateEnum
CREATE TYPE "FinalidadeAtendimentoWhatsApp" AS ENUM ('COMERCIAL', 'FINANCEIRO', 'SECRETARIA', 'PEDAGOGICO');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "alcadaAlteradaEm" TIMESTAMP(3),
ADD COLUMN     "gerenteComercialId" TEXT,
ADD COLUMN     "limiteDescontoMensalidadePct" DECIMAL(5,2),
ADD COLUMN     "limiteDescontoTaxaPct" DECIMAL(5,2),
ADD COLUMN     "permissoes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Matricula" ADD COLUMN     "confirmacaoContratoEm" TIMESTAMP(3),
ADD COLUMN     "confirmacaoContratoPorId" TEXT,
ADD COLUMN     "contratoDocumentoId" TEXT,
ADD COLUMN     "secretariaAssumiuEm" TIMESTAMP(3),
ADD COLUMN     "secretariaResponsavelId" TEXT;

-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN     "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Comissao" ADD COLUMN     "calculadaEm" TIMESTAMP(3),
ADD COLUMN     "memoriaCalculo" JSONB,
ADD COLUMN     "politicaId" TEXT,
ADD COLUMN     "tipo" "TipoComissao" NOT NULL DEFAULT 'PERCENTUAL',
ADD COLUMN     "valorBase" DECIMAL(12,2),
ADD COLUMN     "valorFixo" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "MensagemWhatsApp" ADD COLUMN     "atendimentoId" TEXT;

-- AlterTable
ALTER TABLE "IntencaoMensagem" ADD COLUMN     "atendimentoId" TEXT,
ADD COLUMN     "referenciaCobranca" TEXT;

-- CreateTable
CREATE TABLE "RegistroUpload" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId" TEXT,
    "alunoId" TEXT,
    "cobrancaId" TEXT,

    CONSTRAINT "RegistroUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoberturaCarteira" (
    "id" TEXT NOT NULL,
    "titularId" TEXT NOT NULL,
    "substitutoId" TEXT NOT NULL,
    "concedenteId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoberturaCarteira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoInformado" (
    "id" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "conferenteId" TEXT,
    "status" "StatusPagamentoInformado" NOT NULL DEFAULT 'A_CONFERIR',
    "valor" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "dataPagamento" TIMESTAMP(3) NOT NULL,
    "comprovanteUrl" TEXT,
    "comprovanteNome" TEXT,
    "comentario" TEXT,
    "permitirExcedente" BOOLEAN NOT NULL DEFAULT false,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conferidoEm" TIMESTAMP(3),
    "motivoConferencia" TEXT,

    CONSTRAINT "PagamentoInformado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebimento" (
    "id" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "informeId" TEXT,
    "autorId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "dataPagamento" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticaComissao" (
    "id" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "tipo" "TipoComissao" NOT NULL,
    "base" TEXT NOT NULL DEFAULT 'TAXA_MATRICULA',
    "percentual" DECIMAL(5,2),
    "valorFixo" DECIMAL(12,2),
    "moeda" TEXT NOT NULL,
    "vigenteEm" TIMESTAMP(3) NOT NULL,
    "encerraEm" TIMESTAMP(3),
    "criadaPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoliticaComissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtendimentoWhatsApp" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "contextoChave" TEXT NOT NULL,
    "finalidade" "FinalidadeAtendimentoWhatsApp" NOT NULL,
    "responsavelId" TEXT,
    "leadId" TEXT,
    "alunoId" TEXT,
    "turmaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradoEm" TIMESTAMP(3),
    "ultimaMensagemEm" TIMESTAMP(3),
    "ultimoInboundEm" TIMESTAMP(3),
    "inboundTratadoEm" TIMESTAMP(3),
    "naoLidas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AtendimentoWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipanteAtendimentoWhatsApp" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "concedenteId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "podeEnviar" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT NOT NULL,

    CONSTRAINT "ParticipanteAtendimentoWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistroUpload_url_key" ON "RegistroUpload"("url");

-- CreateIndex
CREATE INDEX "CoberturaCarteira_substitutoId_fim_idx" ON "CoberturaCarteira"("substitutoId", "fim");

-- CreateIndex
CREATE INDEX "CoberturaCarteira_titularId_idx" ON "CoberturaCarteira"("titularId");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoInformado_chaveIdempotencia_key" ON "PagamentoInformado"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "PagamentoInformado_cobrancaId_status_idx" ON "PagamentoInformado"("cobrancaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Recebimento_chaveIdempotencia_key" ON "Recebimento"("chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "Recebimento_informeId_key" ON "Recebimento"("informeId");

-- CreateIndex
CREATE INDEX "Recebimento_dataPagamento_idx" ON "Recebimento"("dataPagamento");

-- CreateIndex
CREATE INDEX "Recebimento_cobrancaId_idx" ON "Recebimento"("cobrancaId");

-- CreateIndex
CREATE INDEX "PoliticaComissao_paisId_produtoId_vigenteEm_idx" ON "PoliticaComissao"("paisId", "produtoId", "vigenteEm");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticaComissao_paisId_produtoId_versao_key" ON "PoliticaComissao"("paisId", "produtoId", "versao");

-- CreateIndex
CREATE INDEX "AtendimentoWhatsApp_leadId_idx" ON "AtendimentoWhatsApp"("leadId");

-- CreateIndex
CREATE INDEX "AtendimentoWhatsApp_alunoId_idx" ON "AtendimentoWhatsApp"("alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "AtendimentoWhatsApp_conversaId_contextoChave_key" ON "AtendimentoWhatsApp"("conversaId", "contextoChave");

-- CreateIndex
CREATE INDEX "ParticipanteAtendimentoWhatsApp_atendimentoId_usuarioId_fim_idx" ON "ParticipanteAtendimentoWhatsApp"("atendimentoId", "usuarioId", "fim");

-- AddForeignKey
ALTER TABLE "RegistroUpload" ADD CONSTRAINT "RegistroUpload_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaCarteira" ADD CONSTRAINT "CoberturaCarteira_titularId_fkey" FOREIGN KEY ("titularId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaCarteira" ADD CONSTRAINT "CoberturaCarteira_substitutoId_fkey" FOREIGN KEY ("substitutoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaCarteira" ADD CONSTRAINT "CoberturaCarteira_concedenteId_fkey" FOREIGN KEY ("concedenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoInformado" ADD CONSTRAINT "PagamentoInformado_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "PagamentoInformado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticaComissao" ADD CONSTRAINT "PoliticaComissao_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticaComissao" ADD CONSTRAINT "PoliticaComissao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoWhatsApp" ADD CONSTRAINT "AtendimentoWhatsApp_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoWhatsApp" ADD CONSTRAINT "AtendimentoWhatsApp_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoWhatsApp" ADD CONSTRAINT "AtendimentoWhatsApp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoWhatsApp" ADD CONSTRAINT "AtendimentoWhatsApp_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoWhatsApp" ADD CONSTRAINT "AtendimentoWhatsApp_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteAtendimentoWhatsApp" ADD CONSTRAINT "ParticipanteAtendimentoWhatsApp_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteAtendimentoWhatsApp" ADD CONSTRAINT "ParticipanteAtendimentoWhatsApp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_gerenteComercialId_fkey" FOREIGN KEY ("gerenteComercialId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES "PoliticaComissao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemWhatsApp" ADD CONSTRAINT "MensagemWhatsApp_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntencaoMensagem" ADD CONSTRAINT "IntencaoMensagem_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserva alçadas efetivamente cadastradas. Ausência continua sem autonomia;
-- não cria uma política de comissão nem inventa valores/autorizações de exportação.
UPDATE "Usuario" SET "limiteDescontoTaxaPct" = "limiteDescontoPct",
  "limiteDescontoMensalidadePct" = "limiteDescontoPct"
WHERE "limiteDescontoPct" IS NOT NULL;
ALTER TABLE "Usuario" ALTER COLUMN "permissoes" SET NOT NULL;
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_gerente_distinto" CHECK ("gerenteComercialId" IS NULL OR "gerenteComercialId" <> id);
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_alcadas_validas" CHECK (
  ("limiteDescontoTaxaPct" IS NULL OR "limiteDescontoTaxaPct" BETWEEN 0 AND 100) AND
  ("limiteDescontoMensalidadePct" IS NULL OR "limiteDescontoMensalidadePct" BETWEEN 0 AND 100));
ALTER TABLE "CoberturaCarteira" ADD CONSTRAINT "Cobertura_periodo_pessoas" CHECK (fim > inicio AND "titularId" <> "substitutoId");
ALTER TABLE "ParticipanteAtendimentoWhatsApp" ADD CONSTRAINT "Participante_periodo" CHECK (fim > inicio);
ALTER TABLE "PagamentoInformado" ADD CONSTRAINT "Informe_valor_versao" CHECK (valor > 0 AND versao > 0);
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_valor_positivo" CHECK (valor > 0);
ALTER TABLE "PoliticaComissao" ADD CONSTRAINT "PoliticaComissao_calculo_valido" CHECK (
  (tipo = 'PERCENTUAL' AND percentual IS NOT NULL AND percentual BETWEEN 0 AND 100 AND "valorFixo" IS NULL)
  OR (tipo = 'VALOR_FIXO' AND "valorFixo" IS NOT NULL AND "valorFixo" >= 0 AND percentual IS NULL));
ALTER TABLE "PoliticaComissao" ADD CONSTRAINT "PoliticaComissao_vigencia" CHECK ("encerraEm" IS NULL OR "encerraEm" > "vigenteEm");
