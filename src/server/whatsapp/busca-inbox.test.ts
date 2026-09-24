import { describe, expect, it } from "vitest";
import { hrefInbox, lerBuscaInbox, mesclarPorRecencia, whereBuscaConversas } from "./busca-inbox";

const d = (iso: string) => new Date(iso);

describe("busca da inbox", () => {
  it("lê a busca da URL: sem espaços nas pontas, até 100 caracteres", () => {
    expect(lerBuscaInbox({ busca: "  ana  " })).toBe("ana");
    expect(lerBuscaInbox({ busca: ["x", "y"] })).toBe("x");
    expect(lerBuscaInbox({})).toBe("");
    expect(lerBuscaInbox({ busca: "a".repeat(300) })).toHaveLength(100);
  });

  it("cada palavra em nome do contato, do aluno ou do lead; telefone só com 3+ dígitos", () => {
    const where = whereBuscaConversas("Ana 8888-7777") as { AND: { OR: object[] }[] };
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toEqual([
      { conversa: { contato: { nomeExibicao: { contains: "Ana", mode: "insensitive" } } } },
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

  it("mescla recentes e não lidas de fora sem repetir, por recência (sem data vai para o fim)", () => {
    const recentes = [
      { id: "r1", ultimaMensagemEm: d("2026-10-05"), criadoEm: d("2026-01-01") },
      { id: "r2", ultimaMensagemEm: d("2026-10-03"), criadoEm: d("2026-01-01") },
    ];
    const fora = [
      { id: "n1", ultimaMensagemEm: d("2026-10-04"), criadoEm: d("2026-01-01") },
      { id: "r2", ultimaMensagemEm: d("2026-10-03"), criadoEm: d("2026-01-01") },
      { id: "n2", ultimaMensagemEm: null, criadoEm: d("2026-02-01") },
    ];
    expect(mesclarPorRecencia(recentes, fora).map((a) => a.id)).toEqual(["r1", "n1", "r2", "n2"]);
  });

  it("links da inbox mantêm a busca e a conversa aberta", () => {
    expect(hrefInbox({ busca: "ana", c: "c1" })).toBe("/inbox?busca=ana&c=c1");
    expect(hrefInbox({ c: "c1" })).toBe("/inbox?c=c1");
    expect(hrefInbox({})).toBe("/inbox");
  });
});
