import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, criarAlunoMinimo, eventosDo } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { registrarNotaPessoa } from "./contatos";
import { MSG_ALCADA_SECRETARIA_MESCLA, MSG_NOME_ALUNO, mesclarPessoas, previaMesclaPessoas, sugerirDuplicados } from "./duplicados";
import { historicoPessoa } from "./historico";

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

  // D14 (decisão do dono, 19/10/2026; #211 C4): repor Aluno/Responsavel.pessoaId pela mescla exige a alçada da
  // Secretaria (Secretaria Acadêmica ou Administrador), além de contatos.mesclar, e grava um evento no cadastro.
  it("move o cadastro acadêmico quando só a secundária o tem, com a alçada da Secretaria, e não remescla lápide", async () => {
    const gcSecretaria = await criarUsuario([Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA], "GC e Secretaria");
    logadoComo(gcSecretaria.id);
    expect((await mesclarPessoas({ principalId: a, secundariaId: pessoaAluno, escolhas: { nome: "secundaria", email: "secundaria" } })).ok).toBe(true);
    expect(await prisma.pessoa.findUniqueOrThrow({ where: { id: a } })).toMatchObject({ nome: "Aluno", email: null });
    const aluno = await prisma.aluno.findFirstOrThrow({ where: { pessoaId: a } });
    const ev = (await eventosDo("Aluno", aluno.id)).filter((e) => e.tipo === "CadastroAcademicoRepontado");
    expect(ev).toHaveLength(1);
    expect(ev[0].autorId).toBe(gcSecretaria.id);
    expect(ev[0].payload).toMatchObject({ pessoaIdAntes: pessoaAluno, pessoaIdDepois: a, via: "mescla" });
    expect((await mesclarPessoas({ principalId: pessoaResponsavel, secundariaId: pessoaAluno, escolhas: {} })).ok).toBe(false);
  });

  it("sem a alçada da Secretaria, o gerente comercial não move o cadastro acadêmico e nada muda", async () => {
    logadoComo(gerente.id);
    expect(await mesclarPessoas({ principalId: a, secundariaId: pessoaAluno, escolhas: { nome: "secundaria", email: "secundaria" } }))
      .toEqual({ ok: false, erro: MSG_ALCADA_SECRETARIA_MESCLA });
    expect(await mesclarPessoas({ principalId: a, secundariaId: pessoaResponsavel, escolhas: { nome: "secundaria" } }))
      .toEqual({ ok: false, erro: MSG_ALCADA_SECRETARIA_MESCLA });
    expect(await prisma.aluno.count({ where: { pessoaId: pessoaAluno } })).toBe(1);
    expect(await prisma.responsavel.count({ where: { pessoaId: pessoaResponsavel } })).toBe(1);
    expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: pessoaAluno } })).mescladaEmId).toBeNull();
    expect(await prisma.evento.count({ where: { tipo: { in: ["PessoasMescladas", "CadastroAcademicoRepontado"] } } })).toBe(0);
    // O cadastro acadêmico na principal não é movido: a mescla comum segue com o gerente.
    expect((await mesclarPessoas({ principalId: pessoaResponsavel, secundariaId: b, escolhas: {} })).ok).toBe(true);
  });

  it("Administrador tem a alçada da Secretaria e move o responsável, com evento no cadastro do responsável", async () => {
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    logadoComo(admin.id);
    expect((await mesclarPessoas({ principalId: a, secundariaId: pessoaResponsavel, escolhas: {} })).ok).toBe(true);
    const resp = await prisma.responsavel.findFirstOrThrow({ where: { pessoaId: a } });
    const ev = (await eventosDo("Responsavel", resp.id)).filter((e) => e.tipo === "CadastroAcademicoRepontado");
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toMatchObject({ pessoaIdAntes: pessoaResponsavel, pessoaIdDepois: a, via: "mescla" });
  });

  it("quem não é Administrador não muda nome nem e-mail de aluno pela mescla", async () => {
    await prisma.pessoa.update({ where: { id: pessoaAluno }, data: { email: "aluno@x.com" } });
    logadoComo(gerente.id);
    // Aluno na principal, nome da secundária escolhido.
    expect(await mesclarPessoas({ principalId: pessoaAluno, secundariaId: a, escolhas: { nome: "secundaria" } }))
      .toEqual({ ok: false, erro: MSG_NOME_ALUNO });
    // Aluno na secundária, nome comercial da principal mantido (com a alçada da Secretaria, que não é Administrador).
    logadoComo((await criarUsuario([Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA], "GC e Secretaria")).id);
    expect(await mesclarPessoas({ principalId: a, secundariaId: pessoaAluno, escolhas: { email: "secundaria" } }))
      .toEqual({ ok: false, erro: MSG_NOME_ALUNO });
    expect(await prisma.pessoa.findUniqueOrThrow({ where: { id: pessoaAluno } })).toMatchObject({ nome: "Aluno", email: "aluno@x.com", mescladaEmId: null });
    expect(await prisma.pessoa.findUniqueOrThrow({ where: { id: a } })).toMatchObject({ nome: "Beatriz Lima", mescladaEmId: null });
    expect(await prisma.aluno.count({ where: { pessoaId: pessoaAluno } })).toBe(1);

    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    logadoComo(admin.id);
    expect((await mesclarPessoas({ principalId: pessoaAluno, secundariaId: a, escolhas: { nome: "secundaria" } })).ok).toBe(true);
    expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: pessoaAluno } })).nome).toBe("Beatriz Lima");
  });

  it("notas e histórico da secundária (e das lápides dela) aparecem na principal", async () => {
    const c = (await prisma.pessoa.create({ data: { nome: "Beatriz L." } })).id;
    logadoComo(gerente.id);
    expect((await registrarNotaPessoa(c, "nota-da-c")).ok).toBe(true);
    expect((await registrarNotaPessoa(b, "nota-da-b")).ok).toBe(true);
    expect((await mesclarPessoas({ principalId: b, secundariaId: c, escolhas: {} })).ok).toBe(true);
    expect((await mesclarPessoas({ principalId: a, secundariaId: b, escolhas: {} })).ok).toBe(true);
    const sessao: UsuarioSessao = { id: gerente.id, nome: gerente.nome, papeis: gerente.papeis };
    const h = (await historicoPessoa(a, sessao))!;
    expect(h.filter((i) => i.tipo === "NotaInterna").map((i) => i.texto).sort()).toEqual(["nota-da-b", "nota-da-c"]);
    // Cada mescla aparece uma vez, não uma por agregado.
    expect(h.filter((i) => i.tipo === "PessoasMescladas").map((i) => i.rotulo)).toEqual(["Contatos mesclados", "Contatos mesclados"]);
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

describe("previaMesclaPessoas (D14)", () => {
  it("mostra o que muda sem gravar nada, inclusive o cadastro acadêmico e a alçada exigida", async () => {
    const op = await prisma.oportunidade.create({ data: { nome: "Op", pessoaId: pessoaAluno } });
    await prisma.participanteOportunidade.create({ data: { oportunidadeId: op.id, pessoaId: pessoaAluno, papel: "DECISOR" } });
    await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5511900000009", pessoaId: pessoaAluno } });
    const t1 = await prisma.tag.create({ data: { nome: "t1", cor: "NEUTRA" } });
    await prisma.pessoaTag.create({ data: { pessoaId: pessoaAluno, tagId: t1.id } });
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    logadoComo(admin.id);
    const antes = await prisma.evento.count();
    const r = await previaMesclaPessoas({ principalId: a, secundariaId: pessoaAluno, escolhas: { nome: "secundaria", email: "secundaria" } });
    expect(r).toEqual({
      ok: true,
      dado: {
        principal: { id: a, nome: "Beatriz Lima" },
        secundaria: { id: pessoaAluno, nome: "Aluno" },
        camposDaSecundaria: ["nome", "email"],
        movidos: { contatos: 1, oportunidades: 1, participantes: 1, tags: 1, valoresCampo: 0 },
        cadastroAcademico: { aluno: true, responsavel: false },
        exigeSecretaria: true,
        bloqueio: null,
      },
    });
    expect(await prisma.evento.count()).toBe(antes);
    expect(await prisma.oportunidade.count({ where: { pessoaId: pessoaAluno } })).toBe(1);
    expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: pessoaAluno } })).mescladaEmId).toBeNull();
  });

  it("sem a alçada, a prévia já diz que a mesclagem será recusada", async () => {
    logadoComo(gerente.id);
    const r = await previaMesclaPessoas({ principalId: a, secundariaId: pessoaAluno, escolhas: { nome: "secundaria", email: "secundaria" } });
    expect(r).toMatchObject({ ok: true, dado: { exigeSecretaria: true, bloqueio: MSG_ALCADA_SECRETARIA_MESCLA } });
  });

  it("mescla comum: sem cadastro acadêmico, sem alçada extra", async () => {
    logadoComo(gerente.id);
    const r = await previaMesclaPessoas({ principalId: a, secundariaId: b, escolhas: { cidade: "secundaria" } });
    expect(r).toMatchObject({ ok: true, dado: { camposDaSecundaria: ["cidade"], cadastroAcademico: null, exigeSecretaria: false, bloqueio: null } });
  });

  it("vendedor não vê a prévia (sem contatos.mesclar)", async () => {
    logadoComo(vendedor.id);
    expect((await previaMesclaPessoas({ principalId: a, secundariaId: b, escolhas: {} })).ok).toBe(false);
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
