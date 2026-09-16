import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUnique({ where: { id: autenticacao.user.id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new atual.ErroAutenticacao();
    return usuario;
  };
  return { ...atual, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao();
    atual.exigirPapel(usuario, ...papeis);
    return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarCancelamentoFinanceiroDesistencia, listarDesistenciasFinanceiras } from "./desistencia-financeiro-consulta";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";
import { decidirCancelamentoFinanceiroDesistenciaPreparacao, proporCancelamentoFinanceiroDesistenciaPreparacao } from "./desistencia-financeira";

let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let administradora: typeof secretaria;
let financeiro: typeof secretaria;
let aprovador: typeof secretaria;
let matriculaId: string;
let produtoId: string;
let paisId: string;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const motivo = "Desistência registrada e disponível para conferência financeira.";
const evidencia = "Cobrança conferida sem recebimento, crédito ou outro movimento financeiro.";

async function criarCobranca(matricula = matriculaId) {
  return prisma.cobranca.create({ data: {
    matriculaId: matricula, tipo: TipoCobranca.MATRICULA, valorOriginal: 100, valorNegociado: 90, saldo: 90,
    moeda: "CRC", vencimento: new Date("2099-10-15T12:00:00.000Z"),
  } });
}

async function registrar(sufixo: string) {
  entrar(secretaria.id);
  const consulta = await consultarDesistenciaPreparacao({ matriculaId });
  expect(consulta.ok, consulta.ok ? undefined : consulta.erro).toBe(true);
  if (!consulta.ok || !consulta.dado) throw new Error("Conferência de desistência ausente.");
  const pedido = await registrarPedidoDesistenciaPreparacao({
    matriculaId, estadoHash: consulta.dado.estadoHash, motivo, evidenciaPedido: evidencia, chaveIdempotencia: `consulta-desistencia-${sufixo}`,
  });
  expect(pedido.ok, pedido.ok ? undefined : pedido.erro).toBe(true);
  if (!pedido.ok || !pedido.dado) throw new Error("Pedido de desistência ausente.");
  return prisma.pedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { id: pedido.dado.id } });
}

async function aprovar(pedidoId: string, estadoHash: string, aprovada = true) {
  entrar(financeiro.id);
  const proposta = await proporCancelamentoFinanceiroDesistenciaPreparacao({
    pedidoId, estadoHash, motivo, evidenciaCondicoes: evidencia, chaveIdempotencia: `proposta-consulta-${pedidoId}`,
  });
  expect(proposta.ok, proposta.ok ? undefined : proposta.erro).toBe(true);
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta financeira ausente.");
  entrar(aprovador.id);
  const decisao = await decidirCancelamentoFinanceiroDesistenciaPreparacao({ propostaId: proposta.dado.id, propostaHash: proposta.dado.entradaHash, aprovada, motivo });
  expect(decisao.ok, decisao.ok ? undefined : decisao.erro).toBe(true);
  if (!decisao.ok || !decisao.dado) throw new Error("Decisão financeira ausente.");
  return decisao.dado.id;
}

async function consultarPreparacao() {
  entrar(secretaria.id);
  const resposta = await consultarDesistenciaPreparacao({ matriculaId });
  expect(resposta.ok, resposta.ok ? undefined : resposta.erro).toBe(true);
  if (!resposta.ok || !resposta.dado) throw new Error("Consulta da Secretaria ausente.");
  return resposta.dado;
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  produtoId = catalogo.produto.id;
  paisId = catalogo.pais.id;
  [secretaria, administradora, financeiro, aprovador] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria"),
    criarUsuario([Papel.ADMINISTRADOR], "Administração"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro"),
    criarUsuario([Papel.FINANCEIRO], "Aprovador financeiro"),
  ]);
  await prisma.usuario.update({ where: { id: aprovador.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pessoa", paisId } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId, paisId, moeda: "CRC", status: "AGUARDANDO" } })).id;
  entrar(secretaria.id);
});

describe("consultas do acerto financeiro da desistência", () => {
  it("permite Financeiro e Administração consultar os valores da cobrança", async () => {
    const cobranca = await criarCobranca();
    const pedido = await registrar("valores");
    for (const usuario of [financeiro, administradora]) {
      entrar(usuario.id);
      const resposta = await consultarCancelamentoFinanceiroDesistencia({ matriculaId });
      expect(resposta.ok, resposta.ok ? undefined : resposta.erro).toBe(true);
      expect(resposta.ok && resposta.dado).toMatchObject({ pedido: { id: pedido.id }, cobrancas: [{ id: cobranca.id, valorOriginal: "100.00", valorNegociado: "90.00", saldo: "90.00" }] });
    }
  });

  it("nega a consulta financeira à Secretaria, mas expõe somente a autorização de efetivar após aprovação", async () => {
    await criarCobranca();
    const pedido = await registrar("secretaria");
    const decisaoFinanceiraId = await aprovar(pedido.id, pedido.estadoHash);

    entrar(secretaria.id);
    expect((await consultarCancelamentoFinanceiroDesistencia({ matriculaId })).ok).toBe(false);
    const consulta = await consultarPreparacao();
    expect(consulta).toMatchObject({ podeEfetivar: true, decisaoFinanceiraId });
    expect(consulta).not.toHaveProperty("cobrancas");
    expect(consulta).not.toHaveProperty("propostas");
  });

  it.each(["alçada revogada", "decisão reprovada", "fonte financeira alterada"] as const)("não libera a efetivação quando há %s", async (caso) => {
    await criarCobranca();
    const pedido = await registrar(caso);
    await aprovar(pedido.id, pedido.estadoHash, caso !== "decisão reprovada");
    if (caso === "alçada revogada") {
      await prisma.usuario.update({ where: { id: aprovador.id }, data: { permissoes: [] } });
    }
    if (caso === "fonte financeira alterada") await criarCobranca();

    const consulta = await consultarPreparacao();
    expect(consulta).toMatchObject({ podeEfetivar: false, decisaoFinanceiraId: null });
  });

  it("lista uma matrícula uma vez e apresenta o pedido mais recente", async () => {
    await criarCobranca();
    await registrar("primeiro");
    const ultimo = await registrar("ultimo");
    entrar(financeiro.id);
    const resposta = await listarDesistenciasFinanceiras();
    expect(resposta.ok, resposta.ok ? undefined : resposta.erro).toBe(true);
    if (!resposta.ok || !resposta.dado) throw new Error("Listagem financeira ausente.");
    const itens = resposta.dado.itens.filter(item => item.id === matriculaId);
    expect(itens).toEqual([{ id: matriculaId, codigo: null, pedido: { versao: ultimo.versao, motivo } }]);
  });
});
