import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUnique({
      where: { id: autenticacao.user.id },
      select: { id: true, nome: true, ativo: true, papeis: true },
    });
    if (!usuario?.ativo) throw new atual.ErroAutenticacao();
    return usuario;
  };
  return {
    ...atual,
    exigirSessao: sessao,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const usuario = await sessao();
      atual.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { receberTx } from "@/server/financeiro/recebimentos";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { reservarVagaMatriculaTx } from "./reserva-vaga-tx";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";
import { efetivarPedidoDesistenciaPreparacao } from "./desistencia-efetivacao";
import {
  decidirCancelamentoFinanceiroDesistenciaPreparacao,
  proporCancelamentoFinanceiroDesistenciaPreparacao,
} from "./desistencia-financeira";

let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let administradora: typeof secretaria;
let professor: typeof secretaria;
let financeiroProponente: typeof secretaria;
let financeiroAprovador: typeof secretaria;
let financeiroSemAlcada: typeof secretaria;
let financeiroInativo: typeof secretaria;
let matriculaId: string;
let outraMatriculaId: string;
let alunoId: string;
let turmaId: string;
let produtoId: string;
let paisId: string;

const motivoPedido = "Pessoa desistiu antes de concluir a preparação comercial.";
const evidenciaPedido = "Atendimento identificado e disponível para conferência administrativa.";
const motivoFinanceiro = "Cancelamento financeiro conferido para a desistência da preparação.";
const evidenciaFinanceira = "Cobrança sem baixa, recebimento ou crédito, revisada pelo Financeiro.";
const motivoDecisao = "Condições financeiras conferidas por pessoa independente.";
const motivoEfetivacao = "Secretaria efetivou a desistência após a decisão financeira aprovada.";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function reservarVaga(matricula = matriculaId, chaveIdempotencia = "reserva-financeira-fixture") {
  return prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, {
    matriculaId: matricula,
    turmaId,
    autorId: secretaria.id,
    motivo: "Reserva real da preparação que será desistida com acerto financeiro.",
    chaveIdempotencia,
  }));
}

async function registrarPedido(matricula = matriculaId, sufixo = "principal") {
  entrar(secretaria.id);
  const consulta = await consultarDesistenciaPreparacao({ matriculaId: matricula });
  expect(consulta.ok, consulta.ok ? undefined : consulta.erro).toBe(true);
  if (!consulta.ok || !consulta.dado) throw new Error("Conferência de desistência ausente.");
  const resultado = await registrarPedidoDesistenciaPreparacao({
    matriculaId: matricula,
    estadoHash: consulta.dado.estadoHash,
    motivo: motivoPedido,
    evidenciaPedido,
    chaveIdempotencia: `pedido-financeiro-${sufixo}`,
  });
  expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
  if (!resultado.ok || !resultado.dado) throw new Error("Pedido de desistência ausente.");
  return prisma.pedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { id: resultado.dado.id } });
}

async function criarCobranca(matricula = matriculaId) {
  return prisma.cobranca.create({
    data: {
      matriculaId: matricula,
      tipo: TipoCobranca.MATRICULA,
      valorOriginal: 100,
      valorNegociado: 90,
      saldo: 90,
      moeda: "CRC",
      vencimento: new Date("2099-10-15T12:00:00.000Z"),
    },
  });
}

async function propor(pedidoId: string, estadoHash: string, sufixo = "principal") {
  entrar(financeiroProponente.id);
  return proporCancelamentoFinanceiroDesistenciaPreparacao({
    pedidoId,
    estadoHash,
    motivo: motivoFinanceiro,
    evidenciaCondicoes: evidenciaFinanceira,
    chaveIdempotencia: `proposta-financeira-${sufixo}`,
  });
}

