import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarLead } from "@/server/comercial/acoes";
import { truncarBanco, criarUsuario, criarAlunoMinimo, eventosDo } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoPessoas, garantirPessoaTx, possiveisDuplicados } from "./pessoas";

function logadoComo(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}
function sessaoDe(u: { id: string; nome: string; papeis: Papel[] }): UsuarioSessao {
  return { id: u.id, nome: u.nome, papeis: u.papeis };
}

function idDe(r: { ok: boolean; dado?: { id: string } | undefined; erro?: string }): string {
  if (!r.ok || !r.dado) throw new Error(`criarLead falhou: ${r.erro}`);
  return r.dado.id;
}

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let professor: Awaited<ReturnType<typeof criarUsuario>>;
let secretaria: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
  professor = await criarUsuario([Papel.PROFESSOR], "Professor");
  secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
});

async function pessoaComOportunidade(nome: string, donoId: string, telefoneE164?: string) {
  const p = await prisma.pessoa.create({ data: { nome } });
  await prisma.oportunidade.create({ data: { nome, vendedorDonoId: donoId, pessoaId: p.id, telefoneE164 } });
  if (telefoneE164) await prisma.contatoWhatsApp.create({ data: { telefoneE164, pessoaId: p.id } });
  return p;
}

describe("escopoPessoas", () => {
  it("vendedor só pessoas com oportunidade na carteira; secretaria só alunos e responsáveis; professor nada", async () => {
    await pessoaComOportunidade("Minha", vendedor.id);
    await pessoaComOportunidade("Alheia", outro.id);
    const aluna = await prisma.pessoa.create({ data: { nome: "Aluna" } });
    await criarAlunoMinimo({ pessoaId: aluna.id });
    const resp = await prisma.pessoa.create({ data: { nome: "Resp" } });
    await prisma.responsavel.create({ data: { nome: "Resp", pessoaId: resp.id } });
    const lapide = await prisma.pessoa.create({ data: { nome: "Lápide", mescladaEmId: aluna.id } });

    expect(await prisma.pessoa.count({ where: await escopoPessoas(sessaoDe(vendedor)) })).toBe(1);
    const sec = await prisma.pessoa.findMany({ where: await escopoPessoas(sessaoDe(secretaria)) });
    expect(sec.map((p) => p.nome).sort()).toEqual(["Aluna", "Resp"]);
    expect(await prisma.pessoa.count({ where: await escopoPessoas(sessaoDe(professor)) })).toBe(0);
    const adm = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    const todas = await prisma.pessoa.findMany({ where: await escopoPessoas(sessaoDe(adm)) });
    expect(todas.map((p) => p.id)).not.toContain(lapide.id);
    expect(todas).toHaveLength(4);
  });

  it("gerente vê equipe, sem oportunidade e sem dono, mas não a carteira de fora", async () => {
    const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
    await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
    await pessoaComOportunidade("Equipe", vendedor.id);
    await pessoaComOportunidade("Fora", outro.id);
    await prisma.pessoa.create({ data: { nome: "Sem oportunidade" } });
    const semDono = await prisma.pessoa.create({ data: { nome: "Sem dono" } });
    await prisma.oportunidade.create({ data: { nome: "Sem dono", pessoaId: semDono.id } });
    const nomes = (await prisma.pessoa.findMany({ where: await escopoPessoas(sessaoDe(gerente)) })).map((p) => p.nome).sort();
    expect(nomes).toEqual(["Equipe", "Sem dono", "Sem oportunidade"]);
  });
});

