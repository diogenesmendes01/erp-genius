import { beforeEach, expect, it } from "vitest";
import { CategoriaDocumento, StatusCobranca, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararContratacaoTx } from "./preparacao-comercial-tx";

const regras = (documentoId: string) => ({
  continuidadeContratada: { contratada: true, clausula: "Continuidade mensal prevista", evidenciaId: documentoId },
  regraCobertura: { referencia: "MES_CIVIL" },
  referenciaVencimento: "MES_COBERTURA",
  diaVencimento: 5,
  antecedenciaDias: 10,
  valorOriginal: "100.00",
  valorNegociado: "100.00",
  moeda: "CRC",
  ajusteVencimento: { regra: "MANTER_DATA" },
  vigenteDesde: "2026-01-01",
});

async function prepararFonte() {
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { prazoReservaMinutos: 60, fusoInstitucional: "UTC" }, update: { prazoReservaMinutos: 60, fusoInstitucional: "UTC" } });
  const catalogo = await seedCatalogoMinimo();
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const admin = await criarUsuario(["ADMINISTRADOR"]);
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Fonte", paisId: catalogo.pais.id } });
  const produto = await prisma.produto.findUniqueOrThrow({ where: { id: catalogo.produto.id } });
  const professor = await criarUsuario(["PROFESSOR"]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: produto.idiomaId, codigo: "EMISSAO_SQL", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: produto.modalidadeId, nivelId: nivel.id, professorId: professor.id, capacidade: 4 } });
  const janela = await prisma.janelaAdmissaoTurma.create({ data: { turmaId: turma.id, preparadorId: secretaria.id, versao: 1, limiteEntrada: new Date("2099-12-31T00:00:00.000Z"), fusoAdmissao: "UTC", motivo: "Janela da emissão", chaveIdempotencia: "emissao-sql-janela", entradaHash: "fixture" } });
  await prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janela.id, decisorId: admin.id, aprovada: true, motivo: "Janela aprovada" } });
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: secretaria.id, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário da emissão", chaveIdempotencia: "emissao-sql-calendario", entradaHash: "fixture" } });
  await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: admin.id, aprovada: true, motivo: "Calendário aprovado" } });
  const grade = await prisma.propostaGradeTurma.create({ data: { turmaId: turma.id, calendarioId: calendario.id, preparadorId: secretaria.id, versao: 1, fusoOrigem: "UTC", motivo: "Grade da emissão", chaveIdempotencia: "emissao-sql-grade", entradaHash: "fixture", snapshot: {} } });
  await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: admin.id, aprovada: true, motivo: "Grade aprovada" } });
  await prisma.encontroAgenda.create({ data: { turmaId: turma.id, propostaGradeId: grade.id, professorId: professor.id, preparadorId: secretaria.id, inicio: new Date("2099-10-01T12:00:00.000Z"), fim: new Date("2099-10-01T13:00:00.000Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro da emissão", chaveIdempotencia: "emissao-sql-encontro", entradaHash: "fixture" } });
  const lead = await prisma.lead.create({ data: { nome: "Contratação da emissão", vendedorDonoId: secretaria.id } });
  const preparada = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId: secretaria.id, leadId: lead.id, alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, turmaId: turma.id, regime: "MENSALIDADE", taxaProposta: "100", valorServicoProposto: "100", motivo: "Preparação mensal para guarda SQL", chaveIdempotencia: "emissao-sql-preparacao" }));
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: preparada.matriculaId } });
  const documento = await prisma.documento.create({ data: {
    matriculaId: matricula.id, categoria: CategoriaDocumento.CONTRATO, nome: "Contrato vigente", url: "/contrato.pdf",
  } });
  await prisma.matricula.update({ where: { id: matricula.id }, data: { status: "ATIVA", contratoDocumentoId: documento.id, contratoOk: true, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: secretaria.id } });
  const condicao = await prisma.condicoesContinuidadeMensalMatricula.create({ data: {
    matriculaId: matricula.id, documentoId: documento.id, versao: 1, regras: regras(documento.id), motivo: "Condições mensais conferidas", preparadorId: secretaria.id,
  } });
  await prisma.condicoesContinuidadeMensalMatricula.update({ where: { id: condicao.id }, data: {
    status: "APROVADA", decisorId: admin.id, decididaEm: new Date(), motivoDecisao: "Condições aprovadas",
  } });
  const ancora = await prisma.cobranca.create({ data: {
    matriculaId: matricula.id, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100,
    vencimento: new Date("2026-10-05T00:00:00.000Z"), coberturaInicio: new Date("2026-10-01T00:00:00.000Z"), coberturaFim: new Date("2026-10-31T00:00:00.000Z"),
  } });
  return { matricula, condicao, documento, ancora };
}

