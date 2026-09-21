import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), transaction: vi.fn(), usuario: vi.fn(), propostas: vi.fn(), versoes: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { conclusaoAssinaturaAditivo: { findFirst: mocks.find }, $transaction: mocks.transaction, usuario: { findUnique: mocks.usuario }, propostaAcertoTaxaAditivo: { findMany: mocks.propostas }, versaoCondicoesAditivo: { findMany: mocks.versoes } } }));
vi.mock("@/server/_shared", async importOriginal => ({ ...await importOriginal<typeof import("@/server/_shared")>(), exigirSessaoComPapel: mocks.auth }));
import { ErroAutenticacao, ErroPermissao } from "@/server/_shared";
import { consultarAcertoTaxaPorProposta, listarHistoricoAcertosTaxa, listarAditivosParaAcertoTaxa } from "./aditivo-acerto-taxa-consulta";
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

it("histórico exige acesso antes de ler propostas", async () => {
  mocks.auth.mockRejectedValue(new ErroPermissao());
  expect((await listarHistoricoAcertosTaxa({ matriculaId: "m", propostaId: "p" })).ok).toBe(false);
  expect(mocks.propostas).not.toHaveBeenCalled();
});
it("histórico limita matrícula e aditivo e não oferece autoaprovação", async () => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "u" });
  mocks.usuario.mockResolvedValue({ ativo: true, papeis: ["FINANCEIRO"], permissoes: ["financeiro.aprovar_acertos"] });
  const decimal = { toFixed: () => "80.00" };
  mocks.propostas.mockResolvedValue([{ id: "acerto", status: "PENDENTE", preparadorId: "u", preparador: { nome: "Preparador" }, cobranca: { codigo: "C1", moeda: "BRL" }, criadaEm: new Date("2026-09-01"), evidencia: { texto: "Protocolo conferido" }, fotografia: { cobranca: { valorNegociado: "100.00" } }, valorNovo: decimal, vencimentoNovo: new Date("2026-10-01"), creditoNovo: decimal, decisao: null, aplicacao: null }]);
  const r = await listarHistoricoAcertosTaxa({ matriculaId: "m", propostaId: "p" });
  expect(mocks.propostas).toHaveBeenCalledWith(expect.objectContaining({ where: { matriculaId: "m", propostaAditivoId: "p" } }));
  expect(r).toMatchObject({ ok: true, dado: [{ podeDecidir: false, podeAplicar: false, anterior: { valor: "100.00" } }] });
});
it("lista rejeita página inválida sem consultar versões", async () => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "u" });
  expect((await listarAditivosParaAcertoTaxa(-1)).ok).toBe(false); expect(mocks.versoes).not.toHaveBeenCalled();
});