describe("garantirPessoaTx e criarLead", () => {
  it("telefone de aluno existente reaproveita a mesma pessoa", async () => {
    const aluno = await criarAlunoMinimo({ telefoneE164: "+50688887777" });
    logadoComo(vendedor.id);
    const r = await criarLead({ nome: "Ana", telefoneE164: "+50688887777", segmento: "ADULTO", temperatura: "MORNO", b2b: false });
    const op = await prisma.oportunidade.findUniqueOrThrow({ where: { id: idDe(r) } });
    expect(op.pessoaId).toBe((await prisma.aluno.findUniqueOrThrow({ where: { id: aluno.id } })).pessoaId);
    expect(op.pessoaId).not.toBeNull();
    expect(await prisma.pessoa.count()).toBe(1);
    expect((await eventosDo("Pessoa", op.pessoaId!)).map((e) => e.tipo)).toEqual(["PessoaCriada"]);
    const criado = (await eventosDo("Lead", op.id)).find((e) => e.tipo === "LeadCriado");
    expect((criado!.payload as { pessoaId: string }).pessoaId).toBe(op.pessoaId);
  });

  it("telefone já em ContatoWhatsApp com pessoa reaproveita; sem telefone cria nova", async () => {
    const p = await prisma.pessoa.create({ data: { nome: "Existente" } });
    await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611112222", pessoaId: p.id } });
    logadoComo(vendedor.id);
    const r = await criarLead({ nome: "Outra", telefoneE164: "+50611112222", segmento: "ADULTO", temperatura: "MORNO", b2b: false });
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: idDe(r) } })).pessoaId).toBe(p.id);
    const r2 = await criarLead({ nome: "Sem fone", segmento: "ADULTO", temperatura: "MORNO", b2b: false });
    const op2 = await prisma.oportunidade.findUniqueOrThrow({ where: { id: idDe(r2) } });
    expect(op2.pessoaId).not.toBe(p.id);
    expect(op2.pessoaId).not.toBeNull();
  });

  it("telefone compartilhado por dois alunos cria pessoa nova e não liga a nenhum", async () => {
    const a1 = await criarAlunoMinimo({ telefoneE164: "+50699990000" });
    const a2 = await criarAlunoMinimo({ telefoneE164: "+50699990000" });
    const r = await prisma.$transaction((tx) => garantirPessoaTx(tx, { nome: "Pai", telefoneE164: "+50699990000" }, null));
    expect(r.criada).toBe(true);
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: a1.id } })).pessoaId).toBeNull();
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: a2.id } })).pessoaId).toBeNull();
    const contato = await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { telefoneE164: "+50699990000" } });
    expect(contato.pessoaId).toBe(r.pessoaId);
  });

  it("PessoaCriada não leva telefone no payload", async () => {
    const r = await prisma.$transaction((tx) => garantirPessoaTx(tx, { nome: "Zé", telefoneE164: "+50655554444", email: "Ze@X.com" }, vendedor.id));
    const ev = await eventosDo("Pessoa", r.pessoaId);
    expect(JSON.stringify(ev[0].payload)).not.toContain("5555");
    expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: r.pessoaId } })).email).toBe("ze@x.com");
  });
});

describe("possiveisDuplicados", () => {
  it("duplicado fora da carteira não revela o nome", async () => {
    await pessoaComOportunidade("Alheia", outro.id, "+50670001111");
    expect(await possiveisDuplicados({ telefoneE164: "+50670001111" }, sessaoDe(vendedor))).toEqual([
      { pessoaId: null, nome: null, motivo: "telefone" },
    ]);
  });

  it("dentro do escopo mostra nome; e-mail em minúsculas e nome sem acento; máximo 5", async () => {
    const p = await pessoaComOportunidade("José Álvaro", vendedor.id);
    await prisma.pessoa.update({ where: { id: p.id }, data: { email: "jose@x.com" } });
    expect(await possiveisDuplicados({ email: "JOSE@X.COM" }, sessaoDe(vendedor))).toEqual([
      { pessoaId: p.id, nome: "José Álvaro", motivo: "email" },
    ]);
    expect(await possiveisDuplicados({ nome: "jose alvaro" }, sessaoDe(vendedor))).toEqual([
      { pessoaId: p.id, nome: "José Álvaro", motivo: "nome" },
    ]);
    for (let i = 0; i < 6; i++) await pessoaComOportunidade("Maria Clone", vendedor.id);
    expect(await possiveisDuplicados({ nome: "Maria Clone" }, sessaoDe(vendedor))).toHaveLength(5);
  });
});
