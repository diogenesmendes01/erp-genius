import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { camposDaPessoa, paresDuplicados, pessoasMesclaveis, tagsAtivas } from "./ficha-dados";

const sessaoDe = (u: { id: string; nome: string; papeis: Papel[] }): UsuarioSessao => ({ id: u.id, nome: u.nome, papeis: u.papeis });

let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let a: string;
let b: string;

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  a = (await prisma.pessoa.create({ data: { nome: "Ana Souza", email: "ana@x.com" } })).id;
  b = (await prisma.pessoa.create({ data: { nome: "Ana Souza", email: "ANA@x.com" } })).id;
  await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5581999990001", pessoaId: a } });
  await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5581999990002", pessoaId: b } });
});

describe("camposDaPessoa", () => {
  it("devolve os campos de pessoa não arquivados com o valor da pessoa", async () => {
    const c1 = await prisma.campoPersonalizado.create({ data: { nome: "Nível", tipo: "SELECAO", alvo: "PESSOA", opcoes: ["A1", "B2"] } });
    await prisma.campoPersonalizado.create({ data: { nome: "Antigo", tipo: "TEXTO", alvo: "PESSOA", opcoes: [], arquivadoEm: new Date() } });
    await prisma.campoPersonalizado.create({ data: { nome: "Do cliente", tipo: "TEXTO", alvo: "EMPRESA", opcoes: [] } });
    await prisma.valorCampoPersonalizado.create({ data: { campoId: c1.id, pessoaId: a, valor: "B2" } });
    const campos = await camposDaPessoa(a, sessaoDe(gerente));
    expect(campos).toEqual([{ id: c1.id, nome: "Nível", tipo: "SELECAO", opcoes: ["A1", "B2"], obrigatorio: false, valor: "B2" }]);
    expect((await camposDaPessoa(b, sessaoDe(gerente)))[0]!.valor).toBeNull();
  });

  it("papel sem contatos.ver não lê campos", async () => {
    const professor = await criarUsuario([Papel.PROFESSOR], "Prof");
    expect(await camposDaPessoa(a, sessaoDe(professor))).toEqual([]);
  });
});

describe("tagsAtivas", () => {
  it("só as ativas, por nome", async () => {
    await prisma.tag.create({ data: { nome: "Zeta", cor: "INFO" } });
    await prisma.tag.create({ data: { nome: "Alfa", cor: "MARCA" } });
    await prisma.tag.create({ data: { nome: "Velha", cor: "NEUTRA", ativo: false } });
    expect((await tagsAtivas()).map((t) => t.nome)).toEqual(["Alfa", "Zeta"]);
  });
});

describe("mesclagem: dados para a tela", () => {
  it("gerente vê os pares duplicados com os dois lados; vendedor não tem a capacidade", async () => {
    const pares = await paresDuplicados(sessaoDe(gerente));
    expect(pares).toHaveLength(1);
    expect(new Set([pares[0]!.a.id, pares[0]!.b.id])).toEqual(new Set([a, b]));
    expect(pares[0]!.motivos).toEqual(expect.arrayContaining(["email", "nome"]));
    expect(await paresDuplicados(sessaoDe(vendedor))).toEqual([]);
    expect((await pessoasMesclaveis(sessaoDe(vendedor), [a])).size).toBe(0);
  });

  it("pessoa fora do escopo não entra no mapa", async () => {
    const fora = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
    expect((await pessoasMesclaveis(sessaoDe(fora), [a])).size).toBe(0);
  });
});
