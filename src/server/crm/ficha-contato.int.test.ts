import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, criarAlunoMinimo, eventosDo } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { editarPessoa, obterContato, registrarNotaPessoa, registrarOptOut } from "./contatos";
import { historicoPessoa } from "./historico";

const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });
const sessaoDe = (u: { id: string; nome: string; papeis: Papel[] }): UsuarioSessao => ({ id: u.id, nome: u.nome, papeis: u.papeis });

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let p: string;
let pessoaAluna: string;
let op: string;

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro");
  secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  p = (await prisma.pessoa.create({ data: { nome: "Ana" } })).id;
  op = (await prisma.oportunidade.create({ data: { nome: "Ana", vendedorDonoId: vendedor.id, pessoaId: p } })).id;
  await prisma.contatoWhatsApp.createMany({
    data: [
      { telefoneE164: "+5511900000001", pessoaId: p },
      { telefoneE164: "+5511900000002", pessoaId: p },
    ],
  });
  await prisma.evento.create({ data: { tipo: "LeadCriado", agregadoTipo: "Lead", agregadoId: op, autorId: vendedor.id, payload: {} } });
  pessoaAluna = (await prisma.pessoa.create({ data: { nome: "Aluno Fulano" } })).id;
  await criarAlunoMinimo({ pessoaId: pessoaAluna });
  await prisma.oportunidade.create({ data: { nome: "Aluno Fulano", vendedorDonoId: vendedor.id, pessoaId: pessoaAluna } });
});

describe("editarPessoa", () => {
  it("edição grava PessoaEditada só com campos mudados", async () => {
    logadoComo(vendedor.id);
    expect((await editarPessoa(p, { cidade: "Recife", nome: "Ana" })).ok).toBe(true);
    expect((await eventosDo("Pessoa", p)).at(-1)).toMatchObject({
      tipo: "PessoaEditada",
      payload: { cidade: { de: null, para: "Recife" } },
    });
    expect((await eventosDo("Pessoa", p)).at(-1)!.payload).not.toHaveProperty("nome");
  });

  it("sem mudança não grava evento", async () => {
    logadoComo(vendedor.id);
    await editarPessoa(p, { nome: "Ana" });
    expect(await eventosDo("Pessoa", p)).toHaveLength(0);
  });

  it("e-mail não vai cru para o payload", async () => {
    logadoComo(vendedor.id);
    await editarPessoa(p, { email: "Ana@Exemplo.com" });
    expect((await prisma.pessoa.findUnique({ where: { id: p } }))!.email).toBe("ana@exemplo.com");
    expect(JSON.stringify((await eventosDo("Pessoa", p)).at(-1)!.payload)).not.toContain("exemplo");
  });

  it("comercial não altera nome/e-mail de pessoa ligada a aluno (fonte: Secretaria)", async () => {
    logadoComo(vendedor.id);
    expect(await editarPessoa(pessoaAluna, { nome: "Outro" })).toEqual({
      ok: false,
      erro: "Nome e e-mail de aluno são alterados pela Secretaria.",
    });
    expect((await editarPessoa(pessoaAluna, { cidade: "Olinda" })).ok).toBe(true);
  });

  it("fora do escopo é recusado", async () => {
    logadoComo(outro.id);
    expect((await editarPessoa(p, { cidade: "X" })).ok).toBe(false);
    logadoComo(secretaria.id);
    expect((await editarPessoa(pessoaAluna, { cidade: "X" })).ok).toBe(false);
  });

  it("só liga a pessoa a empresa no escopo do autor (R1 do PR #211, C2)", async () => {
    const alheia = (await prisma.empresa.create({ data: { nome: "Alheia", contatoTelefone: "+5511911111111" } })).id;
    await prisma.oportunidade.create({ data: { nome: "Alheia", vendedorDonoId: outro.id, empresaId: alheia } });
    const minha = (await prisma.empresa.create({ data: { nome: "Minha" } })).id;
    await prisma.oportunidade.create({ data: { nome: "Minha", vendedorDonoId: vendedor.id, empresaId: minha } });

    logadoComo(vendedor.id);
    expect(await editarPessoa(p, { empresaId: alheia })).toEqual({ ok: false, erro: "Empresa não encontrada." });
    expect((await prisma.pessoa.findUnique({ where: { id: p } }))!.empresaId).toBeNull();
    expect(await eventosDo("Pessoa", p)).toHaveLength(0);

    expect((await editarPessoa(p, { empresaId: minha })).ok).toBe(true);
    expect((await prisma.pessoa.findUnique({ where: { id: p } }))!.empresaId).toBe(minha);
  });
});

