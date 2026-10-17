import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarLead } from "@/server/comercial/acoes";
import { truncarBanco, criarUsuario, criarAlunoMinimo, eventosDo } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared";
import { chaveLockPessoaTelefone, escopoPessoas, garantirPessoaTx, possiveisDuplicados } from "./pessoas";

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

  it("criações simultâneas do mesmo telefone novo resultam numa só Pessoa (advisory lock)", async () => {
    const telefone = "+50633332222";
    const resultados = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.$transaction((tx) => garantirPessoaTx(tx, { nome: `Corrida ${i}`, telefoneE164: telefone }, null)),
      ),
    );
    const ids = new Set(resultados.map((r) => r.pessoaId));
    expect(ids.size).toBe(1);
    expect(resultados.filter((r) => r.criada)).toHaveLength(1);
    expect(await prisma.pessoa.count()).toBe(1);
    const contato = await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { telefoneE164: telefone } });
    expect(contato.pessoaId).toBe([...ids][0]);
  });

  it("garantirPessoaTx espera o lock do telefone antes de buscar o contato", async () => {
    const telefone = "+50644443333";
    let liberar!: () => void;
    const segurando = new Promise<void>((r) => (liberar = r));
    let travado!: () => void;
    const lockPego = new Promise<void>((r) => (travado = r));
    const dono = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chaveLockPessoaTelefone(telefone)}, 0))`;
        travado();
        await segurando;
        // Grava a pessoa e o contato enquanto segura o lock: quem esperava tem de enxergá-los.
        const p = await tx.pessoa.create({ data: { nome: "Primeira" } });
        await tx.contatoWhatsApp.create({ data: { telefoneE164: telefone, pessoaId: p.id } });
        return p.id;
      },
      { timeout: 20_000 },
    );
    await lockPego;
    let terminou = false;
    const esperando = prisma
      .$transaction((tx) => garantirPessoaTx(tx, { nome: "Segunda", telefoneE164: telefone }, null), { timeout: 20_000 })
      .then((r) => {
        terminou = true;
        return r;
      });
    await new Promise((r) => setTimeout(r, 500));
    expect(terminou).toBe(false);
    liberar();
    const primeiraId = await dono;
    const segunda = await esperando;
    expect(segunda).toEqual({ pessoaId: primeiraId, criada: false });
    expect(await prisma.pessoa.count()).toBe(1);
  });

  it("PessoaCriada não leva telefone no payload", async () => {
    const r = await prisma.$transaction((tx) => garantirPessoaTx(tx, { nome: "Zé", telefoneE164: "+50655554444", email: "Ze@X.com" }, vendedor.id));
    const ev = await eventosDo("Pessoa", r.pessoaId);
    expect(JSON.stringify(ev[0].payload)).not.toContain("5555");
    expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: r.pessoaId } })).email).toBe("ze@x.com");
  });
});

describe("criarLead com pessoaId informado", () => {
  const base = { segmento: "ADULTO", temperatura: "MORNO", b2b: false } as const;
  it("aceita pessoa da própria carteira", async () => {
    const p = await pessoaComOportunidade("Minha", vendedor.id);
    logadoComo(vendedor.id);
    const r = await criarLead({ nome: "Minha 2", pessoaId: p.id, ...base });
    const op = await prisma.oportunidade.findUniqueOrThrow({ where: { id: idDe(r) } });
    expect(op.pessoaId).toBe(p.id);
  });
  it("recusa pessoa de outra carteira, aluno, inexistente e lápide sem criar oportunidade", async () => {
    const alheia = await pessoaComOportunidade("Alheia", outro.id);
    const aluna = await prisma.pessoa.create({ data: { nome: "Aluna" } });
    await criarAlunoMinimo({ pessoaId: aluna.id });
    const lapide = await prisma.pessoa.create({ data: { nome: "Lápide", mescladaEmId: alheia.id } });
    logadoComo(vendedor.id);
    const antes = await prisma.oportunidade.count();
    for (const pessoaId of [alheia.id, aluna.id, "inexistente-id", lapide.id]) {
      const r = await criarLead({ nome: "X", pessoaId, ...base });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toBe("Contato não encontrado.");
    }
    expect(await prisma.oportunidade.count()).toBe(antes);
  });
});

describe("criarLead com empresaId informado", () => {
  const base = { segmento: "ADULTO", temperatura: "MORNO", b2b: true } as const;
  it("aceita empresa ativa e liga a oportunidade a ela", async () => {
    const empresa = await prisma.empresa.create({ data: { nome: "Acme" } });
    logadoComo(vendedor.id);
    const r = await criarLead({ nome: "Contato Acme", empresaId: empresa.id, ...base });
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: idDe(r) } })).empresaId).toBe(empresa.id);
  });
  it("recusa empresa inexistente ou inativa com erro amigável, sem estourar a FK nem criar nada", async () => {
    const inativa = await prisma.empresa.create({ data: { nome: "Fechada", ativo: false } });
    logadoComo(vendedor.id);
    const antes = { oportunidades: await prisma.oportunidade.count(), pessoas: await prisma.pessoa.count() };
    for (const empresaId of ["empresa-inexistente", inativa.id]) {
      const r = await criarLead({ nome: "X", telefoneE164: "+50677776666", empresaId, ...base });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toBe("Empresa não encontrada.");
    }
    expect(await prisma.oportunidade.count()).toBe(antes.oportunidades);
    expect(await prisma.pessoa.count()).toBe(antes.pessoas);
    expect(await prisma.contatoWhatsApp.count({ where: { telefoneE164: "+50677776666" } })).toBe(0);
  });
});

describe("criarLead no modo Empresa (criarEmpresa) — Ruling do C2 da R1 do #196", () => {
  const base = { segmento: "ADULTO", temperatura: "MORNO", b2b: false } as const;
  it("cria a Empresa com o nome e o contato, liga empresaId e não cria Pessoa nem ContatoWhatsApp", async () => {
    logadoComo(vendedor.id);
    const r = await criarLead({ nome: "ACME Ltda", telefoneE164: "+50655554444", email: "compras@acme.example", origemCanal: "LINKEDIN", criarEmpresa: true, ...base });
    const op = await prisma.oportunidade.findUniqueOrThrow({ where: { id: idDe(r) } });
    expect(op.pessoaId).toBeNull();
    expect(op.b2b).toBe(true);
    const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: op.empresaId! } });
    expect(empresa).toEqual(expect.objectContaining({ nome: "ACME Ltda", contatoTelefone: "+50655554444", contatoEmail: "compras@acme.example", origemCanal: "LINKEDIN", ativo: true }));
    expect(empresa.codigo).toMatch(/^E-\d{6}$/);
    expect(await prisma.pessoa.count()).toBe(0);
    expect(await prisma.contatoWhatsApp.count()).toBe(0);
    expect((await eventosDo("Empresa", empresa.id)).map((e) => e.tipo)).toEqual(["EmpresaCriada"]);
    const [criado] = await eventosDo("Lead", op.id);
    expect(criado.payload).toEqual(expect.objectContaining({ pessoaId: null, empresaId: empresa.id, b2b: true }));
  });
  it("criarEmpresa com empresa ou contato existente é recusado sem criar nada", async () => {
    const existente = await prisma.empresa.create({ data: { nome: "Acme" } });
    const p = await pessoaComOportunidade("Minha", vendedor.id);
    logadoComo(vendedor.id);
    const antes = { empresas: await prisma.empresa.count(), oportunidades: await prisma.oportunidade.count() };
    for (const extra of [{ empresaId: existente.id }, { pessoaId: p.id }]) {
      const r = await criarLead({ nome: "Nova SA", criarEmpresa: true, ...extra, ...base });
      expect(r).toEqual({ ok: false, erro: "Oportunidade de empresa nova não leva empresa nem contato já existentes." });
    }
    expect(await prisma.empresa.count()).toBe(antes.empresas);
    expect(await prisma.oportunidade.count()).toBe(antes.oportunidades);
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
