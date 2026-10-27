import { Papel, type Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { escopoAtendimentos } from "@/server/whatsapp/escopo";
import { whereBuscaConversas } from "@/server/whatsapp/busca-inbox";
import { whereAtendimentoEmSql } from "./where-sql";
const sql = (w: Prisma.AtendimentoWhatsAppWhereInput) => whereAtendimentoEmSql(w);
const db = {
  usuario: { findMany: async () => [{ id: "equipe" }] },
  coberturaCarteira: { findMany: async () => [{ titularId: "titular" }] },
  alocacaoTurma: { findMany: async () => [{ alunoId: "aluno", turmaId: "turma" }] },
};
describe("tradutor fechado Inbox344", () => {
  it("aceita formatos da ACL canônica em todas as combinações de papéis e envio", async () => {
    const papeis = Object.values(Papel);
    for (let bits = 0; bits < 2 ** papeis.length; bits++) for (const enviar of [false, true]) {
      const u = { id: "ator", papeis: papeis.filter((_, i) => bits & 2 ** i) };
      const where = await escopoAtendimentos(u, { db: db as never, agora: new Date("2026-10-24T12:00:00Z"), enviar });
      expect(() => sql(where), JSON.stringify({ papeis: u.papeis, enviar })).not.toThrow();
    }
  });
  it.each(["Ana", "José da Silva", "%_", String.raw`a\b`, "' OR 1=1 --", "123"])("parametriza busca canônica: %s", busca => {
    const r = sql(whereBuscaConversas(busca)); expect(r.values.length).toBeGreaterThan(0); expect(r.sql).not.toContain(busca);
  });
  it("contexto de equipe não trunca no membro301", async () => {
    const equipe = Array.from({length:301},(_,n)=>({id:"dono-"+n}));
    const w = await escopoAtendimentos({id:"g",papeis:[Papel.GERENTE_COMERCIAL]}, {db:{...db,usuario:{findMany:async()=>equipe}} as never});
    expect(sql(w).values).toContain("dono-300");
  });
  it("D5: acesso contextual transferido vira EXISTS na tabela própria, sem ramo fora do comercial", async () => {
    const r = sql(await escopoAtendimentos({ id: "v", papeis: [Papel.VENDEDOR] }, { db: db as never }));
    expect(r.sql).toContain('"AtendimentoAcessoTransferido"');
    expect(r.sql).toContain('."revogadoEm" IS NULL');
    expect(sql(await escopoAtendimentos({ id: "f", papeis: [Papel.FINANCEIRO] }, { db: db as never })).sql).not.toContain("AtendimentoAcessoTransferido");
  });
  it("parametriza valores sem alias do chamador", () => {
    const valor = "' OR 1=1 --", r = sql({ responsavelId: valor });
    expect(r.sql).not.toContain(valor); expect(r.values).toContain(valor); expect(r.sql).toContain('a."responsavelId"');
  });
  it("normaliza Date para ISO UTC explícito e precisão ms", () => {
    const r = sql({ prazoRespostaEm: { gt: new Date("2026-10-24T12:00:00.123Z") } });
    expect(r.values).toEqual(["2026-10-24T12:00:00.123Z"]); expect(r.sql).toContain("timestamp(3)");
  });
  it("aceita some/none/is:null/not:null", () => {
    expect(sql({ conversa: { contato: { is: null }, preferenciasUsuarios: { none: { usuarioId: "u", lidaAte: { not: null } } } }, participantes: { some: {} } }).sql).toMatch(/NOT\s*\(?EXISTS/);
    expect(sql({ responsavelId: { not: null } }).sql).toContain("IS NOT NULL");
  });
  it.each([
    { inesperado: 1 }, { id: { startsWith: "x" } }, { id: { in: [1] } }, { status: "NAO_EXISTE" },
    { encerradoEm: new Date(NaN) }, { naoLidas: NaN }, { conversa: { contato: { id: { equals: true } } } },
    { participantes: { every: {} } }, { conversa: { isNot: {} } }, { id: { contains: "x", mode: "estranho" } },
    { OR: {} }, { AND: [null] }, { id: { notIn: ["x"] } }, JSON.parse('{"__proto__":{"id":"x"}}'), { constructor: "x" },
  ])("recusa forma/tipo novo: %j", w => expect(() => sql(w as never)).toThrow(/Filtro Inbox SQL não suportado/));
});
