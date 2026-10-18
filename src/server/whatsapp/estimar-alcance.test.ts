import { beforeEach, describe, expect, it, vi } from "vitest";

// estimarAlcanceRegua (docs/42 L2517; fatia B, issue #169): a consulta de leitura que a confirmação da ativação
// usa. Os degraus do FORMULÁRIO passam pela mesma tradução da política guardada (D+15 nunca automático, inativo
// fora, ordem por offset, modelo do template) e a contagem é a do cron (contarAlcanceRegua, mock aqui; a regra
// está em alcance-regua.test.ts). Só o administrador; nada é gravado.

const m = vi.hoisted(() => ({
  sessaoPapel: vi.fn(), contar: vi.fn(), templates: vi.fn(),
  escrita: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    templateWhatsApp: { findMany: m.templates },
    $transaction: m.escrita,
    politicaRegua: { findFirst: m.escrita, create: m.escrita, update: m.escrita },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./despachante", () => ({ despacharFila: vi.fn() }));
vi.mock("./consultas", () => ({ conversaVisivel: vi.fn(), contatoSoNoAlcance: vi.fn(), buscarPessoasVinculo: vi.fn() }));
vi.mock("./alcance-regua", () => ({ contarAlcanceRegua: m.contar }));
vi.mock("@/server/_shared", () => {
  class ErroRegra extends Error {}
  return {
    ErroRegra,
    exigirSessao: vi.fn(),
    exigirSessaoComPapel: m.sessaoPapel,
    registrarEvento: vi.fn(),
    temPapel: vi.fn(() => false),
    executarAcao: async (fn: () => Promise<unknown>) => {
      try { return { ok: true, dado: await fn() }; } catch (e) { if (e instanceof ErroRegra) return { ok: false, erro: e.message }; throw e; }
    },
  };
});

import { estimarAlcanceRegua } from "./acoes";

const formulario = (degraus: { passo: string; offsetDias: number; modo: string; ativo: boolean; templateId?: string }[]) => ({
  estado: "ATIVA" as const, janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5], tetoPorContatoDia: 2, silencioPosInboundHoras: 72,
  killSwitch: false, numeroRemetenteId: "n1",
  degraus: degraus as { passo: "D-7" | "D-3" | "D0" | "D+3" | "D+7" | "D+15"; offsetDias: number; modo: "AUTOMATICO" | "MANUAL" | "LOTE"; ativo: boolean; templateId?: string }[],
});

beforeEach(() => {
  vi.clearAllMocks();
  m.sessaoPapel.mockResolvedValue({ id: "admin", papeis: ["ADMINISTRADOR"] });
  m.templates.mockResolvedValue([{ id: "t-vencida", nome: "vencida" }]);
  m.contar.mockResolvedValue({ pessoas: 12, cobrancas: 14, semDestino: 1, emLote: 3 });
});

describe("estimarAlcanceRegua", () => {
  it("devolve a contagem da regra do cron para a política do formulário, só para o administrador, sem gravar", async () => {
    const r = await estimarAlcanceRegua(formulario([{ passo: "D+3", offsetDias: 3, modo: "AUTOMATICO", ativo: true, templateId: "t-vencida" }]));
    expect(r).toEqual({ ok: true, dado: { pessoas: 12, cobrancas: 14, semDestino: 1, emLote: 3 } });
    expect(m.sessaoPapel).toHaveBeenCalledWith("ADMINISTRADOR");
    expect(m.escrita).not.toHaveBeenCalled();
    expect(m.contar).toHaveBeenCalledTimes(1);
    expect(m.contar.mock.calls[0][1]).toBeInstanceOf(Date);
  });

  it("traduz os degraus como a política guardada: inativo fora, D+15 nunca automático, ordem por offset, modelo do template", async () => {
    await estimarAlcanceRegua(formulario([
      { passo: "D+15", offsetDias: 15, modo: "AUTOMATICO", ativo: true },
      { passo: "D+3", offsetDias: 3, modo: "AUTOMATICO", ativo: true, templateId: "t-vencida" },
      { passo: "D-3", offsetDias: -3, modo: "LOTE", ativo: true },
      { passo: "D0", offsetDias: 0, modo: "AUTOMATICO", ativo: false },
    ]));
    expect(m.templates).toHaveBeenCalledWith({ where: { id: { in: ["t-vencida"] }, tipo: "MODELO_AUTOMACAO" }, select: { id: true, nome: true } });
    const politica = m.contar.mock.calls[0][0] as { degraus: { passo: string; template: string }[]; modoPorPasso: Map<string, string> };
    expect(politica.degraus.map((d) => d.passo)).toEqual(["D-3", "D+3", "D+15"]);
    expect(politica.degraus.find((d) => d.passo === "D+3")?.template).toBe("vencida");
    expect(Object.fromEntries(politica.modoPorPasso)).toEqual({ "D-3": "LOTE", "D+3": "AUTOMATICO", "D+15": "MANUAL" });
  });

  it("sem template escolhido, não consulta templates", async () => {
    await estimarAlcanceRegua(formulario([{ passo: "D-3", offsetDias: -3, modo: "AUTOMATICO", ativo: true }]));
    expect(m.templates).not.toHaveBeenCalled();
    expect(m.contar).toHaveBeenCalledTimes(1);
  });
});
