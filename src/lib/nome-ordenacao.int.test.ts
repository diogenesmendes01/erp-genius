import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarAlunoMinimo, criarUsuario, truncarBanco } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared";
import { listarAlunos } from "@/server/alunos/consultas";
import { lerFiltrosAlunos } from "@/server/alunos/filtros";
import { listarContatos, lerFiltrosContatos } from "@/server/crm/contatos";
import { listarEmpresasPagina } from "@/server/empresas/consultas";
import { lerFiltrosEmpresas } from "@/server/empresas/filtros";
import { normalizarParaOrdenacao } from "./nome-ordenacao";

// D1 (#141): o Postgres de produção ordena byte a byte (locale C), e "Álvaro" ia para o fim.
// A coluna gerada `nomeOrdenacao` resolve sem ICU nem `unaccent`.

let admin: UsuarioSessao;

beforeEach(async () => {
  await truncarBanco();
  const u = await criarUsuario([Papel.ADMINISTRADOR, Papel.FINANCEIRO], "Admin");
  admin = { id: u.id, nome: u.nome, papeis: u.papeis };
  authMock.mockResolvedValue({ user: { id: u.id, papeis: u.papeis } });
});

describe("coluna gerada nomeOrdenacao", () => {
  it("o banco calcula o mesmo valor que normalizarParaOrdenacao", async () => {
    const nomes = ["Álvaro", "JOÃO CONCEIÇÃO", "  Ana    Maria\t", "Zoë Øster Łukasz Ștefan", "Álvaro Conceição", "O'Neil-2"];
    for (const nome of nomes) {
      const p = await prisma.pessoa.create({ data: { nome } });
      expect(p.nomeOrdenacao, nome).toBe(normalizarParaOrdenacao(nome));
    }
  });

  it("acompanha a edição do nome, inclusive por SQL cru, e junta primeiro nome e sobrenome do aluno", async () => {
    const p = await prisma.pessoa.create({ data: { nome: "Bruno" } });
    expect((await prisma.pessoa.update({ where: { id: p.id }, data: { nome: "Ícaro" } })).nomeOrdenacao).toBe("icaro");
    await prisma.$executeRaw`UPDATE "Pessoa" SET nome = 'Úrsula' WHERE id = ${p.id}`;
    expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: p.id } })).nomeOrdenacao).toBe("ursula");

    const a = await criarAlunoMinimo({ primeiroNome: "Álvaro", sobrenome: "Gonçalves" });
    expect(a.nomeOrdenacao).toBe("alvaro goncalves");
    const semSobrenome = await criarAlunoMinimo({ primeiroNome: "Ênio" });
    expect(semSobrenome.nomeOrdenacao).toBe("enio");
  });

  it("gravar a coluna à mão é recusado pelo banco", async () => {
    const p = await prisma.pessoa.create({ data: { nome: "Bruno" } });
    await expect(prisma.$executeRaw`UPDATE "Pessoa" SET "nomeOrdenacao" = 'x' WHERE id = ${p.id}`).rejects.toThrow();
  });
});

describe("listas de nome ordenam com acento", () => {
  it("alunos: Álvaro entre Alice e Bruno, nas duas direções", async () => {
    for (const primeiroNome of ["Bruno", "Álvaro", "Alice", "Zé"]) await criarAlunoMinimo({ primeiroNome });
    const nomes = async (p: Record<string, string>) =>
      (await listarAlunos(admin, lerFiltrosAlunos(p))).map((a) => a.nome);
    expect(await nomes({})).toEqual(["Alice", "Álvaro", "Bruno", "Zé"]);
    expect(await nomes({ ordem: "nome", dir: "desc" })).toEqual(["Zé", "Bruno", "Álvaro", "Alice"]);
  });

  it("contatos: pessoas e empresas com Álvaro/Ágora entre Alice/Acme e Bruno/Beta", async () => {
    for (const nome of ["Bruno", "Álvaro", "Alice"]) await prisma.pessoa.create({ data: { nome } });
    for (const nome of ["Beta", "Ágora", "Acme"]) await prisma.empresa.create({ data: { nome } });
    const r = await listarContatos(admin, lerFiltrosContatos({}));
    expect(r.itens.map((i) => i.nome)).toEqual(["Alice", "Álvaro", "Bruno", "Acme", "Ágora", "Beta"]);
  });

  it("empresas: ordem por nome com acento", async () => {
    for (const nome of ["Beta", "Ágora", "Acme"]) await prisma.empresa.create({ data: { nome } });
    const r = await listarEmpresasPagina(lerFiltrosEmpresas({ ordem: "nome" }));
    expect(r.itens.map((e) => e.nome)).toEqual(["Acme", "Ágora", "Beta"]);
  });
});
