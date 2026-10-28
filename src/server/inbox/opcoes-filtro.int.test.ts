import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Papel, DriverWhatsApp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { opcoesFiltroInbox, vendedorSemWhatsAppConectado } from "./opcoes-filtro";

let seq = 0;
beforeEach(async () => { await truncarBanco(); });
afterAll(() => prisma.$disconnect());

async function numero(rotulo: string, finalidade: "VENDAS" | "COBRANCA", setores: ("COMERCIAL" | "FINANCEIRO" | "SECRETARIA" | "PEDAGOGICO")[] = [], donoId?: string) {
  seq += 1;
  return prisma.numeroWhatsApp.create({ data: {
    telefoneE164: `+55118${String(seq).padStart(8, "0")}`, rotulo, driver: DriverWhatsApp.BAILEYS, finalidade, providerRef: `ref-of-${seq}`,
    ...(donoId ? { donoId } : {}),
    setores: { create: setores.map((s) => ({ finalidade: s })) },
  } });
}

describe("opções dos filtros da coluna", () => {
  it("financeiro vê só os números que servem os seus setores; administrador vê todos; sem setor, nada", async () => {
    const cobranca = await numero("Cobrança", "COBRANCA");
    const vendas = await numero("Vendas", "VENDAS");
    const secretaria = await numero("Secretaria", "VENDAS", ["SECRETARIA"]);

    const fin = await opcoesFiltroInbox({ papeis: [Papel.FINANCEIRO] });
    expect(fin.setores).toEqual(["FINANCEIRO"]);
    expect(fin.numeros).toEqual([{ id: cobranca.id, rotulo: "Cobrança", saude: "desconectado" }]);

    const adm = await opcoesFiltroInbox({ papeis: [Papel.ADMINISTRADOR] });
    expect(adm.numeros.map((n) => n.id).sort()).toEqual([cobranca.id, vendas.id, secretaria.id].sort());

    expect(await opcoesFiltroInbox({ papeis: [Papel.ALUNO] })).toEqual({ setores: [], numeros: [] });
  });
});

it("opções públicas incluem saúde atual sem telefone, sessão, driver ou referência de provedor", async () => {
  const conectado = await numero("Ativo", "COBRANCA");
  const instavel = await numero("Instável", "COBRANCA");
  const inativo = await numero("Inativo", "COBRANCA");
  await prisma.numeroWhatsApp.update({ where: { id: conectado.id }, data: { driver: DriverWhatsApp.MOTOR, sessao: "CONECTADO" } });
  await prisma.numeroWhatsApp.update({ where: { id: instavel.id }, data: { driver: DriverWhatsApp.MOTOR, sessao: "CAIU" } });
  await prisma.numeroWhatsApp.update({ where: { id: inativo.id }, data: { driver: DriverWhatsApp.META_CLOUD, sessao: "CONECTADO", ativo: false } });
  expect((await opcoesFiltroInbox({ papeis: [Papel.FINANCEIRO] })).numeros).toEqual([
    { id: conectado.id, rotulo: "Ativo", saude: "conectado" },
    { id: inativo.id, rotulo: "Inativo", saude: "desconectado" },
    { id: instavel.id, rotulo: "Instável", saude: "instavel" },
  ]);
});

const PAPEIS_GESTORES = [
  Papel.ADMINISTRADOR,
  Papel.GERENTE_COMERCIAL,
  Papel.FINANCEIRO,
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
] as const;

describe("vendedorSemWhatsAppConectado", () => {
  it("vendedor sem número, desconectado ou instável fica bloqueado; conectado não", () => {
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR], [])).toBe(true);
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR], [{ saude: "desconectado" }])).toBe(true);
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR], [{ saude: "instavel" }])).toBe(true);
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR], [{ saude: "desconectado" }, { saude: "conectado" }])).toBe(false);
  });

  it.each(PAPEIS_GESTORES)("perfil %s não é bloqueado mesmo sem conectados", (papel) => {
    expect(vendedorSemWhatsAppConectado([papel], [])).toBe(false);
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR, papel], [{ saude: "desconectado" }])).toBe(false);
  });
});

describe("opcoesFiltroInbox do vendedor", () => {
  it("devolve só números do próprio dono e não vaza cobrança nem outro setor", async () => {
    const joao = await criarUsuario([Papel.VENDEDOR], "João Silva");
    const outro = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
    await numero("Cobranças Mendes", "COBRANCA", ["COMERCIAL"], outro.id);
    await numero("Vendas Outro", "VENDAS", [], outro.id);
    const proprio = await numero("Vendas João", "VENDAS", [], joao.id);
    await prisma.numeroWhatsApp.update({ where: { id: proprio.id }, data: { sessao: "CONECTADO" } });

    const opcoes = await opcoesFiltroInbox({ id: joao.id, papeis: [Papel.VENDEDOR] });
    expect(opcoes.setores).toEqual(["COMERCIAL"]);
    expect(opcoes.numeros).toEqual([{ id: proprio.id, rotulo: "Vendas João", saude: "conectado" }]);
    expect(vendedorSemWhatsAppConectado(joao.papeis, opcoes.numeros)).toBe(false);
  });

  it("número próprio desconectado ou instável não libera e não traz linha alheia", async () => {
    const joao = await criarUsuario([Papel.VENDEDOR], "João Silva");
    const outro = await criarUsuario([Papel.FINANCEIRO], "Mendes");
    await numero("Cobranças Mendes", "COBRANCA", ["COMERCIAL"], outro.id);
    const caido = await numero("Linha caída", "VENDAS", [], joao.id);
    const instavel = await numero("Linha instável", "VENDAS", [], joao.id);
    await prisma.numeroWhatsApp.update({ where: { id: caido.id }, data: { sessao: "DESCONECTADO" } });
    await prisma.numeroWhatsApp.update({ where: { id: instavel.id }, data: { driver: DriverWhatsApp.MOTOR, sessao: "CAIU" } });

    const opcoes = await opcoesFiltroInbox({ id: joao.id, papeis: [Papel.VENDEDOR] });
    expect(opcoes.numeros.map((n) => n.rotulo).sort()).toEqual(["Linha caída", "Linha instável"]);
    expect(opcoes.numeros.map((n) => n.saude).sort()).toEqual(["desconectado", "instavel"]);
    expect(vendedorSemWhatsAppConectado(joao.papeis, opcoes.numeros)).toBe(true);
  });

  it("sem id não lista números de vendas nem de cobrança", async () => {
    await numero("Cobranças Mendes", "COBRANCA", ["COMERCIAL"]);
    await numero("Vendas Solta", "VENDAS");
    expect(await opcoesFiltroInbox({ papeis: [Papel.VENDEDOR] })).toEqual({ setores: ["COMERCIAL"], numeros: [] });
  });

  it("gerente comercial continua vendo o setor, inclusive cobrança marcada como comercial", async () => {
    const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
    const cobranca = await numero("Cobranças Mendes", "COBRANCA", ["COMERCIAL"]);
    const vendas = await numero("Vendas", "VENDAS");
    const opcoes = await opcoesFiltroInbox({ id: gerente.id, papeis: [Papel.GERENTE_COMERCIAL] });
    expect(opcoes.numeros.map((n) => n.id).sort()).toEqual([cobranca.id, vendas.id].sort());
    expect(vendedorSemWhatsAppConectado(gerente.papeis, opcoes.numeros)).toBe(false);
  });
});