describe("nota e opt-out", () => {
  it("nota grava NotaInterna na Pessoa, limitada a 2.000 caracteres", async () => {
    logadoComo(vendedor.id);
    expect((await registrarNotaPessoa(p, "Ligar amanhã")).ok).toBe(true);
    expect((await eventosDo("Pessoa", p)).at(-1)).toMatchObject({ tipo: "NotaInterna", payload: { texto: "Ligar amanhã" } });
    expect((await registrarNotaPessoa(p, "x".repeat(2001))).ok).toBe(false);
    expect((await registrarNotaPessoa(p, "   ")).ok).toBe(false);
  });

  it("opt-out marca todos os telefones e não tem desfazer", async () => {
    logadoComo(vendedor.id);
    expect((await registrarOptOut(p, "Pediu para não receber mensagens")).ok).toBe(true);
    expect(await prisma.contatoWhatsApp.count({ where: { pessoaId: p, optOutEm: null } })).toBe(0);
    expect((await eventosDo("Pessoa", p)).at(-1)).toMatchObject({
      tipo: "OptOutRegistrado",
      payload: { motivo: "Pediu para não receber mensagens" },
    });
    expect((await registrarOptOut(p, "de novo")).ok).toBe(false);
    expect((await registrarOptOut(p, " ")).ok).toBe(false);
  });
});

describe("obterContato e historicoPessoa", () => {
  it("obterContato respeita o escopo", async () => {
    expect(await obterContato(p, sessaoDe(vendedor))).toMatchObject({ id: p, nome: "Ana", optOut: false });
    expect(await obterContato(p, sessaoDe(outro))).toBeNull();
  });

  it("histórico une pessoa e oportunidades, sem payload cru", async () => {
    logadoComo(vendedor.id);
    await registrarNotaPessoa(p, "segredo-da-nota");
    await registrarOptOut(p, "Pediu para não receber mensagens");
    const h = (await historicoPessoa(p, sessaoDe(vendedor)))!;
    expect(h.map((i) => i.rotulo)).toEqual(expect.arrayContaining(["Nota interna", "Oportunidade criada", "Opt-out registrado"]));
    expect(JSON.stringify(h)).not.toContain("Pediu para não");
    expect(await historicoPessoa(p, sessaoDe(outro))).toBeNull();
  });

  it("filtros notas/etapas/alteracoes", async () => {
    logadoComo(vendedor.id);
    await registrarNotaPessoa(p, "n");
    await editarPessoa(p, { cidade: "Recife" });
    await prisma.evento.create({ data: { tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId: op, payload: { de: "NOVO", para: "EM_ATENDIMENTO" } } });
    const u = sessaoDe(vendedor);
    expect((await historicoPessoa(p, u, "notas"))!.map((i) => i.tipo)).toEqual(["NotaInterna"]);
    expect((await historicoPessoa(p, u, "etapas"))!.map((i) => i.tipo)).toEqual(["EtapaAlterada"]);
    expect((await historicoPessoa(p, u, "alteracoes"))!.map((i) => i.tipo)).toEqual(["PessoaEditada"]);
  });

  it("eventos de Aluno só para Secretaria e Admin", async () => {
    const alunoId = (await prisma.aluno.findFirst({ where: { pessoaId: pessoaAluna } }))!.id;
    await prisma.evento.create({ data: { tipo: "AlunoEditado", agregadoTipo: "Aluno", agregadoId: alunoId, payload: {} } });
    const veV = (await historicoPessoa(pessoaAluna, sessaoDe(vendedor)))!;
    expect(veV.some((i) => i.tipo === "AlunoEditado")).toBe(false);
    const veS = (await historicoPessoa(pessoaAluna, sessaoDe(secretaria)))!;
    expect(veS.some((i) => i.tipo === "AlunoEditado")).toBe(true);
  });

  it("oportunidade de outro vendedor da mesma pessoa não vaza", async () => {
    const op2 = (await prisma.oportunidade.create({ data: { nome: "Ana 2", vendedorDonoId: outro.id, pessoaId: p } })).id;
    await prisma.evento.create({ data: { tipo: "LeadCriado", agregadoTipo: "Lead", agregadoId: op2, payload: {} } });
    const h = (await historicoPessoa(p, sessaoDe(vendedor)))!;
    expect(h.filter((i) => i.tipo === "LeadCriado")).toHaveLength(1);
  });
});
