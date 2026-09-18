import { beforeEach, expect, it, vi } from "vitest";
import { Papel, Prisma, TipoCobranca } from "@prisma/client";

const { authMock, portal } = vi.hoisted(() => ({
  authMock: vi.fn(),
  portal: { sessao: null as null | { sessaoId: string; contaId: string; alunoId: string; email: string } },
}));

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/portal-aluno/sessao", () => ({
  exigirSessaoPortalAluno: async () => {
    if (!portal.sessao) throw new Error("Sessão portal ausente.");
    return portal.sessao;
  },
}));
vi.mock("@/server/gravacoes/credenciais", () => ({ obterDriveOrganizacaoId: () => "drive-ct01" }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return {
    ...real,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const sessao = await authMock();
      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: sessao.user.id }, select: { id: true, nome: true, papeis: true, ativo: true },
      });
      if (!usuario.ativo) throw new real.ErroPermissao();
      real.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { registrarRecebimentoDestinado } from "@/server/financeiro/acoes";
import { autorizarReproducaoGravacao } from "@/server/gravacoes/autorizacao";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { aplicarMovimentacaoContratual } from "./aplicar-movimentacao";
import { decidirAcertoEncerramento } from "./encerramento-decisao";
import { efetivarAcertoEncerramento } from "./encerramento-efetivar";
import { preverComponenteMensalEncerramento } from "./encerramento-previa";
import { salvarRascunhoAcertoEncerramento } from "./encerramento-rascunho";
import { solicitarEncerramentoMatriculas } from "./encerramento-solicitacao";
import { decidirPropostaPausaMatriculas, solicitarPausaMatriculas } from "./pausa-proposta";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const utc = (data: Date) => Prisma.sql`${data}::timestamptz AT TIME ZONE 'UTC'`;

let alunoId: string;
let mensalAId: string;
let horaBId: string;
let secretariaId: string;
let financeiroId: string;
let adminId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

