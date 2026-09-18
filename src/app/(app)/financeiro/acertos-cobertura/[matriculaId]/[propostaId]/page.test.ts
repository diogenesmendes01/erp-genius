import { expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const m = vi.hoisted(() => ({ sessao: vi.fn(), preparo: vi.fn(), impactos: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: m.sessao }));
vi.mock("@/server/contratos/aditivo-cobertura-consulta", () => ({ consultarPreparoCoberturaAditivo: m.preparo, consultarImpactosCoberturaAditivo: m.impactos }));
vi.mock("../../ImpactosCoberturaFormulario", () => ({ ImpactosCoberturaFormulario: (p: unknown) => ({ tipo: "preparo", p }) }));
vi.mock("../../ImpactosCoberturaOperacao", () => ({ ImpactosCoberturaOperacao: (p: unknown) => ({ tipo: "operacao", p }) }));
import Page from "./page";

it("protege a rota financeira antes de expor o preparo e a operação", async () => {
  m.preparo.mockResolvedValue({ ok: true, dado: { estado: "PRONTA", conclusaoId: "fim", revisaoHash: "a".repeat(64), cobrancas: [] } }); m.impactos.mockResolvedValue({ ok: true, dado: null });
  const tela = await Page({ params: Promise.resolve({ matriculaId: "m", propostaId: "p" }) });
  expect(m.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR); expect(m.preparo).toHaveBeenCalledWith({ matriculaId: "m", propostaId: "p" }); expect(tela).toBeTruthy();
});
