import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

vi.mock("@/lib/auth", () => ({ auth: () => Promise.resolve(null) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, criarAlunoMinimo } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared";
import { listarContatos, lerFiltrosContatos } from "./contatos";

function sessaoDe(u: { id: string; nome: string; papeis: Papel[] }): UsuarioSessao {
  return { id: u.id, nome: u.nome, papeis: u.papeis };
}

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let professor: Awaited<ReturnType<typeof criarUsuario>>;
let financeiro: Awaited<ReturnType<typeof criarUsuario>>;
let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let admin: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
  professor = await criarUsuario([Papel.PROFESSOR], "Professor");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");

  const ana = await prisma.pessoa.create({ data: { nome: "Ana (carteira)" } });
  await prisma.oportunidade.create({ data: { nome: "Ana", vendedorDonoId: vendedor.id, pessoaId: ana.id } });
  const alheia = await prisma.pessoa.create({ data: { nome: "Alheia" } });
  await prisma.oportunidade.create({ data: { nome: "Alheia", vendedorDonoId: outro.id, pessoaId: alheia.id } });
  const bia = await prisma.pessoa.create({ data: { nome: "Bia (aluna)" } });
  await criarAlunoMinimo({ pessoaId: bia.id });
  const carla = await prisma.pessoa.create({ data: { nome: "Carla (responsável)" } });
  await prisma.responsavel.create({ data: { nome: "Carla", pessoaId: carla.id } });
  await prisma.pessoa.create({ data: { nome: "Mesclada", mescladaEmId: ana.id } });
});

describe("listarContatos", () => {
  it("vendedor vê só pessoas com oportunidade na carteira", async () => {
    expect((await listarContatos(sessaoDe(vendedor), lerFiltrosContatos({}))).itens.map((i) => i.nome)).toEqual(["Ana (carteira)"]);
  });

  it("secretaria vê alunos e responsáveis, sem dados de oportunidade", async () => {
    const r = await listarContatos(sessaoDe(secretaria), lerFiltrosContatos({}));
    expect(r.itens.map((i) => i.nome).sort()).toEqual(["Bia (aluna)", "Carla (responsável)"]);
    expect(r.itens.every((i) => i.oportunidade === null)).toBe(true);
  });

  it("professor e financeiro não acessam; lápide nunca aparece", async () => {
    expect((await listarContatos(sessaoDe(professor), lerFiltrosContatos({}))).total).toBe(0);
    expect((await listarContatos(sessaoDe(financeiro), lerFiltrosContatos({}))).total).toBe(0);
    expect((await listarContatos(sessaoDe(admin), lerFiltrosContatos({}))).itens.map((i) => i.nome)).not.toContain("Mesclada");
  });

  it("linha traz oportunidade aberta, tags, telefone, opt-out e última interação", async () => {
    const ana = await prisma.pessoa.findFirstOrThrow({ where: { nome: "Ana (carteira)" } });
    const tag = await prisma.tag.create({ data: { nome: "VIP", cor: "MARCA" } });
    await prisma.pessoaTag.create({ data: { pessoaId: ana.id, tagId: tag.id } });
    await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611112222", pessoaId: ana.id, optOutEm: new Date() } });
    const op = await prisma.oportunidade.findFirstOrThrow({ where: { pessoaId: ana.id } });
    await prisma.evento.create({ data: { tipo: "X", agregadoTipo: "Pessoa", agregadoId: ana.id } });
    const depois = await prisma.evento.create({ data: { tipo: "Y", agregadoTipo: "Lead", agregadoId: op.id } });
    const [l] = (await listarContatos(sessaoDe(vendedor), lerFiltrosContatos({}))).itens;
    expect(l).toMatchObject({ tipo: "pessoa", telefone: "+50611112222", optOut: true, tags: [{ nome: "VIP" }] });
    expect(l.oportunidade).toMatchObject({ id: op.id, etapa: "NOVO", dono: "Vendedor" });
    expect(l.ultimaInteracaoEm).toEqual(depois.criadoEm);
  });

  it("filtros de tipo e busca, empresas e paginação de 50", async () => {
    await prisma.empresa.create({ data: { nome: "Acme Ltda" } });
    const todos = await listarContatos(sessaoDe(admin), lerFiltrosContatos({}));
    expect(todos.itens.at(-1)).toMatchObject({ tipo: "empresa", nome: "Acme Ltda" });
    expect((await listarContatos(sessaoDe(admin), lerFiltrosContatos({ tipo: "empresas" }))).total).toBe(1);
    expect((await listarContatos(sessaoDe(admin), lerFiltrosContatos({ busca: "acme" }))).itens.map((i) => i.nome)).toEqual(["Acme Ltda"]);
    await prisma.pessoa.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ nome: `Massa ${String(i).padStart(2, "0")}` })) });
    const p1 = await listarContatos(sessaoDe(admin), lerFiltrosContatos({}));
    const p2 = await listarContatos(sessaoDe(admin), lerFiltrosContatos({ pagina: "2" }));
    expect(p1.itens).toHaveLength(50);
    expect(p1.possuiMais).toBe(true);
    expect(p2.possuiMais).toBe(false);
    expect(p1.total).toBe(p1.itens.length + p2.itens.length);
    expect(new Set([...p1.itens, ...p2.itens].map((i) => i.id)).size).toBe(p1.total);
  });
});
