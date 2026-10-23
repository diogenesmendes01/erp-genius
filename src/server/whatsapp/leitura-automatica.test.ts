import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sessao: vi.fn(), atendimento: vi.fn(), conversa: vi.fn(), motor: vi.fn(), capacidades: vi.fn(),
  db: { preferenciaConversaUsuario: { upsert: vi.fn() }, atendimentoWhatsApp: { update: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", () => ({
  exigirSessao: m.sessao, exigirSessaoComPapel: m.sessao, temPapel: vi.fn(), registrarEvento: vi.fn(),
  ErroRegra: class extends Error {},
  executarAcao: async (f: () => Promise<unknown>) => {
    try { await f(); return { ok: true }; } catch (e) { return { ok: false, erro: (e as Error).message }; }
  },
}));
vi.mock("./atendimentos", () => ({ atendimentoVisivel: m.atendimento, garantirAtendimento: vi.fn() }));
vi.mock("./consultas", () => ({ conversaVisivel: m.conversa, buscarPessoasVinculo: vi.fn(), contatoSoNoAlcance: vi.fn() }));
vi.mock("./motor/acoes", () => ({ executarAcaoMotor: m.motor }));
vi.mock("./motor/capacidades", () => ({ capacidadesDoNumero: m.capacidades }));

import { revalidatePath } from "next/cache";
import * as acoes from "./acoes";
import * as preferencias from "./preferencias";

beforeEach(() => {
  vi.clearAllMocks();
  m.sessao.mockResolvedValue({ id: "autor" });
  m.atendimento.mockResolvedValue({ id: "a", conversaId: "cv" });
  m.conversa.mockResolvedValue({ id: "a", naoLidas: 2, numero: { id: "numero-ficticio", providerRef: "motor-ficticio" }, contato: { waId: "5500000000301", telefoneE164: "+5500000000301" } });
  m.db.preferenciaConversaUsuario.upsert.mockResolvedValue({});
  m.db.atendimentoWhatsApp.update.mockResolvedValue({});
  m.capacidades.mockReturnValue([]); m.motor.mockResolvedValue({});
});

const semEscrita = () => {
  expect(m.db.preferenciaConversaUsuario.upsert).not.toHaveBeenCalled();
  expect(m.db.atendimentoWhatsApp.update).not.toHaveBeenCalled();
  expect(m.motor).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
};

describe("leitura automática sem árvore RSC; caminhos manuais preservados", () => {
  it("legado compartilhado continua invalidando exatamente uma vez", async () => {
    expect(await acoes.marcarConversaLida("a")).toEqual({ ok: true });
    expect(m.db.atendimentoWhatsApp.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "a" }, data: { naoLidas: 0 } });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/inbox");
  });
  it("legado composto e pessoal isolado continuam invalidando uma vez por ação", async () => {
    expect(await preferencias.marcarAtendimentoLido("a")).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/inbox");
    vi.mocked(revalidatePath).mockClear();
    expect(await preferencias.marcarLida("a")).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/inbox");
  });
  it("automático compartilhado mantém contador e capacidade do motor, com zero invalidações", async () => {
    m.capacidades.mockReturnValue(["confirmacaoLeitura"]);
    expect(await acoes.marcarConversaLidaAutomatico("a")).toEqual({ ok: true });
    expect(m.db.atendimentoWhatsApp.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "a" }, data: { naoLidas: 0 } });
    expect(m.motor).toHaveBeenCalledExactlyOnceWith("motor-ficticio", "message.read", { chatId: "5500000000301@s.whatsapp.net" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("automático composto mantém preferência pessoal e contador compartilhado, sem invalidação", async () => {
    expect(await preferencias.marcarAtendimentoLidoAutomatico("a")).toEqual({ ok: true });
    expect(m.db.preferenciaConversaUsuario.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { usuarioId_conversaId: { usuarioId: "autor", conversaId: "cv" } }, update: { lidaAte: expect.any(Date), marcadaNaoLida: false } }));
    expect(m.db.atendimentoWhatsApp.update).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("falha parcial automática preserva preferência pessoal, resultado e zero invalidações", async () => {
    m.conversa.mockResolvedValue(null);
    expect(await preferencias.marcarAtendimentoLidoAutomatico("a")).toEqual({ ok: false, erro: "Conversa não encontrada ou fora do seu escopo." });
    expect(m.db.preferenciaConversaUsuario.upsert).toHaveBeenCalledTimes(1);
    expect(m.db.atendimentoWhatsApp.update).not.toHaveBeenCalled();
    expect(m.motor).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("falha parcial manual ainda invalida a preferência já gravada exatamente uma vez", async () => {
    m.conversa.mockResolvedValue(null);
    expect((await preferencias.marcarAtendimentoLido("a")).ok).toBe(false);
    expect(m.db.preferenciaConversaUsuario.upsert).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/inbox");
  });
  it.each(["manual", "automatico"] as const)("nega escopo pessoal %s sem qualquer escrita", async (modo) => {
    m.atendimento.mockResolvedValue(null);
    const resultado = modo === "manual" ? await preferencias.marcarAtendimentoLido("a") : await preferencias.marcarAtendimentoLidoAutomatico("a");
    expect(resultado.ok).toBe(false); semEscrita(); expect(m.conversa).not.toHaveBeenCalled();
  });
  it("nega escopo compartilhado automático sem escrita ou motor", async () => {
    m.conversa.mockResolvedValue(null);
    expect((await acoes.marcarConversaLidaAutomatico("a")).ok).toBe(false); semEscrita();
  });
  it("automático não toca contador já zerado e respeita ausência da capacidade", async () => {
    m.conversa.mockResolvedValue({ naoLidas: 0, numero: {}, contato: {} });
    expect((await acoes.marcarConversaLidaAutomatico("a")).ok).toBe(true); semEscrita();
  });
  it("falha do motor não desfaz leitura automática e não invalida a página", async () => {
    m.capacidades.mockReturnValue(["confirmacaoLeitura"]); m.motor.mockRejectedValue(new Error("motor indisponível"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await preferencias.marcarAtendimentoLidoAutomatico("a")).ok).toBe(true);
      await Promise.resolve();
      expect(m.db.preferenciaConversaUsuario.upsert).toHaveBeenCalledTimes(1);
      expect(m.db.atendimentoWhatsApp.update).toHaveBeenCalledTimes(1);
      expect(erro).toHaveBeenCalled(); expect(JSON.stringify(erro.mock.calls)).not.toContain("5500000000301");
      expect(revalidatePath).not.toHaveBeenCalled();
    } finally { erro.mockRestore(); }
  });
});
