import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type LeituraDoBranco, misturaDeAlfabetos, textoComparavel, textoLido } from "@/test/texto-lido";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/reserva-comercial", () => ({ consultarTurmasParaReserva: mocks.consulta }));
vi.mock("./ReservarFormulario", () => ({ ReservarFormulario: () => null }));

import ReservaContratacaoPage from "./page";

const TAG = /<[^>]*>/g;
const textoDoHtml = (html: string) => textoLido(html.replace(TAG, " ")).replace(/\s+/g, " ").trim();
const LEITURAS_DO_BRANCO: readonly LeituraDoBranco[] = ["espaco", "nada"];
const leituras = (html: string) => [html.replace(TAG, ""), html.replace(TAG, " ")]
  .flatMap((t: string) => LEITURAS_DO_BRANCO.map((b: LeituraDoBranco) => textoComparavel(t, b).replace(/\s+/g, " ").trim()));
const NESTA_PAGINA = /(?<!\p{L})nesta\s+p[aá]gina(?!\p{L})/iu;
const mostraNestaPagina = (html: string) =>
  leituras(html).some((t: string) => NESTA_PAGINA.test(t) || misturaDeAlfabetos(t).length > 0)
  || misturaDeAlfabetos(textoLido(html.replace(TAG, ""))).length > 0;

describe("reserva da contratação — vazio paginado", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); });
  const render = async (pagina: number) => {
    mocks.consulta.mockResolvedValue({ ok: true, dado: { matricula: { codigo: "M1" }, reservas: [], prazoMinutos: 60, podeReservar: true, registros: [], pagina, possuiMais: false } });
    return renderToStaticMarkup(await ReservaContratacaoPage({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve(pagina > 1 ? { pagina: String(pagina) } : {}) }));
  };

  it("página 1: não há turma compatível, sem 'nesta página' nem volta", async () => {
    const html = await render(1);
    expect(textoDoHtml(html)).toContain("Nenhuma turma compatível com a contratação.");
    expect(mostraNestaPagina(html)).toBe(false);
    expect(textoDoHtml(html)).not.toContain("Ir para a primeira página");
    expect(html).not.toContain("?pagina=1");
  });

  it("página seguinte: 'nesta página' e a volta para a página 1", async () => {
    const html = await render(3);
    expect(textoDoHtml(html)).toContain("Nenhuma turma nesta página.");
    expect(html).toContain('<a href="?pagina=1">Ir para a primeira página</a>');
  });
});
