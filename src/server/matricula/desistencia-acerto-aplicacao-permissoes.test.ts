import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ ator: "aprovador", tx: {
  usuario: { findUnique: vi.fn() },
  decisaoAcertoDesistenciaContratual: { findUnique: vi.fn() },
  aplicacaoAcertoDesistenciaContratual: { findUnique: vi.fn(), create: vi.fn() },
  cobranca: { findMany: vi.fn(), update: vi.fn() },
}, evento: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(h.tx) } }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoComPapel: async () => ({ id: h.ator }), registrarEvento: h.evento,
  ErroRegra: class extends Error {}, ErroPermissao: class extends Error {},
  executarAcao: async (fn: () => Promise<unknown>) => {
    try { return { ok: true, dado: await fn() }; } catch (e) { return { ok: false, erro: String(e) }; }
  },
}));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: vi.fn() }));
import { aplicarAcertoDesistenciaContratual } from "./desistencia-acerto-aplicacao";

const entrada = { decisaoId: "decisao", chaveIdempotencia: "aplicacao-123" };
beforeEach(() => {
  vi.resetAllMocks(); h.ator = "aprovador";
  h.tx.usuario.findUnique.mockResolvedValue({ ativo: true, papeis: ["FINANCEIRO"], permissoes: ["financeiro.aprovar_acertos"] });
  h.tx.decisaoAcertoDesistenciaContratual.findUnique.mockResolvedValue({
    id: "decisao", aprovada: true, decisorId: "aprovador", aplicacao: { id: "aplicada" },
    proposta: { pedido: { matriculaId: "matricula" } },
  });
  h.tx.aplicacaoAcertoDesistenciaContratual.findUnique.mockResolvedValue({ id: "aplicada", decisaoId: "decisao" });
});

describe("Q165 aplicação: replay mantém autorização vigente", () => {
  it("retorna a aplicação existente sem reler valores nem reaplicar efeitos", async () => {
    expect(await aplicarAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: true, dado: { id: "aplicada" } });
    expect(h.tx.cobranca.findMany).not.toHaveBeenCalled();
    expect(h.tx.cobranca.update).not.toHaveBeenCalled();
    expect(h.tx.aplicacaoAcertoDesistenciaContratual.create).not.toHaveBeenCalled();
    expect(h.evento).not.toHaveBeenCalled();
  });
  it.each([
    { ativo: false, papeis: ["ADMINISTRADOR"], permissoes: [] },
    { ativo: true, papeis: ["FINANCEIRO"], permissoes: [] },
    { ativo: true, papeis: ["SECRETARIA_ACADEMICA"], permissoes: ["financeiro.aprovar_acertos"] },
  ])("recusa replay quando a autorização atual é insuficiente: %j", async usuario => {
    h.tx.usuario.findUnique.mockResolvedValue(usuario);
    expect(await aplicarAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: false });
    expect(h.tx.aplicacaoAcertoDesistenciaContratual.findUnique).not.toHaveBeenCalled();
    expect(h.tx.aplicacaoAcertoDesistenciaContratual.create).not.toHaveBeenCalled();
  });
  it("outro administrador não assume a aplicação do aprovador", async () => {
    h.ator = "outro-admin";
    h.tx.usuario.findUnique.mockResolvedValue({ ativo: true, papeis: ["ADMINISTRADOR"], permissoes: [] });
    expect(await aplicarAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: false });
    expect(h.tx.aplicacaoAcertoDesistenciaContratual.findUnique).not.toHaveBeenCalled();
  });
  it("recusa chave já vinculada a outra decisão", async () => {
    h.tx.aplicacaoAcertoDesistenciaContratual.findUnique.mockResolvedValue({ id: "outra", decisaoId: "outra-decisao" });
    expect(await aplicarAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: false });
    expect(h.tx.cobranca.update).not.toHaveBeenCalled();
  });
});
