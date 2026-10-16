import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, criarAlunoMinimo, eventosDo } from "@/test/integracao";
import { mesclarPessoas, sugerirDuplicados } from "./duplicados";

const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });

let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let a: string;
let b: string;
let pessoaAluno: string;
let pessoaResponsavel: string;

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  a = (await prisma.pessoa.create({ data: { nome: "Beatriz Lima", email: "a@x.com", cidade: "Recife" } })).id;
  b = (await prisma.pessoa.create({ data: { nome: "beatriz  lima", email: "b@x.com", cidade: "Olinda" } })).id;
  pessoaAluno = (await prisma.pessoa.create({ data: { nome: "Aluno" } })).id;
  pessoaResponsavel = (await prisma.pessoa.create({ data: { nome: "Resp" } })).id;
  await criarAlunoMinimo({ pessoaId: pessoaAluno });
  await prisma.responsavel.create({ data: { nome: "Resp", pessoaId: pessoaResponsavel } });
});

describe("mesclarPessoas", () => {
  it("bloqueia mescla entre aluno e responsável", async () => {
    logadoComo(gerente.id);
    expect(await mesclarPessoas({ principalId: pessoaResponsavel, secundariaId: pessoaAluno, escolhas: {} }))
      .toEqual({ ok: false, erro: "Estas pessoas têm cadastro acadêmico. A Secretaria decide se são a mesma pessoa." });
    expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: pessoaAluno } })).mescladaEmId).toBeNull();
  });

  it("vendedor não tem contatos.mesclar", async () => {
    logadoComo(vendedor.id);
    expect((await mesclarPessoas({ principalId: a, secundariaId: b, escolhas: {} })).ok).toBe(false);
  });

  it("mescla move vínculos, une tags, mantém lápide e o opt-out mais restritivo", async () => {
    const op = await prisma.oportunidade.create({ data: { nome: "B", pessoaId: b } });
    await prisma.participanteOportunidade.create({ data: { oportunidadeId: op.id, pessoaId: b, papel: "DECISOR" } });
    const t1 = await prisma.tag.create({ data: { nome: "t1", cor: "NEUTRA" } });
    const t2 = await prisma.tag.create({ data: { nome: "t2", cor: "NEUTRA" } });
    await prisma.pessoaTag.createMany({ data: [{ pessoaId: a, tagId: t1.id }, { pessoaId: b, tagId: t1.id }, { pessoaId: b, tagId: t2.id }] });
    await prisma.contatoWhatsApp.createMany({
      data: [
        { telefoneE164: "+5511900000001", pessoaId: a },
        { telefoneE164: "+5511900000002", pessoaId: b, optOutEm: new Date() },
      ],
    });
    logadoComo(gerente.id);
    expect((await mesclarPessoas({ principalId: a, secundariaId: b, escolhas: { email: "secundaria" } })).ok).toBe(true);
    expect(await prisma.oportunidade.count({ where: { pessoaId: b } })).toBe(0);
    expect(await prisma.oportunidade.count({ where: { pessoaId: a } })).toBe(1);
    expect(await prisma.participanteOportunidade.count({ where: { pessoaId: a } })).toBe(1);
    expect(await prisma.contatoWhatsApp.count({ where: { pessoaId: a, optOutEm: { not: null } } })).toBe(1);
    expect(await prisma.contatoWhatsApp.count({ where: { pessoaId: a } })).toBe(2);
    expect(await prisma.pessoaTag.count({ where: { pessoaId: a } })).toBe(2);
    const pa = await prisma.pessoa.findUniqueOrThrow({ where: { id: a } });
    expect(pa).toMatchObject({ email: "b@x.com", cidade: "Recife" });
    expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: b } })).mescladaEmId).toBe(a);
    expect((await eventosDo("Pessoa", a)).at(-1)!.tipo).toBe("PessoasMescladas");
    expect((await eventosDo("Pessoa", b)).at(-1)!.tipo).toBe("PessoasMescladas");
    expect(JSON.stringify((await eventosDo("Pessoa", a)).at(-1)!.payload)).not.toContain("@");
  });

  it("move o cadastro acadêmico quando só a secundária o tem e não remescla lápide", async () => {
    logadoComo(gerente.id);
    expect((await mesclarPessoas({ principalId: a, secundariaId: pessoaAluno, escolhas: {} })).ok).toBe(true);
    expect((await prisma.aluno.findFirstOrThrow({ where: { pessoaId: a } })).pessoaId).toBe(a);
    expect((await mesclarPessoas({ principalId: pessoaResponsavel, secundariaId: pessoaAluno, escolhas: {} })).ok).toBe(false);
  });

  it("campo personalizado: vale o da principal quando não é nulo", async () => {
    const campo = await prisma.campoPersonalizado.create({ data: { nome: "Curso", tipo: "TEXTO", alvo: "PESSOA" } });
    await prisma.valorCampoPersonalizado.createMany({
      data: [{ campoId: campo.id, pessoaId: a, valor: "A" }, { campoId: campo.id, pessoaId: b, valor: "B" }],
    });
    logadoComo(gerente.id);
    await mesclarPessoas({ principalId: a, secundariaId: b, escolhas: {} });
    expect((await prisma.valorCampoPersonalizado.findFirstOrThrow({ where: { pessoaId: a, campoId: campo.id } })).valor).toBe("A");
  });
});

describe("sugerirDuplicados", () => {
  it("sugere o par por nome+telefone e esconde lápides", async () => {
    await prisma.contatoWhatsApp.createMany({
      data: [{ telefoneE164: "+5511900000001", pessoaId: a }],
    });
    await prisma.oportunidade.createMany({ data: [{ nome: "A", pessoaId: a }, { nome: "B", pessoaId: b }] });
    const sessao = { id: gerente.id, nome: "G", papeis: [Papel.GERENTE_COMERCIAL] };
    const r = await sugerirDuplicados(sessao);
    expect(r).toHaveLength(0); // só nome (40): abaixo de 60
    await prisma.pessoa.update({ where: { id: b }, data: { email: "a@x.com" } });
    const r2 = await sugerirDuplicados(sessao);
    expect(r2).toEqual([{ a: expect.any(String), b: expect.any(String), pontos: 120, motivos: ["email", "nome"] }]);
    logadoComo(gerente.id);
    await mesclarPessoas({ principalId: a, secundariaId: b, escolhas: {} });
    expect(await sugerirDuplicados(sessao)).toHaveLength(0);
  });
});
