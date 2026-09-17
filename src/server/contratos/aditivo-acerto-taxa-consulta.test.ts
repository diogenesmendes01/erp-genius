import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { conclusaoAssinaturaAditivo: { findFirst: mocks.find }, $transaction: mocks.transaction } }));
vi.mock("@/server/_shared", async importOriginal => ({ ...await importOriginal<typeof import("@/server/_shared")>(), exigirSessaoComPapel: mocks.auth }));
import { ErroAutenticacao, ErroPermissao } from "@/server/_shared";
import { consultarAcertoTaxaPorProposta } from "./aditivo-acerto-taxa-consulta";
describe("consulta de acerto por proposta", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each([new ErroAutenticacao(), new ErroPermissao()])("rejeita acesso antes de consultar documentos: %s", async erro => {
    mocks.auth.mockRejectedValue(erro);
    const r = await consultarAcertoTaxaPorProposta({ matriculaId: "m", propostaId: "p" });
    expect(r).toEqual({ ok: false, erro: erro.message });
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("valida identificadores antes da consulta", async () => {
    mocks.auth.mockResolvedValue({ id: "u" });
    expect((await consultarAcertoTaxaPorProposta({ matriculaId: "", propostaId: "p" })).ok).toBe(false);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("consulta conclusão apenas no contrato e proposta solicitados", async () => {
    mocks.auth.mockResolvedValue({ id: "u" }); mocks.find.mockResolvedValue(null);
    expect(await consultarAcertoTaxaPorProposta({ matriculaId: "m", propostaId: "p" })).toMatchObject({ ok: true, dado: { estado: "SEM_CONCLUSAO" } });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { processo: { propostaId: "p", proposta: { matriculaId: "m" } } } }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
