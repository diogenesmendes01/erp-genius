-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'VENDEDOR', 'GERENTE_PEDAGOGICO', 'PROFESSOR', 'FINANCEIRO', 'SECRETARIA_ACADEMICA');

-- CreateEnum
CREATE TYPE "StatusPais" AS ENUM ('RASCUNHO', 'ATIVO', 'PAUSADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "Segmento" AS ENUM ('ADULTO', 'KIDS', 'TEENS', 'EMPRESA');

-- CreateEnum
CREATE TYPE "TipoCobranca" AS ENUM ('TAXA_MATRICULA', 'MENSALIDADE', 'CERTIFICADO');

-- CreateEnum
CREATE TYPE "StatusTurma" AS ENUM ('PLANEJADA', 'ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "StatusAluno" AS ENUM ('ATIVO', 'PAUSADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "PapelResponsavel" AS ENUM ('PEDAGOGICO', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "Temperatura" AS ENUM ('QUENTE', 'MORNO', 'FRIO');

-- CreateEnum
CREATE TYPE "EtapaLead" AS ENUM ('NOVO', 'EM_ATENDIMENTO', 'QUALIFICADO', 'EXPERIMENTAL_AGENDADA', 'EXPERIMENTAL_REALIZADA', 'PROPOSTA', 'AGUARDANDO_MATRICULA', 'MATRICULADO', 'NO_SHOW', 'PERDIDO');

-- CreateEnum
CREATE TYPE "MotivoPerda" AS ENUM ('NAO_RESPONDEU', 'PRECO', 'TEMPO', 'CONCORRENCIA', 'INTERESSE', 'LOCALIZACAO', 'EMPRESA', 'QUALIFICACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusMatricula" AS ENUM ('RASCUNHO', 'AGUARDANDO', 'ATIVA', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('TRANSFERENCIA', 'GREENPAY', 'DINHEIRO', 'CARTAO');

-- CreateEnum
CREATE TYPE "StatusComissao" AS ENUM ('PENDENTE', 'APROVADA', 'PAGA', 'ESTORNADA');

-- CreateEnum
CREATE TYPE "TipoAprovacao" AS ENUM ('DESCONTO', 'BOLSA', 'ALTERACAO_VALOR', 'PERDAO_DIVIDA', 'COMISSAO_EXCEPCIONAL');

-- CreateEnum
CREATE TYPE "StatusAprovacao" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "Vigencia" AS ENUM ('ESTA_COBRANCA', 'PROXIMOS_MESES', 'CONTRATO_INTEIRO');

-- CreateEnum
CREATE TYPE "TipoAjuste" AS ENUM ('DESCONTO', 'BOLSA', 'ALTERACAO_VALOR', 'PERDAO', 'RENEGOCIACAO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "papeis" "Papel"[],
    "limiteDescontoPct" DOUBLE PRECISION,
    "ultimoAcesso" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigoISO" TEXT NOT NULL,
    "moedaLocal" TEXT NOT NULL,
    "ddi" TEXT NOT NULL,
    "fuso" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "status" "StatusPais" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoDocumento" (
    "id" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "validador" TEXT NOT NULL,

    CONSTRAINT "TipoDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idioma" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Idioma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modalidade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "segmento" "Segmento" NOT NULL DEFAULT 'ADULTO',
    "frequencia" TEXT NOT NULL,
    "horasAula" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "duracaoPorNivel" TEXT NOT NULL,
    "aulasPorNivel" INTEGER,
    "minimoAbrir" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Modalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nivel" (
    "id" TEXT NOT NULL,
    "idiomaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "Nivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "idiomaId" TEXT NOT NULL,
    "modalidadeId" TEXT NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoPais" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "moeda" TEXT NOT NULL,
    "oferecido" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProdutoPais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoReferencia" (
    "id" TEXT NOT NULL,
    "produtoPaisId" TEXT NOT NULL,
    "tipoCobranca" "TipoCobranca" NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "versaoEstudo" TEXT,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecoReferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "modalidadeId" TEXT NOT NULL,
    "nivelId" TEXT NOT NULL,
    "professorId" TEXT,
    "diasHorario" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3),
    "cronograma" TEXT,
    "capacidade" INTEGER NOT NULL DEFAULT 12,
    "status" "StatusTurma" NOT NULL DEFAULT 'PLANEJADA',
    "rolling" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aluno" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "nascimento" TIMESTAMP(3),
    "paisId" TEXT NOT NULL,
    "documento" TEXT,
    "documentoValido" BOOLEAN NOT NULL DEFAULT false,
    "telefoneE164" TEXT,
    "status" "StatusAluno" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Responsavel" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "parentesco" TEXT,
    "telefoneE164" TEXT,
    "email" TEXT,

    CONSTRAINT "Responsavel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlunoResponsavel" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "papel" "PapelResponsavel" NOT NULL DEFAULT 'FINANCEIRO',

    CONSTRAINT "AlunoResponsavel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlocacaoTurma" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlocacaoTurma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "telefoneE164" TEXT,
    "paisId" TEXT,
    "segmento" "Segmento" NOT NULL DEFAULT 'ADULTO',
    "temperatura" "Temperatura" NOT NULL DEFAULT 'MORNO',
    "etapa" "EtapaLead" NOT NULL DEFAULT 'NOVO',
    "b2b" BOOLEAN NOT NULL DEFAULT false,
    "vendedorDonoId" TEXT,
    "origemCampanha" TEXT,
    "origemConjunto" TEXT,
    "origemAnuncio" TEXT,
    "origemPalavra" TEXT,
    "interesse" TEXT,
    "objetivo" TEXT,
    "urgencia" TEXT,
    "orcamento" TEXT,
    "objecao" TEXT,
    "proximaAcao" TEXT,
    "proximoFollowUp" TIMESTAMP(3),
    "dataExperimental" TIMESTAMP(3),
    "dataProposta" TIMESTAMP(3),
    "motivoPerda" "MotivoPerda",
    "ultimaCobranca" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matricula" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "leadId" TEXT,
    "produtoId" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "codigo" TEXT,
    "moeda" TEXT NOT NULL,
    "status" "StatusMatricula" NOT NULL DEFAULT 'RASCUNHO',
    "diaVencimento" INTEGER NOT NULL DEFAULT 5,
    "contratoOk" BOOLEAN NOT NULL DEFAULT false,
    "pagamentoOk" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativadaEm" TIMESTAMP(3),

    CONSTRAINT "Matricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "matriculaId" TEXT NOT NULL,
    "tipo" "TipoCobranca" NOT NULL,
    "competencia" TEXT,
    "valorOriginal" DOUBLE PRECISION NOT NULL,
    "valorNegociado" DOUBLE PRECISION NOT NULL,
    "valorRecebido" DOUBLE PRECISION,
    "saldo" DOUBLE PRECISION,
    "moeda" TEXT NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'PENDENTE',
    "pagoEm" TIMESTAMP(3),
    "formaPagamento" "FormaPagamento",
    "comprovanteUrl" TEXT,
    "comentario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comissao" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "moeda" TEXT NOT NULL,
    "status" "StatusComissao" NOT NULL DEFAULT 'PENDENTE',
    "dataPrevistaPagamento" TIMESTAMP(3),
    "pagaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aprovacao" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAprovacao" NOT NULL,
    "status" "StatusAprovacao" NOT NULL DEFAULT 'PENDENTE',
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "alvoTipo" TEXT NOT NULL,
    "alvoId" TEXT,
    "payload" JSONB,
    "vigencia" "Vigencia",
    "motivo" TEXT,
    "impactoMensal" DOUBLE PRECISION,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoEm" TIMESTAMP(3),

    CONSTRAINT "Aprovacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AjusteFinanceiro" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "cobrancaId" TEXT,
    "tipo" "TipoAjuste" NOT NULL,
    "valorDe" DOUBLE PRECISION NOT NULL,
    "valorPara" DOUBLE PRECISION NOT NULL,
    "descontoValor" DOUBLE PRECISION NOT NULL,
    "descontoPct" DOUBLE PRECISION,
    "moeda" TEXT NOT NULL,
    "vigencia" "Vigencia",
    "motivo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "aprovacaoId" TEXT,
    "vendedorId" TEXT,
    "paisId" TEXT,
    "modalidadeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjusteFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "agregadoTipo" TEXT NOT NULL,
    "agregadoId" TEXT NOT NULL,
    "autorId" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contador" (
    "chave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Contador_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Pais_codigoISO_key" ON "Pais"("codigoISO");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoPais_produtoId_paisId_key" ON "ProdutoPais"("produtoId", "paisId");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_codigo_key" ON "Turma"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_codigo_key" ON "Aluno"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_codigo_key" ON "Lead"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Matricula_leadId_key" ON "Matricula"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Matricula_codigo_key" ON "Matricula"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Cobranca_codigo_key" ON "Cobranca"("codigo");

-- CreateIndex
CREATE INDEX "AjusteFinanceiro_vendedorId_idx" ON "AjusteFinanceiro"("vendedorId");

-- CreateIndex
CREATE INDEX "AjusteFinanceiro_paisId_idx" ON "AjusteFinanceiro"("paisId");

-- CreateIndex
CREATE INDEX "AjusteFinanceiro_modalidadeId_idx" ON "AjusteFinanceiro"("modalidadeId");

-- CreateIndex
CREATE INDEX "AjusteFinanceiro_criadoEm_idx" ON "AjusteFinanceiro"("criadoEm");

-- CreateIndex
CREATE INDEX "Evento_agregadoTipo_agregadoId_idx" ON "Evento"("agregadoTipo", "agregadoId");

-- CreateIndex
CREATE INDEX "Evento_tipo_idx" ON "Evento"("tipo");

-- CreateIndex
CREATE INDEX "Evento_criadoEm_idx" ON "Evento"("criadoEm");

-- AddForeignKey
ALTER TABLE "TipoDocumento" ADD CONSTRAINT "TipoDocumento_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nivel" ADD CONSTRAINT "Nivel_idiomaId_fkey" FOREIGN KEY ("idiomaId") REFERENCES "Idioma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_idiomaId_fkey" FOREIGN KEY ("idiomaId") REFERENCES "Idioma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoPais" ADD CONSTRAINT "ProdutoPais_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoPais" ADD CONSTRAINT "ProdutoPais_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoReferencia" ADD CONSTRAINT "PrecoReferencia_produtoPaisId_fkey" FOREIGN KEY ("produtoPaisId") REFERENCES "ProdutoPais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "Nivel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlunoResponsavel" ADD CONSTRAINT "AlunoResponsavel_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlunoResponsavel" ADD CONSTRAINT "AlunoResponsavel_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Responsavel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoTurma" ADD CONSTRAINT "AlocacaoTurma_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoTurma" ADD CONSTRAINT "AlocacaoTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_vendedorDonoId_fkey" FOREIGN KEY ("vendedorDonoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aprovacao" ADD CONSTRAINT "Aprovacao_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aprovacao" ADD CONSTRAINT "Aprovacao_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteFinanceiro" ADD CONSTRAINT "AjusteFinanceiro_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteFinanceiro" ADD CONSTRAINT "AjusteFinanceiro_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
