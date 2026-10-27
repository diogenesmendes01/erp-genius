import { Papel, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { whereOportunidadeEmSql } from "./oportunidade-sql";

const texto = (s: Prisma.Sql) => s.sql.replace(/\s+/g, " ").trim();

function banco(coberturas: string[], equipe: string[]) {
  return {
    coberturaCarteira: { findMany: async () => coberturas.map((titularId) => ({ titularId })) },
    usuario: { findMany: async () => equipe.map((id) => ({ id })) },
  } as never;
}

function formaDoEscopo(where: Prisma.OportunidadeWhereInput): "admin" | "sem-acesso" | "titulares" {
  if (Object.keys(where).length === 0) return "admin";
  if (JSON.stringify(where) === JSON.stringify({ id: "__sem_acesso__" })) return "sem-acesso";
  const chaves = Object.keys(where);
  const filtro = where.vendedorDonoId as { in?: unknown } | undefined;
  if (
    chaves.length === 1 &&
    chaves[0] === "vendedorDonoId" &&
    filtro &&
    Object.keys(filtro).length === 1 &&
    Array.isArray(filtro.in) &&
    filtro.in.length > 0 &&
    filtro.in.every((v) => typeof v === "string")
  ) {
    return "titulares";
  }
  throw new Error(`Forma nova de escopo comercial (atualize oportunidade-sql.ts e este teste): ${JSON.stringify(where)}`);
}

const TODOS = Object.values(Papel);
const combinacoes: Papel[][] = Array.from({ length: 1 << TODOS.length }, (_, m) => TODOS.filter((_, i) => m & (1 << i)));
const bancos = [
  { nome: "sem equipe nem cobertura", tx: () => banco([], []) },
  { nome: "com equipe e cobertura", tx: () => banco(["t1", "t2"], ["v1", "v2"]) },
];

describe("formato de escopoComercialAtual × whereOportunidadeEmSql", () => {
  it("usuário sem id cai em sem-acesso e o tradutor aceita", async () => {
    const where = await escopoComercialAtual({ id: "", nome: "", papeis: [Papel.ADMINISTRADOR] }, banco([], []));
    expect(formaDoEscopo(where)).toBe("sem-acesso");
    expect(texto(whereOportunidadeEmSql(where))).toBe('o."id" = ?');
  });

  for (const b of bancos) {
    it(`toda combinação de papéis (${b.nome}) dá uma das três formas e é traduzida`, async () => {
      const vistas = new Set<string>();
      for (const papeis of combinacoes) {
        const where = await escopoComercialAtual({ id: "u1", nome: "", papeis }, b.tx());
        const forma = formaDoEscopo(where);
        vistas.add(forma);
        const sql = texto(whereOportunidadeEmSql(where));
        if (forma === "admin") expect(sql).toBe("TRUE");
        if (forma === "sem-acesso") expect(sql).toBe('o."id" = ?');
        if (forma === "titulares") expect(sql).toMatch(/^o\."vendedorDonoId" IN \(\?(,\?)*\)$/);
      }
      expect([...vistas].sort()).toEqual(["admin", "sem-acesso", "titulares"]);
    });
  }

  it("o detector recusa formas que o tradutor também recusaria", () => {
    expect(() => formaDoEscopo({ OR: [{ vendedorDonoId: "v1" }] })).toThrow(/Forma nova/);
    expect(() => formaDoEscopo({ vendedorDonoId: { in: ["v1"] }, b2b: true })).toThrow(/Forma nova/);
    expect(() => whereOportunidadeEmSql({ NOT: { vendedorDonoId: "v1" } })).toThrow(/não suportad/);
  });
});
