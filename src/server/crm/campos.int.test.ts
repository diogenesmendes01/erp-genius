import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { salvarCampoPersonalizado, definirValorCampo } from "./campos";

function logadoComo(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let pessoaDaCarteira: string;
let pessoaAlheia: string;
let empresaId: string;
let campoId: string;
let campoEmpresaId: string;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  const minha = await prisma.pessoa.create({ data: { nome: "Minha" } });
  await prisma.oportunidade.create({ data: { nome: "Minha", vendedorDonoId: vendedor.id, pessoaId: minha.id } });
  pessoaDaCarteira = minha.id;
  const alheia = await prisma.pessoa.create({ data: { nome: "Alheia" } });
  await prisma.oportunidade.create({ data: { nome: "Alheia", vendedorDonoId: outro.id, pessoaId: alheia.id } });
  pessoaAlheia = alheia.id;
  const empresa = await prisma.empresa.create({ data: { nome: "Acme" } });
  empresaId = empresa.id;
  await prisma.pessoa.update({ where: { id: minha.id }, data: { empresaId } });
  campoId = (await prisma.campoPersonalizado.create({ data: { nome: "Nível", tipo: "SELECAO", alvo: "PESSOA", opcoes: ["A1", "B2"] } })).id;
  campoEmpresaId = (await prisma.campoPersonalizado.create({ data: { nome: "Porte", tipo: "TEXTO", alvo: "EMPRESA" } })).id;
});

describe("salvarCampoPersonalizado", () => {
  it("só ADMINISTRADOR salva; cria com Evento", async () => {
    logadoComo(gerente.id);
    expect((await salvarCampoPersonalizado({ nome: "Idade", tipo: "NUMERO", alvo: "PESSOA" })).ok).toBe(false);
    logadoComo(admin.id);
    const r = await salvarCampoPersonalizado({ nome: "Idade", tipo: "NUMERO", alvo: "PESSOA", obrigatorio: true });
    if (!r.ok || !r.dado) throw new Error("salvar falhou");
    expect((await eventosDo("CampoPersonalizado", r.dado.id)).map((e) => e.tipo)).toEqual(["CampoPersonalizadoSalvo"]);
    expect(await prisma.campoPersonalizado.findUnique({ where: { id: r.dado.id } })).toMatchObject({ obrigatorio: true, opcoes: [] });
  });

  it("seleção sem opção é recusada; nome duplicado no mesmo alvo também", async () => {
    logadoComo(admin.id);
    expect(await salvarCampoPersonalizado({ nome: "Cor", tipo: "SELECAO", alvo: "PESSOA", opcoes: [" "] })).toEqual({
      ok: false,
      erro: "Adicione pelo menos uma opção.",
    });
    expect(await salvarCampoPersonalizado({ nome: "Nível", tipo: "TEXTO", alvo: "PESSOA" })).toEqual({
      ok: false,
      erro: "Já existe um campo com este nome.",
    });
  });

  it("trocar o tipo de campo com valores gravados é recusado", async () => {
    logadoComo(vendedor.id);
    await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "A1" });
    logadoComo(admin.id);
    expect(await salvarCampoPersonalizado({ id: campoId, nome: "Nível", tipo: "NUMERO", alvo: "PESSOA" })).toEqual({
      ok: false,
      erro: "Este campo já tem valores; crie um campo novo.",
    });
    expect((await salvarCampoPersonalizado({ id: campoId, nome: "Nível", tipo: "SELECAO", alvo: "PESSOA", opcoes: ["A1", "B2", "C3"] })).ok).toBe(true);
  });
});

describe("definirValorCampo", () => {
  it("valor grava CampoPersonalizadoAlterado com de/para", async () => {
    logadoComo(vendedor.id);
    await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "A1" });
    expect((await eventosDo("Pessoa", pessoaDaCarteira)).at(-1)).toMatchObject({
      tipo: "CampoPersonalizadoAlterado",
      payload: { campoId, de: null, para: "A1" },
    });
    await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "B2" });
    expect((await eventosDo("Pessoa", pessoaDaCarteira)).at(-1)).toMatchObject({ payload: { campoId, de: "A1", para: "B2" } });
    // mesmo valor: sem novo Evento
    await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "B2" });
    expect((await eventosDo("Pessoa", pessoaDaCarteira)).filter((e) => e.tipo === "CampoPersonalizadoAlterado")).toHaveLength(2);
    expect(await prisma.valorCampoPersonalizado.count({ where: { campoId } })).toBe(1);
  });

  it("valor inválido é recusado e nada é gravado", async () => {
    logadoComo(vendedor.id);
    expect(await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "C1" })).toEqual({ ok: false, erro: "Escolha uma das opções." });
    expect(await prisma.valorCampoPersonalizado.count()).toBe(0);
  });

  it("alvo precisa bater com o registro e exatamente um dono é informado", async () => {
    logadoComo(vendedor.id);
    expect((await definirValorCampo({ campoId, empresaId, valor: "A1" })).ok).toBe(false);
    expect((await definirValorCampo({ campoId: campoEmpresaId, pessoaId: pessoaDaCarteira, valor: "x" })).ok).toBe(false);
    expect((await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, empresaId, valor: "A1" })).ok).toBe(false);
    expect((await definirValorCampo({ campoId, valor: "A1" })).ok).toBe(false);
    expect((await definirValorCampo({ campoId: campoEmpresaId, empresaId, valor: "Grande" })).ok).toBe(true);
    expect((await eventosDo("Empresa", empresaId)).at(-1)).toMatchObject({ tipo: "CampoPersonalizadoAlterado", payload: { de: null, para: "Grande" } });
  });

  it("respeita o escopo: pessoa de outra carteira não é encontrada", async () => {
    logadoComo(vendedor.id);
    expect(await definirValorCampo({ campoId, pessoaId: pessoaAlheia, valor: "A1" })).toEqual({ ok: false, erro: "Pessoa não encontrada." });
  });

  it("limpar o valor guarda nulo (sem apagar) e grava Evento; obrigatório recusa limpar", async () => {
    logadoComo(vendedor.id);
    await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "A1" });
    await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "" });
    expect((await eventosDo("Pessoa", pessoaDaCarteira)).at(-1)).toMatchObject({ payload: { de: "A1", para: null } });
    expect(await prisma.valorCampoPersonalizado.count({ where: { campoId } })).toBe(1);
    await prisma.campoPersonalizado.update({ where: { id: campoId }, data: { obrigatorio: true } });
    expect(await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "" })).toEqual({ ok: false, erro: "Campo obrigatório." });
  });

  it("campo arquivado não recebe valor", async () => {
    await prisma.campoPersonalizado.update({ where: { id: campoId }, data: { arquivadoEm: new Date() } });
    logadoComo(vendedor.id);
    expect(await definirValorCampo({ campoId, pessoaId: pessoaDaCarteira, valor: "A1" })).toEqual({ ok: false, erro: "Este campo está arquivado." });
  });
});
