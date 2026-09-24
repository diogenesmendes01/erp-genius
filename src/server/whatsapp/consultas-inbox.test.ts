import { describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { atendimentoWhatsApp: { findMany: m.findMany } } }));
vi.mock("./escopo", () => ({ escopoAtendimentos: vi.fn().mockResolvedValue({}) }));

import { listarConversas, listarConversasInbox } from "./consultas-inbox";
import { LIMITE_CONVERSAS } from "./busca-inbox";

const base = {
  finalidade: "COMERCIAL", matricula: null, alunoId: null, leadId: null, aluno: null, lead: null,
  conversa: { numeroId: "numero", numero: { rotulo: "Escola", driver: "META_CLOUD" }, contatoId: "contato", contato: { nomeExibicao: "Contato", telefoneE164: "+506", optOutEm: null } },
  mensagens: [],
};

describe("listarConversas — ordem da lista", () => {
  it("preserva a ordem do banco (mais recente primeiro), sem agrupar não lidas no topo", async () => {
    // O banco já devolve por ultimaMensagemEm desc; um atendimento não lido no meio da lista
    // (não o mais recente) não deve pular para o topo — é exatamente o "salto" que fazia a
    // conversa sumir debaixo do cursor a cada poll de 30s (ganho rápido 22 da auditoria).
    m.findMany.mockResolvedValue([
      { ...base, id: "recente-lida", naoLidas: 0, ultimaMensagemEm: new Date("2026-10-01T03:00:00.000Z") },
      { ...base, id: "meio-nao-lida", naoLidas: 2, ultimaMensagemEm: new Date("2026-10-01T02:00:00.000Z") },
      { ...base, id: "antiga-lida", naoLidas: 0, ultimaMensagemEm: new Date("2026-10-01T01:00:00.000Z") },
    ]);
    const usuario = { id: "u1", nome: "V", papeis: [Papel.VENDEDOR] };
    const conversas = await listarConversas(usuario);
    expect(conversas.map((c) => c.id)).toEqual(["recente-lida", "meio-nao-lida", "antiga-lida"]);
  });

  it("pede a ordem por recência ao banco — sem isso o teste acima só provaria que preservamos a ordem do mock, não a ordem real", async () => {
    m.findMany.mockResolvedValue([]);
    await listarConversas({ id: "u1", nome: "V", papeis: [Papel.VENDEDOR] });
    expect(m.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ ultimaMensagemEm: "desc" }, { criadoEm: "desc" }] }),
    );
  });
});

describe("listarConversasInbox — limite, não lidas e busca (E4)", () => {
  const usuario = { id: "u1", nome: "V", papeis: [Papel.VENDEDOR] };
  const at = (id: string, dia: number, naoLidas = 0) => ({ ...base, id, naoLidas, ultimaMensagemEm: new Date(Date.UTC(2026, 9, dia)), criadoEm: new Date(Date.UTC(2026, 0, 1)) });

  it("até o limite: uma consulta só, lista não cortada", async () => {
    m.findMany.mockReset().mockResolvedValueOnce([at("a", 3), at("b", 2)]);
    const r = await listarConversasInbox(usuario);
    expect(r.limitada).toBe(false);
    expect(r.itens.map((c) => c.id)).toEqual(["a", "b"]);
    expect(m.findMany).toHaveBeenCalledTimes(1);
    expect(m.findMany.mock.calls[0][0]).toMatchObject({ take: LIMITE_CONVERSAS + 1 });
  });

  it("além do limite: corta nas recentes e traz TODAS as não lidas de fora, na ordem por recência", async () => {
    const recentes = Array.from({ length: LIMITE_CONVERSAS + 1 }, (_, i) => at(`r${i}`, 28 - (i % 20)));
    m.findMany.mockReset().mockResolvedValueOnce(recentes).mockResolvedValueOnce([at("velha-nao-lida", 1, 3)]);
    const r = await listarConversasInbox(usuario);
    expect(r.limitada).toBe(true);
    expect(r.itens).toHaveLength(LIMITE_CONVERSAS + 1);
    expect(r.itens.at(-1)!.id).toBe("velha-nao-lida"); // a mais antiga: no fim, não no topo
    expect(r.itens.some((c) => c.id === `r${LIMITE_CONVERSAS}`)).toBe(false); // a 201ª recente fica de fora
    const segunda = m.findMany.mock.calls[1][0];
    expect(segunda.where.AND).toEqual(expect.arrayContaining([{ naoLidas: { gt: 0 } }]));
    expect(segunda.where.AND[2].id.notIn).toHaveLength(LIMITE_CONVERSAS);
  });

  it("busca vai ao servidor, em AND com o escopo", async () => {
    m.findMany.mockReset().mockResolvedValueOnce([]);
    await listarConversasInbox(usuario, { busca: "ana" });
    const where = m.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0]).toEqual({}); // escopo (mock)
    expect(JSON.stringify(where.AND[1])).toContain("nomeExibicao");
  });
});
