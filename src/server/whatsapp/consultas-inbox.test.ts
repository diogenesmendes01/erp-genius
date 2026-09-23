import { describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { atendimentoWhatsApp: { findMany: m.findMany } } }));
vi.mock("./escopo", () => ({ escopoAtendimentos: vi.fn().mockResolvedValue({}) }));

import { listarConversas } from "./consultas-inbox";

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
