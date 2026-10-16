import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { criarTag, atribuirTag, removerTag, CLASSES_COR_TAG } from "./tags";

function logadoComo(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let tagId: string;
let pessoaDaCarteira: string;
let pessoaDeOutraCarteira: string;

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  const tag = await prisma.tag.create({ data: { nome: "Quente", cor: "PERIGO" } });
  tagId = tag.id;
  const minha = await prisma.pessoa.create({ data: { nome: "Minha" } });
  await prisma.oportunidade.create({ data: { nome: "Minha", vendedorDonoId: vendedor.id, pessoaId: minha.id } });
  pessoaDaCarteira = minha.id;
  const alheia = await prisma.pessoa.create({ data: { nome: "Alheia" } });
  await prisma.oportunidade.create({ data: { nome: "Alheia", vendedorDonoId: outro.id, pessoaId: alheia.id } });
  pessoaDeOutraCarteira = alheia.id;
});

describe("criarTag", () => {
  it("vendedor não cria tag; gerente cria com Evento", async () => {
    logadoComo(vendedor.id);
    expect(await criarTag({ nome: "Feira", cor: "INFO" })).toEqual({ ok: false, erro: "Você não tem acesso a esta função do CRM." });
    logadoComo(gerente.id);
    const r = await criarTag({ nome: "Feira", cor: "INFO" });
    if (!r.ok || !r.dado) throw new Error("criarTag falhou");
    expect((await eventosDo("Tag", r.dado.id)).map((e) => e.tipo)).toEqual(["TagCriada"]);
  });

  it("nome duplicado e nome vazio são recusados", async () => {
    logadoComo(gerente.id);
    expect((await criarTag({ nome: "Quente", cor: "INFO" })).ok).toBe(false);
    expect((await criarTag({ nome: "  ", cor: "INFO" })).ok).toBe(false);
    expect(await prisma.tag.count()).toBe(1);
  });

  it("toda cor tem classes do mapa do Tailwind, sem hex", () => {
    for (const classes of Object.values(CLASSES_COR_TAG)) expect(classes).not.toMatch(/#|\[/);
    expect(Object.keys(CLASSES_COR_TAG)).toHaveLength(7);
  });
});

describe("atribuirTag e removerTag", () => {
  it("atribuir exige pessoa no escopo e é idempotente", async () => {
    logadoComo(vendedor.id);
    expect((await atribuirTag({ tagId, pessoaId: pessoaDeOutraCarteira })).ok).toBe(false);
    expect(await prisma.pessoaTag.count()).toBe(0);
    await atribuirTag({ tagId, pessoaId: pessoaDaCarteira });
    await atribuirTag({ tagId, pessoaId: pessoaDaCarteira });
    expect(await prisma.pessoaTag.count({ where: { pessoaId: pessoaDaCarteira } })).toBe(1);
    expect((await eventosDo("Pessoa", pessoaDaCarteira)).filter((e) => e.tipo === "TagAtribuida")).toHaveLength(1);
  });

  it("remover é idempotente e grava TagRemovida uma vez", async () => {
    logadoComo(vendedor.id);
    await atribuirTag({ tagId, pessoaId: pessoaDaCarteira });
    expect((await removerTag({ tagId, pessoaId: pessoaDeOutraCarteira })).ok).toBe(false);
    expect((await removerTag({ tagId, pessoaId: pessoaDaCarteira })).ok).toBe(true);
    expect((await removerTag({ tagId, pessoaId: pessoaDaCarteira })).ok).toBe(true);
    expect(await prisma.pessoaTag.count()).toBe(0);
    expect((await eventosDo("Pessoa", pessoaDaCarteira)).map((e) => e.tipo)).toEqual(["TagAtribuida", "TagRemovida"]);
  });

  it("exige pessoa ou empresa (nunca as duas) e tag ativa", async () => {
    logadoComo(vendedor.id);
    const empresa = await prisma.empresa.create({ data: { nome: "Acme" } });
    expect((await atribuirTag({ tagId })).ok).toBe(false);
    expect((await atribuirTag({ tagId, pessoaId: pessoaDaCarteira, empresaId: empresa.id })).ok).toBe(false);
    await prisma.tag.update({ where: { id: tagId }, data: { ativo: false } });
    expect((await atribuirTag({ tagId, pessoaId: pessoaDaCarteira })).ok).toBe(false);
  });

  it("empresa: só com oportunidade no escopo; grava Evento na Empresa", async () => {
    const acme = await prisma.empresa.create({ data: { nome: "Acme" } });
    const fora = await prisma.empresa.create({ data: { nome: "Fora" } });
    await prisma.oportunidade.create({ data: { nome: "B2B", vendedorDonoId: vendedor.id, empresaId: acme.id } });
    await prisma.oportunidade.create({ data: { nome: "B2B fora", vendedorDonoId: outro.id, empresaId: fora.id } });
    logadoComo(vendedor.id);
    expect((await atribuirTag({ tagId, empresaId: fora.id })).ok).toBe(false);
    expect((await atribuirTag({ tagId, empresaId: acme.id })).ok).toBe(true);
    expect((await atribuirTag({ tagId, empresaId: acme.id })).ok).toBe(true);
    expect(await prisma.empresaTag.count()).toBe(1);
    expect((await eventosDo("Empresa", acme.id)).map((e) => e.tipo)).toEqual(["TagAtribuida"]);
    expect((await removerTag({ tagId, empresaId: acme.id })).ok).toBe(true);
    expect(await prisma.empresaTag.count()).toBe(0);
  });

  it("papel sem contatos.editar (secretaria) não atribui", async () => {
    const sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Sec");
    logadoComo(sec.id);
    expect(await atribuirTag({ tagId, pessoaId: pessoaDaCarteira })).toEqual({ ok: false, erro: "Você não tem acesso a esta função do CRM." });
  });
});

describe("ValorCampoPersonalizado", () => {
  it("o CHECK exige exatamente um dono", async () => {
    const campo = await prisma.campoPersonalizado.create({ data: { nome: "Nível", tipo: "TEXTO", alvo: "PESSOA" } });
    await expect(prisma.valorCampoPersonalizado.create({ data: { campoId: campo.id, valor: "A1" } })).rejects.toThrow();
    const empresa = await prisma.empresa.create({ data: { nome: "Acme" } });
    await expect(
      prisma.valorCampoPersonalizado.create({ data: { campoId: campo.id, pessoaId: pessoaDaCarteira, empresaId: empresa.id, valor: "A1" } }),
    ).rejects.toThrow();
    await prisma.valorCampoPersonalizado.create({ data: { campoId: campo.id, pessoaId: pessoaDaCarteira, valor: "A1" } });
  });
});
