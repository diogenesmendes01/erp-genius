import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ ator: "aprovador", tx: {
  $executeRaw: vi.fn(),
  usuario: { findUnique: vi.fn() },
  decisaoAdministrativaDesistencia: { findUnique: vi.fn() },
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

describe("Q165 aplicação nova exige decisão administrativa independente", () => {
  beforeEach(() => {
    h.tx.decisaoAcertoDesistenciaContratual.findUnique.mockResolvedValue({
      id: "decisao", aprovada: true, decisorId: "aprovador", aplicacao: null,
      proposta: { pedidoId: "pedido", estadoHash: "estado", condicoesHash: "condicoes", fotografiaHash: "fotografia",
        pedido: { matriculaId: "matricula", registradorId: "secretaria" }, memoria: { itens: [] } },
    });
    h.tx.aplicacaoAcertoDesistenciaContratual.findUnique.mockResolvedValue(null);
    h.tx.decisaoAdministrativaDesistencia.findUnique.mockResolvedValue({ aprovada: true, estadoHash: "estado", decisorId: "administrador" });
    h.tx.usuario.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "administrador"
      ? { ativo: true, papeis: ["ADMINISTRADOR"] }
      : { ativo: true, papeis: ["FINANCEIRO"], permissoes: ["financeiro.aprovar_acertos"] });
    h.tx.cobranca.findMany.mockResolvedValue([]);
    h.tx.aplicacaoAcertoDesistenciaContratual.create.mockResolvedValue({ id: "nova-aplicacao" });
  });

  it("permite materializar após as duas decisões válidas", async () => {
    expect(await aplicarAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: true, dado: { id: "nova-aplicacao" } });
    expect(h.tx.aplicacaoAcertoDesistenciaContratual.create).toHaveBeenCalledOnce();
    expect(h.tx.$executeRaw).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    { aprovada: false, estadoHash: "estado", decisorId: "administrador" },
    { aprovada: true, estadoHash: "outro-estado", decisorId: "administrador" },
    { aprovada: true, estadoHash: "estado", decisorId: "secretaria" },
  ])("bloqueia decisão ausente, rejeitada, obsoleta ou própria: %j", async administrativa => {
    h.tx.decisaoAdministrativaDesistencia.findUnique.mockResolvedValue(administrativa);
    const resultado = await aplicarAcertoDesistenciaContratual(entrada);
    expect(resultado).toMatchObject({ ok: false, erro: expect.stringContaining("decisão administrativa") });
    expect(h.tx.aplicacaoAcertoDesistenciaContratual.create).not.toHaveBeenCalled();
    expect(h.tx.cobranca.findMany).not.toHaveBeenCalled();
  });

  it.each([{ ativo: false, papeis: ["ADMINISTRADOR"] }, { ativo: true, papeis: ["FINANCEIRO"] }])("revalida a alçada atual de quem aprovou administrativamente: %j", async administrador => {
    h.tx.usuario.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "administrador"
      ? administrador : { ativo: true, papeis: ["FINANCEIRO"], permissoes: ["financeiro.aprovar_acertos"] });
    expect(await aplicarAcertoDesistenciaContratual(entrada)).toMatchObject({ ok: false, erro: expect.stringContaining("decisão administrativa") });
    expect(h.tx.aplicacaoAcertoDesistenciaContratual.create).not.toHaveBeenCalled();
  });
});
