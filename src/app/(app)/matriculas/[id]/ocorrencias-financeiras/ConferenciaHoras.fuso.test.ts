import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ConferenciaHoras } from "./ConferenciaHoras";

// Lote 2 do fuso pessoal: o horário do encontro é publicado no fuso da agenda e mantém esse fuso; comunicação,
// conferência e aplicação da declaração são instantes de registro e seguem a preferência (sem ela, o da agenda).
// Expectativas fixas: passam em TZ=UTC e America/Sao_Paulo.
const encontro = {
  id: "e1", inicio: "2026-10-21T13:00:00.000Z", fim: "2026-10-21T14:00:00.000Z", fusoOrigem: "America/Sao_Paulo",
  ocorrencia: { id: "o1", versao: 1, tipo: "CANCELAMENTO_ALUNO", evidencia: "ev", comunicadoEm: "2026-10-21T02:30:00.000Z", autor: { nome: "Prof" } },
  conferencia: {
    id: "c1", valor: "50.00", moeda: "BRL", minutos: 60, desfecho: "COBRAVEL", motivo: "conferido", conferidaEm: "2026-10-22T02:45:00.000Z",
    conferente: { nome: "Fin" }, consumoAntecipacao: null, snapshot: null, aplicacaoNaoCobravel: { id: "a1", efeito: "SEM_ITEM", aplicadaEm: "2026-10-23T02:50:00.000Z" },
  },
};
const render = (preferenciaFusoExibicao: string | null) => renderToStaticMarkup(createElement(ConferenciaHoras, {
  encontro: encontro as never, condicoes: [], matricula: { id: "m1", alunoId: "a1", codigo: "M-1" } as never, preferenciaFusoExibicao,
}));

describe("ConferenciaHoras: instante no fuso pessoal, horário do encontro no fuso da agenda", () => {
  it("com preferência: registros no fuso pessoal; encontro no fuso da agenda", () => {
    const html = render("Asia/Tokyo");
    expect(html).toContain("21/10/2026, 10:00 — 21/10/2026, 11:00 · America/Sao_Paulo");
    expect(html).toContain("Comunicação: 21/10/2026, 11:30 (Asia/Tokyo) (na agenda: 20/10/2026, 23:30, America/Sao_Paulo)");
    expect(html).toContain("Fin · 22/10/2026, 11:45 (Asia/Tokyo)");
    expect(html).toContain("Declaração aplicada em 23/10/2026, 11:50 (Asia/Tokyo)");
  });

  it("sem preferência: registros no fuso da agenda, com o fuso dito", () => {
    const html = render(null);
    expect(html).toContain("Comunicação: 20/10/2026, 23:30 (America/Sao_Paulo)");
    expect(html).not.toContain("na agenda");
    expect(html).toContain("Fin · 21/10/2026, 23:45 (America/Sao_Paulo)");
    expect(html).toContain("Declaração aplicada em 22/10/2026, 23:50 (America/Sao_Paulo)");
  });

  // Review do #289 (item E): a comunicação é comparada com o limite de cancelamento, que está no fuso da agenda.
  it("comunicação também no fuso da agenda quando o exibido difere; preferência igual à agenda não repete", () => {
    expect(render("Asia/Tokyo")).toContain("(na agenda: 20/10/2026, 23:30, America/Sao_Paulo)");
    const igual = render("America/Sao_Paulo");
    expect(igual).toContain("Comunicação: 20/10/2026, 23:30 (America/Sao_Paulo)</p>");
    expect(igual).not.toContain("na agenda");
  });
});
