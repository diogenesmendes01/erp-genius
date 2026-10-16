import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { salvarFiltro, arquivarFiltro, listarFiltros } from "./filtros-salvos";

function logadoComo(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}
function sessaoDe(u: Awaited<ReturnType<typeof criarUsuario>>) {
  return { id: u.id, nome: u.nome, papeis: u.papeis };
}

function idDe(r: Awaited<ReturnType<typeof salvarFiltro>>): string {
  if (!r.ok || !r.dado) throw new Error("salvarFiltro falhou");
  return r.dado.id;
}

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let admin: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
});

describe("salvarFiltro", () => {
  it("guarda só chaves conhecidas da tela e exige nome", async () => {
    logadoComo(vendedor.id);
    expect(await salvarFiltro({ tela: "FUNIL", nome: " ", filtros: {} })).toEqual({ ok: false, erro: "Dê um nome à visualização." });
    const r = await salvarFiltro({ tela: "FUNIL", nome: "Quentes", filtros: { temperatura: "QUENTE", hack: "x" } });
    expect((await prisma.filtroSalvo.findUniqueOrThrow({ where: { id: idDe(r) } })).filtros).toEqual({ temperatura: "QUENTE" });
    expect((await eventosDo("FiltroSalvo", idDe(r))).map((e) => e.tipo)).toEqual(["FiltroSalvoCriado"]);
  });

  it("vendedor não compartilha; gerente compartilha com a equipe", async () => {
    logadoComo(vendedor.id);
    expect((await salvarFiltro({ tela: "FUNIL", nome: "X", filtros: {}, compartilhado: true })).ok).toBe(false);
    logadoComo(gerente.id);
    await salvarFiltro({ tela: "FUNIL", nome: "Equipe", filtros: {}, compartilhado: true });
    expect((await listarFiltros(sessaoDe(vendedor), "FUNIL")).map((f) => f.nome)).toContain("Equipe");
    expect((await listarFiltros(sessaoDe(outro), "FUNIL")).map((f) => f.nome)).not.toContain("Equipe");
  });

  it("o compartilhado do ADMIN aparece para todos", async () => {
    logadoComo(admin.id);
    await salvarFiltro({ tela: "CONTATOS", nome: "Geral", filtros: {}, compartilhado: true });
    expect((await listarFiltros(sessaoDe(outro), "CONTATOS")).map((f) => f.nome)).toEqual(["Geral"]);
  });

  it("nome repetido na mesma tela é recusado; filtro pessoal não vaza", async () => {
    logadoComo(vendedor.id);
    await salvarFiltro({ tela: "FUNIL", nome: "Meu", filtros: {} });
    expect((await salvarFiltro({ tela: "FUNIL", nome: "Meu", filtros: {} })).ok).toBe(false);
    const lista = await listarFiltros(sessaoDe(vendedor), "FUNIL");
    expect(lista).toEqual([expect.objectContaining({ nome: "Meu", meu: true, compartilhado: false })]);
    expect(await listarFiltros(sessaoDe(outro), "FUNIL")).toEqual([]);
  });
});

describe("arquivarFiltro", () => {
  it("só o autor arquiva; some da lista e grava Evento", async () => {
    logadoComo(vendedor.id);
    const r = await salvarFiltro({ tela: "TAREFAS", nome: "Hoje", filtros: {} });
    logadoComo(outro.id);
    expect((await arquivarFiltro(idDe(r))).ok).toBe(false);
    logadoComo(vendedor.id);
    expect((await arquivarFiltro(idDe(r))).ok).toBe(true);
    expect(await listarFiltros(sessaoDe(vendedor), "TAREFAS")).toEqual([]);
    expect((await eventosDo("FiltroSalvo", idDe(r))).map((e) => e.tipo)).toEqual(["FiltroSalvoCriado", "FiltroSalvoArquivado"]);
  });
});
