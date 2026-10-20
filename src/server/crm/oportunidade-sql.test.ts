import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { whereOportunidadeEmSql } from "./oportunidade-sql";

const texto = (s: Prisma.Sql) => s.sql.replace(/\s+/g, " ").trim();

describe("whereOportunidadeEmSql", () => {
  it("as três formas do escopo comercial: admin, sem acesso e lista de titulares", () => {
    expect(texto(whereOportunidadeEmSql({}))).toBe("TRUE");
    const sem = whereOportunidadeEmSql({ id: "__sem_acesso__" });
    expect(texto(sem)).toBe('o."id" = ?');
    expect(sem.values).toEqual(["__sem_acesso__"]);
    const titulares = whereOportunidadeEmSql({ vendedorDonoId: { in: ["v1", "v2"] } });
    expect(texto(titulares)).toBe('o."vendedorDonoId" IN (?,?)');
    expect(titulares.values).toEqual(["v1", "v2"]);
  });

  it("lista vazia no `in` não casa nada, como no Prisma", () => {
    expect(texto(whereOportunidadeEmSql({ vendedorDonoId: { in: [] } }))).toBe("FALSE");
  });

  it("enum vira cast para o tipo do Postgres; `not` só onde a coluna não aceita nulo", () => {
    const w = whereOportunidadeEmSql({ AND: [{ etapa: { not: "PERDIDO" } }, { temperatura: "QUENTE" }, { origemCanal: "WHATSAPP" }] });
    expect(texto(w)).toBe(
      '((o."etapa" <> CAST(? AS "EtapaLead")) AND (o."temperatura" = CAST(? AS "Temperatura")) AND (o."origemCanal" = CAST(? AS "OrigemCanal")))',
    );
    expect(w.values).toEqual(["PERDIDO", "QUENTE", "WHATSAPP"]);
    expect(() => whereOportunidadeEmSql({ vendedorDonoId: { not: "v1" } })).toThrow(/não suportad/);
  });

  it("busca: ILIKE com o padrão cru, igual ao `contains` insensível do Prisma (que não escapa % e _)", () => {
    const w = whereOportunidadeEmSql({ OR: [{ nome: { contains: "a_b", mode: "insensitive" } }, { codigo: { contains: "a_b", mode: "insensitive" } }] });
    expect(texto(w)).toBe('((o."nome" ILIKE ?) OR (o."codigo" ILIKE ?))');
    expect(w.values).toEqual(["%a_b%", "%a_b%"]);
    expect(texto(whereOportunidadeEmSql({ OR: [] }))).toBe("FALSE");
    expect(texto(whereOportunidadeEmSql({ AND: [] }))).toBe("TRUE");
  });

  it("filtros por relação: tag da pessoa titular e turma ativa da matrícula", () => {
    const tag = whereOportunidadeEmSql({ pessoa: { is: { tags: { some: { tagId: "t1" } } } } });
    expect(texto(tag)).toBe('EXISTS (SELECT 1 FROM "PessoaTag" pt WHERE pt."pessoaId" = o."pessoaId" AND pt."tagId" = ?)');
    const turma = whereOportunidadeEmSql({ matricula: { is: { alocacoes: { some: { ativa: true } } } } });
    expect(texto(turma)).toBe(
      'EXISTS (SELECT 1 FROM "Matricula" mt JOIN "AlocacaoTurma" al ON al."matriculaId" = mt."id" WHERE mt."leadId" = o."id" AND al."ativa" = TRUE)',
    );
  });

  it("booleano e alias", () => {
    const w = whereOportunidadeEmSql({ b2b: true }, "l");
    expect(texto(w)).toBe('l."b2b" = ?');
    expect(w.values).toEqual([true]);
  });

  it("recusa o que não sabe traduzir, em vez de ignorar um filtro (escopo nunca some em silêncio)", () => {
    expect(() => whereOportunidadeEmSql({ segmento: "ADULTO" } as Prisma.OportunidadeWhereInput)).toThrow(/não suportad/);
    expect(() => whereOportunidadeEmSql({ nome: { startsWith: "a" } })).toThrow(/não suportad/);
    expect(() => whereOportunidadeEmSql({ NOT: { b2b: true } })).toThrow(/não suportad/);
    expect(() => whereOportunidadeEmSql({ pessoa: { is: { nome: "x" } } })).toThrow(/não suportad/);
  });
});
