import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/reserva-comercial", () => ({ consultarTurmasParaReserva: mocks.consulta }));
vi.mock("./ReservarFormulario", () => ({ ReservarFormulario: () => null }));

import ReservaContratacaoPage from "./page";

// Revisão R2 da #134 (B3): página 1 sem turma diz que não há turma compatível; página seguinte diz
// "nesta página" e oferece a volta ao início (a ação faz parte do vazio).
describe("reserva da contratação — vazio paginado", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); });
  const render = async (pagina: number) => {
    mocks.consulta.mockResolvedValue({ ok: true, dado: { matricula: { codigo: "M1" }, reservas: [], prazoMinutos: 60, podeReservar: true, registros: [], pagina, possuiMais: false } });
    return renderToStaticMarkup(await ReservaContratacaoPage({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve(pagina > 1 ? { pagina: String(pagina) } : {}) }));
  };

  it("página 1: não há turma compatível, sem 'nesta página' nem volta", async () => {
    const html = await render(1);
    expect(html).toContain("Nenhuma turma compatível com a contratação.");
    expect(html).not.toContain("nesta página.");
    expect(html).not.toContain("Ir para a primeira página");
  });

  it("página seguinte: 'nesta página' e a volta para a página 1", async () => {
    const html = await render(3);
    expect(html).toContain("Nenhuma turma nesta página.");
    expect(html).toContain('<a href="?pagina=1">Ir para a primeira página</a>');
  });
});
