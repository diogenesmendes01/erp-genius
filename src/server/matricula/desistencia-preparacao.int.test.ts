import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormaPagamento, Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// A fronteira de sessão é a única simulação: as ações continuam relendo o
// usuário ativo e seus papéis no PostgreSQL durante a transação real.
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
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";

let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let administradora: typeof secretaria;
let professor: typeof secretaria;
let vendedor: typeof secretaria;
let financeiro: typeof secretaria;
let secretariaInativa: typeof secretaria;
let matriculaId: string;
let outraMatriculaId: string;
let alunoId: string;
let produtoId: string;
let paisId: string;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const chave = (sufixo: string) => `desistencia-preparacao-${sufixo}`;
const motivo = "Pedido de desistência recebido pela Secretaria.";
const evidenciaPedido = "Registro do atendimento identificado e disponível para conferência.";

async function criarMatricula(aluno: string) {
  return prisma.matricula.create({
    data: {
      alunoId: aluno,
      produtoId,
      paisId,
      moeda: "CRC",
      status: "AGUARDANDO",
    },
  });
}

async function conferir(id = matriculaId) {
  entrar(secretaria.id);
  const resposta = await consultarDesistenciaPreparacao({ matriculaId: id });
  expect(resposta.ok, resposta.ok ? undefined : resposta.erro).toBe(true);
  if (!resposta.ok || !resposta.dado) throw new Error("Conferência ausente.");
  return resposta.dado;
}

async function registrar(id: string, estadoHash: string, sufixo: string) {
  return registrarPedidoDesistenciaPreparacao({
    matriculaId: id,
    estadoHash,
    motivo,
    evidenciaPedido,
    chaveIdempotencia: chave(sufixo),
  });
}

async function criarCobranca(id = matriculaId) {
  return prisma.cobranca.create({
    data: {
      matriculaId: id,
      tipo: TipoCobranca.MATRICULA,
      valorOriginal: 100,
      valorNegociado: 100,
      saldo: 100,
      moeda: "CRC",
      vencimento: new Date("2026-10-15T12:00:00.000Z"),
    },
  });
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  paisId = catalogo.pais.id;
  produtoId = catalogo.produto.id;
  [secretaria, administradora, professor, vendedor, financeiro, secretariaInativa] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria"),
    criarUsuario([Papel.ADMINISTRADOR], "Administração"),
    criarUsuario([Papel.PROFESSOR], "Professor"),
    criarUsuario([Papel.VENDEDOR], "Vendedor"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro"),
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria inativa"),
  ]);
  await prisma.usuario.update({ where: { id: secretariaInativa.id }, data: { ativo: false } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pessoa", paisId } });
  alunoId = aluno.id;
  matriculaId = (await criarMatricula(alunoId)).id;
  outraMatriculaId = (await criarMatricula(alunoId)).id;
  entrar(secretaria.id);
});

