import { beforeEach, describe, expect, it, vi } from "vitest";

// Editar o nome salvo do contato pela thread (29/09/2026): alcance de quem responde a conversa,
// nunca no pedagógico, gravação condicional (duas edições não se sobrescrevem) e auditoria.

const m = vi.hoisted(() => ({
  sessao: vi.fn(), visivel: vi.fn(), evento: vi.fn(),
  tx: { contatoWhatsApp: { updateMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.tx) } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./despachante", () => ({ despacharFila: vi.fn() }));
vi.mock("./consultas", () => ({ conversaVisivel: m.visivel, buscarPessoasVinculo: vi.fn() }));
vi.mock("@/server/_shared", () => {
  class ErroRegra extends Error {}
  return {
    ErroRegra,
    exigirSessao: m.sessao,
    exigirSessaoComPapel: vi.fn(),
    registrarEvento: m.evento,
    temPapel: vi.fn(() => false),
    executarAcao: async (fn: () => Promise<unknown>) => {
      try { return { ok: true, dado: await fn() }; } catch (e) { if (e instanceof ErroRegra) return { ok: false, erro: e.message }; throw e; }
    },
  };
});

import { editarNomeContatoWhatsApp } from "./acoes";

const atendimento = (over: Record<string, unknown> = {}) => ({
  id: "at", contatoId: "contato", finalidade: "COMERCIAL", contato: { nomeExibicao: null, nomePerfil: "Diogenes Mendes" }, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.sessao.mockResolvedValue({ id: "u1", nome: "V", papeis: ["VENDEDOR"] });
  m.visivel.mockResolvedValue(atendimento());
  m.tx.contatoWhatsApp.updateMany.mockResolvedValue({ count: 1 });
});

describe("editarNomeContatoWhatsApp", () => {
  it("salva o nome (sem espaços nas pontas) só se ninguém mudou antes, e audita antes/depois", async () => {
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "  Dr. Victor Maruyama " })).toEqual({ ok: true, dado: undefined });
    expect(m.visivel).toHaveBeenCalledWith(expect.anything(), "at", true); // mesmo alcance de quem responde
    expect(m.tx.contatoWhatsApp.updateMany).toHaveBeenCalledWith({ where: { id: "contato", nomeExibicao: null }, data: { nomeExibicao: "Dr. Victor Maruyama" } });
    expect(m.evento).toHaveBeenCalledWith(m.tx, expect.objectContaining({ tipo: "ContatoRenomeado", agregadoTipo: "ContatoWhatsApp",
      agregadoId: "contato", autorId: "u1", payload: { antes: null, depois: "Dr. Victor Maruyama" } }));
  });

  it("em branco limpa o nome salvo (volta ao perfil / número)", async () => {
    m.visivel.mockResolvedValue(atendimento({ contato: { nomeExibicao: "Errado" } }));
    await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "   " });
    expect(m.tx.contatoWhatsApp.updateMany).toHaveBeenCalledWith({ where: { id: "contato", nomeExibicao: "Errado" }, data: { nomeExibicao: null } });
  });

  it("fora do alcance ou no pedagógico: recusa sem gravar", async () => {
    m.visivel.mockResolvedValueOnce(null);
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "X" })).toMatchObject({ ok: false });
    m.visivel.mockResolvedValueOnce(atendimento({ finalidade: "PEDAGOGICO" }));
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "X" })).toMatchObject({ ok: false });
    expect(m.tx.contatoWhatsApp.updateMany).not.toHaveBeenCalled();
    expect(m.evento).not.toHaveBeenCalled();
  });

  it("nome mudou no meio (outra edição ou reparo): recusa e não audita", async () => {
    m.tx.contatoWhatsApp.updateMany.mockResolvedValue({ count: 0 });
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "Novo" })).toMatchObject({ ok: false, erro: expect.stringContaining("mudou") });
    expect(m.evento).not.toHaveBeenCalled();
  });

  it("mesmo nome: nada a gravar; mais de 80 caracteres: recusado", async () => {
    m.visivel.mockResolvedValue(atendimento({ contato: { nomeExibicao: "Ana" } }));
    await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: " Ana " });
    expect(m.tx.contatoWhatsApp.updateMany).not.toHaveBeenCalled();
    await expect(editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "x".repeat(81) })).rejects.toThrow();
  });
});