async function criarVideoReposicao(id: string, matriculaId: string) {
  const professor = await criarUsuario([Papel.PROFESSOR], `Professor ${id}`);
  const nivel = await prisma.nivel.create({ data: {
    idiomaId: catalogo.idioma.id,
    codigo: `CT01-${id}`,
    ordem: 1,
  } });
  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id,
    nivelId: nivel.id,
    professorId: professor.id,
    dataInicio: new Date("2026-01-01T00:00:00.000Z"),
  } });
  await prisma.alocacaoTurma.create({ data: {
    alunoId,
    matriculaId,
    turmaId: turma.id,
    criadoEm: new Date("2026-01-01T00:00:00.000Z"),
  } });
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor.id, preparadorId: secretariaId,
    inicio: new Date("2026-01-03T12:00:00.000Z"), fim: new Date("2026-01-03T13:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula original CT01", chaveIdempotencia: `aula-${id}`, entradaHash: "fixture-ct01",
    diario: { create: {
      turmaId: turma.id,
      professorId: professor.id,
      ocorridaEm: new Date("2026-01-03T12:00:00.000Z"),
      conteudo: "Aula usada somente para o acesso individual da reposição.",
      registros: { create: {
        alunoId,
        matriculaId,
        nomeAluno: "Aluno CT01",
        presente: false,
        participacao: "FALTA",
      } },
    } },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES (${id},${encontro.id},${matriculaId},'GRAVACAO'::"ModalidadeReposicaoIndividual",${secretariaId},'Reposição da matrícula exata','Falta comprovada',${`reposicao-${id}`},'fixture-ct01')
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo)
    VALUES (${`decisao-${id}`},${id},${adminId},true,'Decisão independente da reposição')
  `);
  const materialId = `material-${id}`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "MaterialReposicaoGravacao" (id,"reposicaoId",provedor,"arquivoOficialId","driveOrganizacaoId","driveRevisionId","driveRevisionMd5","driveRevisionSize","mimeType",disponivel,"publicadoPorId","publicadoEm")
    VALUES (${materialId},${id},'GOOGLE_DRIVE'::"ProvedorMaterialReposicao",${`arquivo-${id}`},'drive-ct01',${`revisao-${id}`},${"a".repeat(32)},10,'video/mp4',true,${secretariaId},${utc(new Date("2099-09-01T10:00:00.000Z"))})
  `);
  await prisma.fonteRevisaoGravacao.create({ data: {
    alvo: "MATERIAL_REPOSICAO", materialReposicaoId: materialId, versao: 1,
    arquivoOficialId: `arquivo-${id}`, driveOrganizacaoId: "drive-ct01", driveRevisionId: `revisao-${id}`,
    driveRevisionMd5: "a".repeat(32), driveRevisionSize: 10n, mimeType: "video/mp4",
  } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DisponibilizacaoEntregaReposicao" (id,"reposicaoId","materialId","disponibilizadaEm","prazoBaseMinutos","prazoInicialAte","publicadaPorId")
    VALUES (${`disponibilizacao-${id}`},${id},${materialId},${utc(new Date("2099-09-01T10:00:00.000Z"))},1440,${utc(new Date("2099-10-01T10:00:00.000Z"))},${secretariaId})
  `);
}

async function criarCobrancaLiquidada(matriculaId: string, tipo: TipoCobranca, chave: string, cobertura = false) {
  const cobranca = await prisma.cobranca.create({ data: {
    matriculaId, tipo, moeda: "CRC", valorOriginal: 120, valorNegociado: 120, saldo: 120,
    vencimento: new Date("2099-09-05T00:00:00.000Z"),
    ...(cobertura ? { coberturaInicio: new Date("2099-09-01T00:00:00.000Z"), coberturaFim: new Date("2099-09-30T00:00:00.000Z") } : {}),
  } });
  entrar(financeiroId);
  const recebido = await registrarRecebimentoDestinado({
    titularMatriculaId: matriculaId, chaveIdempotencia: `recebimento-${chave}`, valorRecebido: 120, moeda: "CRC", forma: "TRANSFERENCIA",
    dataPagamento: new Date("2099-09-02T12:00:00.000Z"), comentario: `Fonte financeira real ${chave}.`,
    destinos: [{ tipo: "COBRANCA", cobrancaId: cobranca.id, valor: 120, evidencia: `Comprovante real de fixture ${chave}.`, chaveIdempotencia: `destino-${chave}` }],
  });
  expect(recebido.ok, recebido.ok ? undefined : recebido.erro).toBe(true);
  return prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
}

async function fotografiaB(cobrancaBId: string) {
  const destinos = await prisma.destinacaoRecebimento.findMany({ where: { cobrancaId: cobrancaBId }, orderBy: { id: "asc" } });
  const recebimentos = await prisma.recebimento.findMany({ where: { id: { in: destinos.map((d) => d.recebimentoId) } }, orderBy: { id: "asc" } });
  return {
    matricula: await prisma.matricula.findUniqueOrThrow({ where: { id: horaBId } }),
    cobranca: await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaBId } }),
    destinos,
    recebimentos,
    creditos: await prisma.creditoMatricula.findMany({ where: { matriculaId: horaBId }, orderBy: { id: "asc" } }),
  };
}

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria CT01")).id;
  financeiroId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro CT01")).id;
  adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin CT01")).id;
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Sao_Paulo" }, update: { fusoInstitucional: "America/Sao_Paulo" } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna CT01", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  mensalAId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", referenciaCobertura: "MES_CIVIL" } })).id;
  horaBId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } });
  portal.sessao = { sessaoId: "sessao-ct01", contaId: conta.id, alunoId, email: "ct01@portal.test" };
});

it("CT01 pausa somente A e preserva B por hora, suas fontes e seu vídeo", async () => {
  const cobrancaA = await criarCobrancaLiquidada(mensalAId, TipoCobranca.MENSALIDADE, "a-pausa", true);
  const futuraA = await prisma.cobranca.create({ data: { matriculaId: mensalAId, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 120, valorNegociado: 120, saldo: 120, vencimento: new Date("2099-10-05T00:00:00.000Z"), coberturaInicio: new Date("2099-10-01T00:00:00.000Z"), coberturaFim: new Date("2099-10-31T00:00:00.000Z") } });
  const cobrancaB = await criarCobrancaLiquidada(horaBId, TipoCobranca.HORA_PARTICULAR, "b-pausa");
  await criarVideoReposicao("repo-a-pausa", mensalAId);
  await criarVideoReposicao("repo-b-pausa", horaBId);
  await expect(autorizarReproducaoGravacao("repo-b-pausa")).resolves.toMatchObject({ matriculaId: horaBId });
  const antesB = await fotografiaB(cobrancaB.id);

  entrar(secretariaId);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2099-09-15T12:00:00.000Z"));
  try {
    const proposta = await solicitarPausaMatriculas(alunoId, { matriculaIds: [mensalAId], dataEfetiva: "2099-09-15", motivo: "Pausa do contrato mensal A, sem afetar a contratação por horas B.", chaveIdempotencia: "ct01-pausa-a" });
    expect(proposta.ok, proposta.ok ? undefined : proposta.erro).toBe(true);
    if (!proposta.ok || !proposta.dado) throw new Error("Proposta de pausa ausente.");
    entrar(financeiroId);
    expect(await decidirPropostaPausaMatriculas(proposta.dado.propostaId, { aprovar: true, motivo: "Pausa de A conferida independentemente." })).toMatchObject({ ok: true });
    entrar(secretariaId);
    const entrada = { alunoId, propostaId: proposta.dado.propostaId, tipo: "PAUSA" as const };
    const primeira = await aplicarMovimentacaoContratual(entrada);
    const replay = await aplicarMovimentacaoContratual(entrada);
    expect(primeira).toMatchObject({ ok: true, dado: { status: "APLICADA" } });
    expect(replay).toEqual(primeira);
  } finally {
    vi.useRealTimers();
  }

  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: mensalAId } })).toMatchObject({ status: "PAUSADA" });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaA.id } })).toMatchObject({ status: "PAGO" });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: futuraA.id } })).toMatchObject({ status: "CANCELADA" });
  await expect(autorizarReproducaoGravacao("repo-a-pausa")).rejects.toThrow(/não autorizada/i);
  await expect(autorizarReproducaoGravacao("repo-b-pausa")).resolves.toMatchObject({ matriculaId: horaBId });
  expect(await fotografiaB(cobrancaB.id)).toEqual(antesB);
  expect(await prisma.movimentacaoAluno.count({ where: { matriculaId: mensalAId, tipo: "PAUSA" } })).toBe(1);
});

it("CT01 encerra somente A por ações públicas e preserva B por hora, suas fontes e seu vídeo", async () => {
  const mensalidadeA = await prisma.cobranca.create({ data: { matriculaId: mensalAId, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 500, valorNegociado: 500, saldo: 500, vencimento: new Date("2099-09-05T00:00:00.000Z"), coberturaInicio: new Date("2099-09-01T00:00:00.000Z"), coberturaFim: new Date("2099-09-30T00:00:00.000Z") } });
  entrar(financeiroId);
  const pagamentoA = await registrarRecebimentoDestinado({ titularMatriculaId: mensalAId, chaveIdempotencia: "ct01-encerramento-a", valorRecebido: 100, moeda: "CRC", forma: "DINHEIRO", dataPagamento: new Date("2099-09-04T12:00:00.000Z"), comentario: "Fonte financeira real do contrato mensal A.", destinos: [{ tipo: "COBRANCA", cobrancaId: mensalidadeA.id, valor: 100, evidencia: "Recibo do contrato A preservado no encerramento.", chaveIdempotencia: "ct01-encerramento-a-destino" }] });
  expect(pagamentoA.ok, pagamentoA.ok ? undefined : pagamentoA.erro).toBe(true);
  const cobrancaB = await criarCobrancaLiquidada(horaBId, TipoCobranca.HORA_PARTICULAR, "b-encerramento");
  await criarVideoReposicao("repo-a-encerramento", mensalAId);
  await criarVideoReposicao("repo-b-encerramento", horaBId);
  const documento = await prisma.documento.create({ data: { matriculaId: mensalAId, nome: "Contrato mensal A CT01", categoria: "CONTRATO", url: "/api/files/ct01-a.pdf" } });
  await prisma.matricula.update({ where: { id: mensalAId }, data: { contratoOk: true, contratoDocumentoId: documento.id, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date("2099-09-01T09:00:00.000Z") } });
  const condicoes = await prisma.condicoesEncerramentoMatricula.create({ data: { matriculaId: mensalAId, documentoId: documento.id, preparadorId: secretariaId, decisorId: adminId, status: "APROVADA", decididaEm: new Date("2099-09-01T10:00:00.000Z"), versao: 1, motivo: "Condições do contrato A conferidas.", motivoDecisao: "Aprovação independente das condições de A.", regras: { diaEncerramento: "INCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Sem desconto adicional.", multa: { tipo: "SEM_PREVISAO", motivo: "Contrato sem multa." } } } });
  await expect(autorizarReproducaoGravacao("repo-b-encerramento")).resolves.toMatchObject({ matriculaId: horaBId });
  const antesB = await fotografiaB(cobrancaB.id);

  entrar(secretariaId);
  const pedido = await solicitarEncerramentoMatriculas({ alunoId, matriculaIds: [mensalAId], dataSolicitada: "2099-09-15", motivo: "Encerrar apenas a mensalidade A.", evidenciaPedido: "Solicitação vinculada ao contrato A.", chaveIdempotencia: "ct01-pedido-a" });
  expect(pedido.ok, pedido.ok ? undefined : pedido.erro).toBe(true);
  if (!pedido.ok || !pedido.dado) throw new Error("Pedido de encerramento ausente.");
  const atualA = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidadeA.id } });
  const contrato = { matriculaId: mensalAId, condicoesId: condicoes.id, parcelas: [{ cobrancaId: mensalidadeA.id, versao: atualA.versao, valorBase: "500.00", descontoValido: "0.00", evidenciaCondicoes: "Cobertura e regra preservadas do contrato A." }], multa: { tipo: "SEM_PREVISAO" as const } };
  entrar(financeiroId);
  const previa = await preverComponenteMensalEncerramento({ alunoId, solicitacaoId: pedido.dado.solicitacaoId, contratos: [contrato] });
  expect(previa.ok, previa.ok ? undefined : previa.erro).toBe(true);
  const rascunho = await salvarRascunhoAcertoEncerramento({ alunoId, solicitacaoId: pedido.dado.solicitacaoId, versaoAnterior: 0, chaveIdempotencia: "ct01-rascunho-a", motivo: "Acerto exclusivo de A, preservando B.", contratos: [contrato] });
  expect(rascunho.ok, rascunho.ok ? undefined : rascunho.erro).toBe(true);
  if (!rascunho.ok || !rascunho.dado) throw new Error("Rascunho do encerramento ausente.");
  entrar(adminId);
  const decisao = await decidirAcertoEncerramento({ alunoId, rascunhoId: rascunho.dado.id, aprovar: true, motivo: "Acerto de A aprovado por pessoa independente." });
  expect(decisao.ok, decisao.ok ? undefined : decisao.erro).toBe(true);
  if (!decisao.ok || !decisao.dado) throw new Error("Decisão do encerramento ausente.");
  entrar(financeiroId);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2099-09-15T12:00:00.000Z"));
  try {
    const primeira = await efetivarAcertoEncerramento({ alunoId, decisaoId: decisao.dado.id });
    const replay = await efetivarAcertoEncerramento({ alunoId, decisaoId: decisao.dado.id });
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    expect(replay).toEqual(primeira);
  } finally {
    vi.useRealTimers();
  }

  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: mensalAId } })).toMatchObject({ status: "ENCERRADA" });
  await expect(autorizarReproducaoGravacao("repo-a-encerramento")).rejects.toThrow(/não autorizada/i);
  await expect(autorizarReproducaoGravacao("repo-b-encerramento")).resolves.toMatchObject({ matriculaId: horaBId });
  expect(await fotografiaB(cobrancaB.id)).toEqual(antesB);
  expect(await prisma.solicitacaoEncerramentoMatriculas.count({ where: { alunoId } })).toBe(1);
  expect(await prisma.efetivacaoAcertoEncerramento.count({ where: { decisaoId: decisao.dado.id } })).toBe(1);
});
