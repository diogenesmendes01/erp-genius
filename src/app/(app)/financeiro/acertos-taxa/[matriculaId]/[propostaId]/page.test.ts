import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
const m = vi.hoisted(() => ({ guard: vi.fn(), previa: vi.fn(), historico: vi.fn(), impactos: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: m.guard }));
vi.mock("@/server/contratos/aditivo-acerto-taxa-consulta", () => ({ consultarAcertoTaxaPorProposta: m.previa, listarHistoricoAcertosTaxa: m.historico }));
vi.mock("@/server/contratos/aditivo-taxa-impactos", () => ({ consultarImpactosTaxaAditivo: m.impactos }));
vi.mock("@/app/(app)/matriculas/[id]/contrato/aditivos/ImpactosTaxaFormulario", () => ({ ImpactosTaxaFormulario: () => createElement("div", null, "Preparar conjunto") }));
vi.mock("@/app/(app)/matriculas/[id]/contrato/aditivos/AcertoTaxaFormulario", () => ({ AcertoTaxaFormulario: () => createElement("div", null, "Preparar acerto") }));
vi.mock("../../DecisaoTaxa", () => ({ DecisaoTaxa: () => null }));
vi.mock("../../ImpactosTaxaOperacao", () => ({ ImpactosTaxaOperacao: ({ reprepararHref }: { reprepararHref: string }) => createElement("a", { href: reprepararHref }, "Reconferir") }));
import Page from "./page";

it("mantém o preparo e a reconstrução na rota do Financeiro, com consulta da matrícula correta", async () => {
  m.guard.mockResolvedValue({ id: "financeiro", papeis: [Papel.FINANCEIRO] });
  m.previa.mockResolvedValue({ ok: true, dado: { estado: "PRONTA_PARA_SELECAO", conclusaoId: "conclusao", revisaoHash: "hash", cobrancas: [] } });
  m.historico.mockResolvedValue({ ok: true, dado: [] });
  m.impactos.mockResolvedValue({ ok: true, dado: null });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ matriculaId: "m1", propostaId: "p1" }) }));
  expect(m.guard).toHaveBeenCalledWith(Papel.FINANCEIRO);
  expect(m.impactos).toHaveBeenCalledWith({ matriculaId: "m1", propostaId: "p1" });
  expect(html).toContain('id="preparar-impactos"');
  expect(html).toContain('href="/financeiro/acertos-taxa/m1/p1#preparar-impactos"');
  expect(html).toContain("Preparar conjunto");
  expect(html).not.toContain('href="/matriculas/');
});
