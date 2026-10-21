import { describe, expect, it } from "vitest";
import { lerBuscaInbox, whereBuscaConversas } from "./busca-inbox";

describe("busca da inbox", () => {
  it("lê a busca da URL: sem espaços nas pontas, até 100 caracteres", () => {
    expect(lerBuscaInbox({ busca: "  ana  " })).toBe("ana");
    expect(lerBuscaInbox({ busca: ["x", "y"] })).toBe("x");
    expect(lerBuscaInbox({})).toBe("");
    expect(lerBuscaInbox({ busca: "a".repeat(300) })).toHaveLength(100);
  });

  it("cada palavra em nome do contato (cadastro ou perfil), do aluno, do lead ou do responsável; telefone só com 3+ dígitos", () => {
    const where = whereBuscaConversas("Ana 8888-7777") as { AND: { OR: object[] }[] };
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toEqual([
      { conversa: { contato: { nomeExibicao: { contains: "Ana", mode: "insensitive" } } } },
      { conversa: { contato: { nomePerfil: { contains: "Ana", mode: "insensitive" } } } },
      // Mesmo recorte da exibição: o responsável não é buscável no comercial (nomeDoAtendimento).
      { finalidade: { not: "COMERCIAL" }, conversa: { contato: { responsavel: { nome: { contains: "Ana", mode: "insensitive" } } } } },
      { aluno: { OR: [{ primeiroNome: { contains: "Ana", mode: "insensitive" } }, { sobrenome: { contains: "Ana", mode: "insensitive" } }] } },
      { lead: { nome: { contains: "Ana", mode: "insensitive" } } },
    ]);
    expect(where.AND[1].OR).toContainEqual({ conversa: { contato: { telefoneE164: { contains: "88887777" } } } });
    expect(whereBuscaConversas("   ")).toEqual({});
    // Menos de 3 dígitos não varre telefones ("a1", "12"); 3 já varre.
    const temTelefone = (b: string) => JSON.stringify(whereBuscaConversas(b)).includes("telefoneE164");
    expect(temTelefone("a1")).toBe(false);
    expect(temTelefone("12")).toBe(false);
    expect(temTelefone("123")).toBe(true);
  });
});

describe("teto da busca da inbox", () => {
  it("no máximo 6 palavras: a 7ª em diante é descartada (limita o tamanho da consulta)", () => {
    const where = whereBuscaConversas("a b c d e f g") as { AND: unknown[] };
    expect(where.AND).toHaveLength(6);
    expect(JSON.stringify(where)).not.toContain('"g"');
  });
});