async function decidir(propostaId: string, propostaHash: string, aprovada = true) {
  entrar(financeiroAprovador.id);
  return decidirCancelamentoFinanceiroDesistenciaPreparacao({
    propostaId,
    propostaHash,
    aprovada,
    motivo: motivoDecisao,
  });
}

async function efetivar(pedidoId: string, estadoHash: string, decisaoFinanceiraId: string) {
  entrar(secretaria.id);
  return efetivarPedidoDesistenciaPreparacao({
    pedidoId,
    estadoHash,
    motivo: motivoEfetivacao,
    decisaoFinanceiraId,
  });
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  paisId = catalogo.pais.id;
  produtoId = catalogo.produto.id;
  [secretaria, administradora, professor, financeiroProponente, financeiroAprovador, financeiroSemAlcada, financeiroInativo] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria"),
    criarUsuario([Papel.ADMINISTRADOR], "Administração"),
    criarUsuario([Papel.PROFESSOR], "Professor"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro proponente"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro aprovador"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro sem alçada"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro inativo"),
  ]);
  await prisma.usuario.update({
    where: { id: financeiroAprovador.id },
    data: { permissoes: ["financeiro.aprovar_acertos"] },
  });
  await prisma.usuario.update({ where: { id: financeiroInativo.id }, data: { ativo: false } });
  await prisma.configuracaoOperacional.create({ data: { prazoReservaMinutos: 60 } });

  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "DESISTENCIA_FIN", ordem: 1 } });
  const turma = await prisma.turma.create({
    data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, capacidade: 2 },
  });
  turmaId = turma.id;
  const janela = await prisma.janelaAdmissaoTurma.create({
    data: {
      turmaId,
      preparadorId: secretaria.id,
      versao: 1,
      limiteEntrada: new Date("2099-12-31T00:00:00.000Z"),
      fusoAdmissao: "UTC",
      motivo: "Janela de admissão da fixture financeira.",
      chaveIdempotencia: "janela-financeira-fixture",
      entradaHash: "fixture",
    },
  });
  await prisma.decisaoJanelaAdmissao.create({
    data: { propostaId: janela.id, decisorId: administradora.id, aprovada: true, motivo: "Janela conferida." },
  });
  const calendario = await prisma.versaoCalendarioEscolar.create({
    data: {
      versao: 1,
      preparadorId: secretaria.id,
      fusoInstitucional: "UTC",
      periodos: [],
      motivo: "Calendário da fixture financeira.",
      chaveIdempotencia: "calendario-financeira-fixture",
      entradaHash: "fixture",
    },
  });
  await prisma.decisaoCalendarioEscolar.create({
    data: { calendarioId: calendario.id, decisorId: administradora.id, aprovada: true, motivo: "Calendário conferido." },
  });
  const grade = await prisma.propostaGradeTurma.create({
    data: {
      turmaId,
      calendarioId: calendario.id,
      preparadorId: secretaria.id,
      versao: 1,
      fusoOrigem: "UTC",
      motivo: "Grade da fixture financeira.",
      chaveIdempotencia: "grade-financeira-fixture",
      entradaHash: "fixture",
      snapshot: {},
    },
  });
  await prisma.decisaoGradeTurma.create({
    data: { propostaId: grade.id, decisorId: administradora.id, aprovada: true, motivo: "Grade conferida." },
  });
  await prisma.encontroAgenda.create({
    data: {
      turmaId,
      propostaGradeId: grade.id,
      professorId: professor.id,
      preparadorId: secretaria.id,
      inicio: new Date("2099-10-02T12:00:00.000Z"),
      fim: new Date("2099-10-02T13:00:00.000Z"),
      fusoOrigem: "UTC",
      finalidade: "AULA",
      status: "PREVISTO",
      motivo: "Agenda publicada da fixture financeira.",
      chaveIdempotencia: "encontro-financeiro-fixture",
      entradaHash: "fixture",
    },
  });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pessoa", paisId } });
  alunoId = aluno.id;
  const [matricula, outra] = await Promise.all([
    prisma.matricula.create({ data: { alunoId, produtoId, paisId, moeda: "CRC", status: "AGUARDANDO" } }),
    prisma.matricula.create({ data: { alunoId, produtoId, paisId, moeda: "CRC", status: "AGUARDANDO" } }),
  ]);
  matriculaId = matricula.id;
  outraMatriculaId = outra.id;
  entrar(secretaria.id);
});