describe("pedido de desistência durante a preparação", () => {
  it("registra a intenção conferida sem efetivar qualquer consequência acadêmica ou financeira", async () => {
    const antes = {
      cobrancas: await prisma.cobranca.count(),
      reservasTurma: await prisma.reservaVagaMatricula.count(),
      reservasParticulares: await prisma.reservaAgendaParticular.count(),
      alocacoes: await prisma.alocacaoTurma.count(),
      recebimentos: await prisma.recebimento.count(),
      pedidos: await prisma.pedidoDesistenciaPreparacao.count(),
    };
    const consulta = await conferir();
    expect(consulta.conferencia).toMatchObject({
      matriculaId,
      status: "AGUARDANDO",
      podeRegistrar: true,
      exigeAprovacaoAdministrativa: false,
    });
    expect(consulta.pedidos).toEqual([]);

    const resultado = await registrar(matriculaId, consulta.estadoHash, "sem-avanco");
    expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
    expect(resultado.ok && resultado.dado).toMatchObject({ versao: 1 });
    expect(await prisma.pedidoDesistenciaPreparacao.count()).toBe(antes.pedidos + 1);
    expect(await prisma.cobranca.count()).toBe(antes.cobrancas);
    expect(await prisma.reservaVagaMatricula.count()).toBe(antes.reservasTurma);
    expect(await prisma.reservaAgendaParticular.count()).toBe(antes.reservasParticulares);
    expect(await prisma.alocacaoTurma.count()).toBe(antes.alocacoes);
    expect(await prisma.recebimento.count()).toBe(antes.recebimentos);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({
      alunoId,
      status: "AGUARDANDO",
    });
  });

  it("marca informe a conferir e recebimento como conferência administrativa, sem aprová-los", async () => {
    const cobranca = await criarCobranca();
    await prisma.pagamentoInformado.create({
      data: {
        cobrancaId: cobranca.id,
        autorId: secretaria.id,
        chaveIdempotencia: "informe-desistencia-001",
        valor: 100,
        moeda: "CRC",
        forma: FormaPagamento.TRANSFERENCIA,
        dataPagamento: new Date("2026-10-10T12:00:00.000Z"),
      },
    });
    let consulta = await conferir();
    expect(consulta.conferencia).toMatchObject({
      exigeAprovacaoAdministrativa: true,
      financeiro: { informesAConferir: 1, haAvancoFormal: true },
    });
    expect((await registrar(matriculaId, consulta.estadoHash, "informe")).ok).toBe(true);

    await prisma.recebimento.create({
      data: {
        cobrancaId: cobranca.id,
        autorId: financeiro.id,
        chaveIdempotencia: "recebimento-desistencia-001",
        valor: 100,
        moeda: "CRC",
        forma: FormaPagamento.TRANSFERENCIA,
        dataPagamento: new Date("2026-10-11T12:00:00.000Z"),
      },
    });
    consulta = await conferir();
    expect(consulta.conferencia).toMatchObject({
      exigeAprovacaoAdministrativa: true,
      financeiro: { recebimentos: 1, haAvancoFormal: true },
    });
  });

  it("rejeita fotografia vencida por nova cobrança ou informe e conserva o pedido anterior", async () => {
    const conferenciaInicial = await conferir();
    await criarCobranca();
    expect((await registrar(matriculaId, conferenciaInicial.estadoHash, "cobranca-alterada")).ok).toBe(false);

    const aposCobranca = await conferir();
    const pedido = await registrar(matriculaId, aposCobranca.estadoHash, "atualizado");
    expect(pedido.ok, pedido.ok ? undefined : pedido.erro).toBe(true);
    await prisma.pagamentoInformado.create({
      data: {
        cobrancaId: (await prisma.cobranca.findFirstOrThrow({ where: { matriculaId } })).id,
        autorId: secretaria.id,
        chaveIdempotencia: "informe-muda-fotografia",
        valor: 20,
        moeda: "CRC",
        forma: FormaPagamento.DINHEIRO,
        dataPagamento: new Date("2026-10-12T12:00:00.000Z"),
      },
    });
    expect((await registrar(matriculaId, aposCobranca.estadoHash, "informe-alterado")).ok).toBe(false);
    expect(await prisma.pedidoDesistenciaPreparacao.count({ where: { matriculaId } })).toBe(1);
  });

  it("reenvia a mesma chave uma única vez sob concorrência e cria a próxima versão com nova chave", async () => {
    const consulta = await conferir();
    const input = {
      matriculaId,
      estadoHash: consulta.estadoHash,
      motivo,
      evidenciaPedido,
      chaveIdempotencia: chave("concorrente"),
    };
    const [primeiro, segundo] = await Promise.all([
      registrarPedidoDesistenciaPreparacao(input),
      registrarPedidoDesistenciaPreparacao(input),
    ]);
    expect(primeiro.ok && segundo.ok).toBe(true);
    if (!primeiro.ok || !primeiro.dado || !segundo.ok || !segundo.dado) throw new Error("Reenvio ausente.");
    expect(segundo.dado).toEqual(primeiro.dado);
    expect(await prisma.pedidoDesistenciaPreparacao.count({ where: { matriculaId } })).toBe(1);

    const atual = await conferir();
    expect(atual.proximaVersao).toBe(2);
    const novo = await registrar(matriculaId, atual.estadoHash, "nova-versao");
    expect(novo.ok && novo.dado).toMatchObject({ versao: 2 });
    expect(await prisma.pedidoDesistenciaPreparacao.findMany({ where: { matriculaId }, orderBy: { versao: "asc" } })).toMatchObject([
      { versao: 1 },
      { versao: 2 },
    ]);
  });

  it("recusa papéis sem alçada, usuário inativo e matrículas fora da preparação", async () => {
    const consulta = await conferir();
    for (const usuario of [professor, vendedor, financeiro, secretariaInativa]) {
      entrar(usuario.id);
      expect((await registrar(matriculaId, consulta.estadoHash, `sem-alcada-${usuario.id}`)).ok).toBe(false);
    }

    entrar(secretaria.id);
    await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "ATIVA" } });
    expect((await registrar(matriculaId, (await conferir()).estadoHash, "ativa")).ok).toBe(false);
    await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
    expect((await registrar(matriculaId, (await conferir()).estadoHash, "pausada")).ok).toBe(false);
  });

  it("isola contratos do mesmo aluno e preserva a imutabilidade também em SQL direto", async () => {
    const primeira = await conferir(matriculaId);
    expect((await registrar(matriculaId, primeira.estadoHash, "primeiro-contrato")).ok).toBe(true);
    const segunda = await conferir(outraMatriculaId);
    expect(segunda.pedidos).toEqual([]);
    expect(segunda.conferencia).toMatchObject({ matriculaId: outraMatriculaId });

    const pedido = await prisma.pedidoDesistenciaPreparacao.findFirstOrThrow({ where: { matriculaId } });
    await expect(prisma.pedidoDesistenciaPreparacao.update({
      where: { id: pedido.id },
      data: { motivo: "Tentativa de mudar pedido preservado" },
    })).rejects.toThrow("preservado");
    await expect(prisma.pedidoDesistenciaPreparacao.delete({ where: { id: pedido.id } })).rejects.toThrow("preservado");

    await expect(prisma.pedidoDesistenciaPreparacao.create({
      data: {
        matriculaId: outraMatriculaId,
        registradorId: vendedor.id,
        versao: 1,
        motivo,
        evidenciaPedido,
        chaveIdempotencia: chave("sql-papel-indevido"),
        entradaHash: "a".repeat(64),
        estadoHash: "b".repeat(64),
        snapshotJson: { matriculaId: outraMatriculaId },
      },
    })).rejects.toThrow("Secretaria ou Administração ativa");
  });

  it("permite Administração registrar, mas conserva o estado, reservas e cobranças", async () => {
    entrar(administradora.id);
    const consulta = await consultarDesistenciaPreparacao({ matriculaId });
    expect(consulta.ok && consulta.dado?.conferencia).toMatchObject({ podeRegistrar: true });
    if (!consulta.ok || !consulta.dado) throw new Error("Conferência administrativa ausente.");
    const resultado = await registrarPedidoDesistenciaPreparacao({
      matriculaId,
      estadoHash: consulta.dado.estadoHash,
      motivo,
      evidenciaPedido,
      chaveIdempotencia: chave("administracao"),
    });
    expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "AGUARDANDO" });
    expect(await prisma.cobranca.count({ where: { matriculaId } })).toBe(0);
    expect(await prisma.reservaVagaMatricula.count({ where: { matriculaId } })).toBe(0);
  });
});
