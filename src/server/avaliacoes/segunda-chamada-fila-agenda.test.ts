import { beforeEach, describe, expect, it, vi } from "vitest";

// C38 (#170; C1 da R1 da #161): a âncora do cursor da fila de agenda de 2ª chamada é lida no universo da fila
// (proposta aprovada e disponibilizada), não em qualquer PropostaSegundaChamada. Sem banco: o $queryRaw guarda o
// SQL montado e o teste lê o subselect da âncora. A paginação nos dois sentidos está em src/server/filas-cursor.test.ts.
const m = vi.hoisted(() => ({ sqls: [] as { texto: string; valores: unknown[] }[] }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    $queryRaw: async (sql: { strings?: readonly string[]; values?: unknown[] } | readonly string[], ...resto: unknown[]) => {
      const partes = Array.isArray(sql) ? (sql as readonly string[]) : (sql as { strings: readonly string[] }).strings;
      const valores = Array.isArray(sql) ? resto : (sql as { values: unknown[] }).values;
      const texto = partes.join("?");
      if (/LIMIT\s*\?/.test(texto)) m.sqls.push({ texto, valores });
      return [];
    },
    $executeRaw: async () => 0,
    usuario: { findUnique: async () => ({ ativo: true, papeis: ["ADMINISTRADOR"] }) },
  };
  return { prisma: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
vi.mock("@/server/_shared", async (original) => ({
  ...(await original<typeof import("@/server/_shared")>()),
  exigirSessaoComPapel: async () => ({ id: "u1", nome: "U", papeis: ["ADMINISTRADOR"] }),
}));
vi.mock("./segunda-chamada-tx", () => ({ estadoSegundaChamadaTx: vi.fn() }));

import { listarSegundasChamadasSemAgenda } from "./segunda-chamada-fila-agenda";

const ANCORA = "c0000000000000000000000a";
/** O subselect da âncora no SQL lido (do "(SELECT ancora." até o parêntese que o fecha). */
function subselectDaAncora(texto: string) {
  const inicio = texto.indexOf("(SELECT ancora.");
  expect(inicio, "o SQL lê a âncora").toBeGreaterThan(-1);
  let nivel = 0;
  for (let i = inicio; i < texto.length; i++) {
    if (texto[i] === "(") nivel++;
    else if (texto[i] === ")" && --nivel === 0) return texto.slice(inicio, i + 1).replace(/\s+/g, " ");
  }
  throw new Error("subselect da âncora sem fechamento");
}

beforeEach(() => { m.sqls.length = 0; });

describe("fila de agenda de 2ª chamada — âncora no universo da fila (C38)", () => {
  it.each([["depois", "<"], ["antes", ">"]] as const)("cursor %s: a âncora exige decisão aprovada e disponibilização, e o corte usa %s", async (sentido, op) => {
    const r = await listarSegundasChamadasSemAgenda({ [sentido]: ANCORA });
    expect(r.ok).toBe(true);
    const { texto, valores } = m.sqls[0];
    const sub = subselectDaAncora(texto);
    expect(sub).toContain('FROM "PropostaSegundaChamada" ancora WHERE ancora.id=?');
    expect(sub).toContain('EXISTS(SELECT 1 FROM "DecisaoSegundaChamada" d WHERE d."propostaId"=ancora.id AND d.aprovada)');
    expect(sub).toContain('EXISTS(SELECT 1 FROM "DisponibilizacaoSegundaChamada" dd WHERE dd."propostaId"=ancora.id)');
    // O universo da âncora não traz o filtro "sem agenda": agendar a âncora não a perde.
    expect(sub).not.toContain("ReservaSegundaChamada");
    expect(texto).toContain(`(p."criadaEm",p.id) ${op} (SELECT ancora.`);
    expect(valores).toContain(ANCORA);
  });

  it("sem cursor: nenhum subselect de âncora", async () => {
    await listarSegundasChamadasSemAgenda({});
    expect(m.sqls[0].texto).not.toContain("ancora");
  });
});