describe("acerto financeiro da desistência em preparação", () => {
  it("cancela a cobrança não paga sem baixa fictícia e libera só as reservas da matrícula conferida", async () => {
    const reserva = await reservarVaga();
    const cobranca = await criarCobranca();
    const pedido = await registrarPedido();
    const proposta = await propor(pedido.id, pedido.estadoHash);
    expect(proposta.ok, proposta.ok ? undefined : proposta.erro).toBe(true);
    if (!proposta.ok || !proposta.dado) throw new Error("Proposta financeira ausente.");
    const decisao = await decidir(proposta.dado.id, proposta.dado.entradaHash);
    expect(decisao.ok, decisao.ok ? undefined : decisao.erro).toBe(true);
    if (!decisao.ok || !decisao.dado) throw new Error("Decisão financeira ausente.");

    const resultado = await efetivar(pedido.id, pedido.estadoHash, decisao.dado.id);
    expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
    if (!resultado.ok || !resultado.dado) throw new Error("Efetivação financeira ausente.");
    expect(resultado.dado).toMatchObject({ matriculaId, status: "CANCELADA" });
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "CANCELADA" });
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outraMatriculaId } })).toMatchObject({ status: "AGUARDANDO" });
    expect(await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } })).toMatchObject({ status: "LIBERADA" });
    const cobrancaCancelada = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
    expect(cobrancaCancelada).toMatchObject({
      status: "CANCELADA",
      valorOriginal: cobranca.valorOriginal,
      valorNegociado: cobranca.valorNegociado,
      saldo: cobranca.saldo,
      vencimento: cobranca.vencimento,
      canceladaPorDesistenciaId: resultado.dado.id,
    });
    expect(cobrancaCancelada.versao).toBe(cobranca.versao + 1);
    expect(await prisma.recebimento.count({ where: { cobrancaId: cobranca.id } })).toBe(0);
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { pedidoId: pedido.id } })).toMatchObject({
      decisaoFinanceiraId: decisao.dado.id,
    });
  });

  it("exige proponente financeiro, decisão independente e alçada atual para aprovar", async () => {
    await criarCobranca();
    const pedido = await registrarPedido();
    const entrada = {
      pedidoId: pedido.id,
      estadoHash: pedido.estadoHash,
      motivo: motivoFinanceiro,
      evidenciaCondicoes: evidenciaFinanceira,
      chaveIdempotencia: "proposta-financeira-autorizacao",
    };
    entrar(secretaria.id);
    expect((await proporCancelamentoFinanceiroDesistenciaPreparacao(entrada)).ok).toBe(false);

    const proposta = await propor(pedido.id, pedido.estadoHash, "autorizacao");
    expect(proposta.ok, proposta.ok ? undefined : proposta.erro).toBe(true);
    if (!proposta.ok || !proposta.dado) throw new Error("Proposta financeira ausente.");
    entrar(financeiroProponente.id);
    expect((await decidirCancelamentoFinanceiroDesistenciaPreparacao({
      propostaId: proposta.dado.id,
      propostaHash: proposta.dado.entradaHash,
      aprovada: true,
      motivo: motivoDecisao,
    })).ok).toBe(false);
    entrar(financeiroSemAlcada.id);
    expect((await decidirCancelamentoFinanceiroDesistenciaPreparacao({
      propostaId: proposta.dado.id,
      propostaHash: proposta.dado.entradaHash,
      aprovada: true,
      motivo: motivoDecisao,
    })).ok).toBe(false);
    entrar(financeiroInativo.id);
    expect((await decidirCancelamentoFinanceiroDesistenciaPreparacao({
      propostaId: proposta.dado.id,
      propostaHash: proposta.dado.entradaHash,
      aprovada: true,
      motivo: motivoDecisao,
    })).ok).toBe(false);
    expect((await decidir(proposta.dado.id, proposta.dado.entradaHash)).ok).toBe(true);
  });

  it("repete proposta, decisão e efetivação exatas sem duplicar o acerto", async () => {
    await criarCobranca();
    const pedido = await registrarPedido();
    const input = {
      pedidoId: pedido.id,
      estadoHash: pedido.estadoHash,
      motivo: motivoFinanceiro,
      evidenciaCondicoes: evidenciaFinanceira,
      chaveIdempotencia: "proposta-financeira-replay",
    };
    entrar(financeiroProponente.id);
    const [primeira, segunda] = await Promise.all([
      proporCancelamentoFinanceiroDesistenciaPreparacao(input),
      proporCancelamentoFinanceiroDesistenciaPreparacao(input),
    ]);
    expect(segunda).toEqual(primeira);
    if (!primeira.ok || !primeira.dado) throw new Error("Proposta financeira ausente.");
    expect(await prisma.propostaFinanceiraDesistencia.count({ where: { pedidoId: pedido.id } })).toBe(1);

    const primeiraDecisao = await decidir(primeira.dado.id, primeira.dado.entradaHash);
    const segundaDecisao = await decidir(primeira.dado.id, primeira.dado.entradaHash);
    expect(segundaDecisao).toEqual(primeiraDecisao);
    if (!primeiraDecisao.ok || !primeiraDecisao.dado) throw new Error("Decisão financeira ausente.");
    const primeiraEfetivacao = await efetivar(pedido.id, pedido.estadoHash, primeiraDecisao.dado.id);
    const segundaEfetivacao = await efetivar(pedido.id, pedido.estadoHash, primeiraDecisao.dado.id);
    expect(segundaEfetivacao).toEqual(primeiraEfetivacao);
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count({ where: { pedidoId: pedido.id } })).toBe(1);
  });

  it.each(["nova cobrança", "recebimento posterior"] as const)("recusa efetivação com decisão financeira obsoleta por %s", async (mudanca) => {
    const cobranca = await criarCobranca();
    const pedido = await registrarPedido();
    const proposta = await propor(pedido.id, pedido.estadoHash, `obsoleta-${mudanca}`);
    if (!proposta.ok || !proposta.dado) throw new Error("Proposta financeira ausente.");
    const decisao = await decidir(proposta.dado.id, proposta.dado.entradaHash);
    if (!decisao.ok || !decisao.dado) throw new Error("Decisão financeira ausente.");
    if (mudanca === "nova cobrança") {
      await criarCobranca(matriculaId);
    } else {
      await prisma.$transaction(tx => receberTx(tx, {
        cobrancaId: cobranca.id, autorId: financeiroAprovador.id,
        chaveIdempotencia: "recebimento-financeiro-posterior", valorRecebido: 10,
        forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-10T12:00:00.000Z"),
        evidencia: "Recebimento posterior à decisão de desistência.",
      }));
    }
    expect((await efetivar(pedido.id, pedido.estadoHash, decisao.dado.id)).ok).toBe(false);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "AGUARDANDO" });
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count({ where: { pedidoId: pedido.id } })).toBe(0);
  });

  it.each(["paga", "documento"] as const)("mantém %s fora deste acerto simplificado", async (fonte) => {
    const cobranca = await criarCobranca();
    if (fonte === "paga") {
      await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroAprovador.id, chaveIdempotencia: "desistencia-cobranca-paga", valorRecebido: 90, forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-10T12:00:00.000Z"), evidencia: "Cobrança quitada fora do acerto simplificado." }));
    } else {
      await prisma.documento.create({
        data: { matriculaId, categoria: "CONTRATO", nome: "Documento fora do acerto", url: "/api/files/contrato.pdf" },
      });
    }
    const pedido = await registrarPedido(matriculaId, `fora-${fonte}`);
    expect((await propor(pedido.id, pedido.estadoHash, `fora-${fonte}`)).ok).toBe(false);
    expect(await prisma.propostaFinanceiraDesistencia.count({ where: { pedidoId: pedido.id } })).toBe(0);
  });

  it.each(["PENDENTE", "CANCELADA"] as const)("preserva cobrança originalmente %s e impede novas baixas após efetivar", async (status) => {
    const criada = await criarCobranca();
    const original = await prisma.cobranca.update({ where: { id: criada.id }, data: { status } });
    const pedido = await registrarPedido();
    const proposta = await propor(pedido.id, pedido.estadoHash);
    if (!proposta.ok || !proposta.dado) throw new Error("Proposta ausente.");
    const decisao = await decidir(proposta.dado.id, proposta.dado.entradaHash);
    if (!decisao.ok || !decisao.dado) throw new Error("Decisão ausente.");
    const aplicada = await efetivar(pedido.id, pedido.estadoHash, decisao.dado.id);
    expect(aplicada.ok, aplicada.ok ? undefined : aplicada.erro).toBe(true);
    const preservada = await prisma.cobranca.findUniqueOrThrow({ where: { id: original.id } });
    if (status === "CANCELADA") expect(preservada).toEqual(original);
    await expect(prisma.cobranca.update({ where: { id: original.id }, data: { status: "PENDENTE" } })).rejects.toThrow(/preservada|desistência/i);
    await expect(prisma.cobranca.update({ where: { id: original.id }, data: { saldo: 0 } })).rejects.toThrow(/preservada|desistência/i);
    await expect(prisma.cobranca.delete({ where: { id: original.id } })).rejects.toThrow(/preservada|desistência/i);
    await expect(prisma.recebimento.create({ data: {
      cobrancaId: original.id, titularMatriculaId: matriculaId, autorId: financeiroAprovador.id, chaveIdempotencia: "baixa-depois-desistencia",
      valor: 90, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-20T12:00:00.000Z"),
    } })).rejects.toThrow(/desistência/i);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: original.id } })).toEqual(preservada);
    expect(await prisma.recebimento.count({ where: { cobrancaId: original.id } })).toBe(0);
  });

  it("permite alterar e excluir cobrança cancelada antes da efetivação", async () => {
    const criada = await criarCobranca();
    const cancelada = await prisma.cobranca.update({
      where: { id: criada.id },
      data: { status: "CANCELADA" },
    });

    const atualizada = await prisma.cobranca.update({
      where: { id: cancelada.id },
      data: { comentario: "Cancelamento ainda sem efetivação da desistência." },
    });
    expect(atualizada).toMatchObject({
      id: cancelada.id,
      status: "CANCELADA",
      comentario: "Cancelamento ainda sem efetivação da desistência.",
    });

    await prisma.cobranca.delete({ where: { id: cancelada.id } });
    expect(await prisma.cobranca.findUnique({ where: { id: cancelada.id } })).toBeNull();
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count({ where: { matriculaId } })).toBe(0);
  });

  it("nega aplicação SQL forjada com cobrança sem decisão financeira vinculada", async () => {
    await criarCobranca();
    const pedido = await registrarPedido();
    await expect(prisma.efetivacaoPedidoDesistenciaPreparacao.create({
      data: {
        pedidoId: pedido.id,
        matriculaId,
        executorId: secretaria.id,
        motivo: motivoEfetivacao,
        entradaHash: "a".repeat(64),
        estadoHash: pedido.estadoHash,
      },
    })).rejects.toThrow(/financeir|decisão|acerto/i);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "AGUARDANDO" });
  });
});
