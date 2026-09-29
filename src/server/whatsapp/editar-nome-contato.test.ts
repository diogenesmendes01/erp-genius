import { beforeEach, describe, expect, it, vi } from "vitest";

// Editar o nome salvo do contato pela thread (29/09/2026): alcance de quem responde a conversa,
// nunca no pedagógico, gravação condicional (duas edições não se sobrescrevem) e auditoria.

const m = vi.hoisted(() => ({
  sessao: vi.fn(), visivel: vi.fn(), soNoAlcance: vi.fn(), evento: vi.fn(),
  tx: { contatoWhatsApp: { updateMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.tx) } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./despachante", () => ({ despacharFila: vi.fn() }));
vi.mock("./consultas", () => ({ conversaVisivel: m.visivel, contatoSoNoAlcance: m.soNoAlcance, buscarPessoasVinculo: vi.fn() }));
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

const atendimento = (over: Record<string, unknown> = {}) => ({ id: "at", contatoId: "contato", finalidade: "COMERCIAL", ...over });
const gravado = () => m.tx.contatoWhatsApp.updateMany.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  m.sessao.mockResolvedValue({ id: "u1", nome: "V", papeis: ["VENDEDOR"] });
  m.visivel.mockResolvedValue(atendimento());
  m.soNoAlcance.mockResolvedValue(true);
  m.tx.contatoWhatsApp.updateMany.mockResolvedValue({ count: 1 });
});

describe("editarNomeContatoWhatsApp", () => {
  it("salva o nome (sem espaços nas pontas), marca a edição da equipe e audita antes/depois", async () => {
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "  Dr. Victor Maruyama ", nomeAnterior: null })).toEqual({ ok: true, dado: undefined });
    expect(m.visivel).toHaveBeenCalledWith(expect.anything(), "at"); // leitura basta: renomear não envia nada
    expect(gravado().where).toEqual({ id: "contato", nomeExibicao: null });
    expect(gravado().data).toEqual({ nomeExibicao: "Dr. Victor Maruyama", nomeEditadoEm: expect.any(Date) });
    expect(m.evento).toHaveBeenCalledWith(m.tx, expect.objectContaining({ tipo: "ContatoRenomeado", agregadoTipo: "ContatoWhatsApp",
      agregadoId: "contato", autorId: "u1", payload: { antes: null, depois: "Dr. Victor Maruyama" } }));
  });

  it("em branco limpa o nome salvo, e a limpeza também fica marcada (fluxos do ERP não o repõem)", async () => {
    await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "   ", nomeAnterior: "Errado" });
    expect(gravado()).toEqual({ where: { id: "contato", nomeExibicao: "Errado" }, data: { nomeExibicao: null, nomeEditadoEm: expect.any(Date) } });
  });

  it("a condição é o nome que a TELA carregou: se outra pessoa salvou antes, recusa e não audita", async () => {
    m.tx.contatoWhatsApp.updateMany.mockResolvedValue({ count: 0 });
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "Z", nomeAnterior: "X" })).toMatchObject({ ok: false, erro: expect.stringContaining("mudou") });
    expect(gravado().where).toEqual({ id: "contato", nomeExibicao: "X" });
    expect(m.evento).not.toHaveBeenCalled();
  });

  it("fora do alcance, no pedagógico ou contato atendido por outra área: recusa sem gravar", async () => {
    m.visivel.mockResolvedValueOnce(null);
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "X", nomeAnterior: null })).toMatchObject({ ok: false });
    m.visivel.mockResolvedValueOnce(atendimento({ finalidade: "PEDAGOGICO" }));
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "X", nomeAnterior: null })).toMatchObject({ ok: false });
    m.soNoAlcance.mockResolvedValueOnce(false);
    expect(await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "X", nomeAnterior: null })).toMatchObject({ ok: false, erro: expect.stringContaining("outra área") });
    expect(m.soNoAlcance).toHaveBeenCalledWith(expect.anything(), "contato");
    expect(m.tx.contatoWhatsApp.updateMany).not.toHaveBeenCalled();
    expect(m.evento).not.toHaveBeenCalled();
  });

  it("mesmo nome: nada a gravar; mais de 80 caracteres: recusado", async () => {
    await editarNomeContatoWhatsApp({ atendimentoId: "at", nome: " Ana ", nomeAnterior: "Ana" });
    expect(m.tx.contatoWhatsApp.updateMany).not.toHaveBeenCalled();
    await expect(editarNomeContatoWhatsApp({ atendimentoId: "at", nome: "x".repeat(81), nomeAnterior: null })).rejects.toThrow();
  });
});