function snapshot(condicao: { id: string; versao: number }, documentoId: string) {
  return {
    plano: { status: "PRONTA_PARA_EMISSAO", cobertura: { inicio: "2026-11-01", fim: "2026-11-30" }, emissaoEm: "2026-10-01", moeda: "CRC", valorOriginal: "100.00", valorNegociado: "100.00" },
    oferta: { estado: "SEM_RELATO" }, comprovacaoOferta: { estado: "CONFIRMADA_PELA_GESTAO" },
    condicoes: { id: condicao.id, versao: condicao.versao, documentoId }, documentoId,
  };
}

async function criarLedgerDireto(status: StatusCobranca, recebido: number | null, saldo: number, pagoEm: Date | null) {
  const fonte = await prepararFonte();
  const nova = await prisma.cobranca.create({ data: {
    matriculaId: fonte.matricula.id, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 100, valorNegociado: 100,
    saldo, status, valorRecebido: recebido, pagoEm, vencimento: new Date("2026-11-05T00:00:00.000Z"),
    coberturaInicio: new Date("2026-11-01T00:00:00.000Z"), coberturaFim: new Date("2026-11-30T00:00:00.000Z"),
  } });
  return { ...fonte, nova };
}

beforeEach(async () => { await truncarBanco(); });

it("o ledger direto com snapshot válido recusa matrícula pausada", async () => {
  const fonte = await criarLedgerDireto(StatusCobranca.PENDENTE, null, 100, null);
  await prisma.matricula.update({ where: { id: fonte.matricula.id }, data: { status: "PAUSADA" } });
  await expect(prisma.emissaoContinuidadeMensal.create({ data: {
    matriculaId: fonte.matricula.id, cobrancaId: fonte.nova.id, anteriorCobrancaId: fonte.ancora.id,
    coberturaInicio: fonte.nova.coberturaInicio!, coberturaFim: fonte.nova.coberturaFim!, emissaoEm: new Date("2026-10-01T00:00:00.000Z"),
    snapshot: snapshot(fonte.condicao, fonte.documento.id), snapshotHash: "a".repeat(64),
  } })).rejects.toThrow(/contrato mensal ativo|Ledger de continuidade/i);
});

it("o ledger direto recusa cobrança já baixada, apesar do snapshot válido", async () => {
  const fonte = await criarLedgerDireto(StatusCobranca.PAGO, 100, 0, new Date("2026-10-02T00:00:00.000Z"));
  await expect(prisma.emissaoContinuidadeMensal.create({ data: {
    matriculaId: fonte.matricula.id, cobrancaId: fonte.nova.id, anteriorCobrancaId: fonte.ancora.id,
    coberturaInicio: fonte.nova.coberturaInicio!, coberturaFim: fonte.nova.coberturaFim!, emissaoEm: new Date("2026-10-01T00:00:00.000Z"),
    snapshot: snapshot(fonte.condicao, fonte.documento.id), snapshotHash: "b".repeat(64),
  } })).rejects.toThrow(/Ledger de continuidade/i);
});
