import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Papel, DriverWhatsApp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { opcoesFiltroInbox } from "./opcoes-filtro";

let seq = 0;
beforeEach(async () => { await truncarBanco(); });
afterAll(() => prisma.$disconnect());

async function numero(rotulo: string, finalidade: "VENDAS" | "COBRANCA", setores: ("COMERCIAL" | "FINANCEIRO" | "SECRETARIA" | "PEDAGOGICO")[] = []) {
  seq += 1;
  return prisma.numeroWhatsApp.create({ data: {
    telefoneE164: `+55118${String(seq).padStart(8, "0")}`, rotulo, driver: DriverWhatsApp.BAILEYS, finalidade, providerRef: `ref-of-${seq}`,
    setores: { create: setores.map((s) => ({ finalidade: s })) },
  } });
}

describe("opções do PainelFiltros", () => {
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
