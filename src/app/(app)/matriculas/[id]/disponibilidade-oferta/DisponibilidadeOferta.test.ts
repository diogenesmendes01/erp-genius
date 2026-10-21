import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/server/matricula/disponibilidade-oferta", () => ({ consultarDisponibilidadesOferta: vi.fn(), proporDisponibilidadeOferta: vi.fn(), decidirDisponibilidadeOferta: vi.fn() }));
import { DisponibilidadeOferta } from "./DisponibilidadeOferta";
const dados = { pagina: 1, temProxima: false, podePropor: false, propostas: [{ id: "p1", inicio: "2026-10-01", fim: "2026-10-31", versao: 1, motivo: "Continuidade confirmável", evidenciaTexto: "Grade a conferir", criadaEm: "2026-09-16T00:00:00Z", decisao: null, podeDecidir: false }] };
it("consulta sem permissão de mutação não oferece proposta nem decisão", () => {
  const html = renderToStaticMarkup(createElement(DisponibilidadeOferta, { matriculaId: "m1", inicial: dados }));
  expect(html).toContain("Aguardando decisão");
  expect(html).not.toContain("<form");
});
it("mostra período e conferência independente somente quando autorizada", () => {
  const html = renderToStaticMarkup(createElement(DisponibilidadeOferta, { matriculaId: "m1", inicial: { ...dados, podePropor: true, propostas: dados.propostas.map(p => ({ ...p, podeDecidir: true })) } }));
  expect(html).toContain("2026-10-01"); expect(html).toContain("2026-10-31");
  expect(html).toContain("Conferência independente"); expect(html).toContain("Evidências conferidas");
  expect(html).not.toContain("Emitir mensalidade");
});
