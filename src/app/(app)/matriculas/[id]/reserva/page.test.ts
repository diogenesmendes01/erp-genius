import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textoComparavel, textoLido } from "@/test/texto-lido";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/reserva-comercial", () => ({ consultarTurmasParaReserva: mocks.consulta }));
vi.mock("./ReservarFormulario", () => ({ ReservarFormulario: () => null }));

import ReservaContratacaoPage from "./page";

const TAG = /<[^>]*>/g;
/** Texto que a pessoa lê no HTML, para mostrar e conferir o que deve aparecer: tags como espaço. */
const textoDoHtml = (html: string) => textoLido(html.replace(TAG, " ")).replace(/\s+/g, " ").trim();
/**
 * As leituras do HTML para conferir o que NÃO pode aparecer (revisão R3 da #134, B2; R1 da #147, B1/B2): a
 * tag pode separar palavras (bloco, `<br>`) ou não (inline: `nes<span>ta</span>`, `nes<wbr>ta`) — vale
 * cada uma. Entidades decodificadas, invisíveis (classe Cf, seletores de variação) tirados, NFKC e
 * homóglifos como a letra latina (src/test/texto-lido.ts).
 */
const leituras = (html: string) => [html.replace(TAG, ""), html.replace(TAG, " ")].map((t) => textoComparavel(t).replace(/\s+/g, " ").trim());
/** "nesta página" em qualquer caixa, com ou sem acento. */
const NESTA_PAGINA = /(?<!\p{L})nesta\s+p[aá]gina(?!\p{L})/iu;
const mostraNestaPagina = (html: string) => leituras(html).some((t) => NESTA_PAGINA.test(t));

// Revisão R2 da #134 (B3): página 1 sem turma diz que não há turma compatível; página seguinte diz
// "nesta página" e oferece a volta ao início (a ação faz parte do vazio). Revisão R3 (B2): a comparação
// é sobre o texto lido, não sobre o HTML literal — `<strong>` ou `&nbsp;` no meio não escapam.
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
    // Nenhuma ação de paginação no vazio da página 1 (R1 da #147, C2).
    expect(html).not.toContain("?pagina=1");
  });

  it("página seguinte: 'nesta página' e a volta para a página 1", async () => {
    const html = await render(3);
    expect(textoDoHtml(html)).toContain("Nenhuma turma nesta página.");
    expect(html).toContain('<a href="?pagina=1">Ir para a primeira página</a>');
  });

  it("autoteste (R3 da #134, B2; R1 da #147, B1/B2/B3/B5): nada no meio esconde 'nesta página'", () => {
    const formas = [
      "<p>Nenhuma turma nesta <strong>página</strong>.</p>",
      "<p>Nenhuma turma <em>nesta</em> página.</p>",
      "<p>Nenhuma turma nes<wbr>ta página.</p>",
      "<p>Nenhuma turma nes<wbr/>ta página.</p>",
      "<p>Nenhuma turma <span>nes</span>ta página.</p>",
      "<p>Nenhuma turma n<b>esta</b> p<i>ágina</i>.</p>",
      "<p>Nenhuma turma nesta&nbsp;página.</p>",
      "<p>Nenhuma turma nesta&#160;página.</p>",
      "<p>Nenhuma turma nesta&#xA0;página.</p>",
      "<p>Nenhuma turma nesta\u00a0página.</p>",
      "<p>Nenhuma turma nes&shy;ta página.</p>",
      "<p>Nenhuma turma nes&lrm;ta página.</p>",
      "<p>Nenhuma turma nesta \u200epágina.</p>",
      "<p>Nenhuma turma nes\u200fta página.</p>",
      "<p>Nenhuma turma nes\ufe0fta página.</p>",
      "<p>Nenhuma turma nes\u200bta página.</p>",
      "<p>Nenhuma turma nesta p&aacute;gina.</p>",
      "<p>Nenhuma turma nesta pa\u0301gina.</p>",
      "<p>Nenhuma turma nesta p\u0430gina.</p>",
      "<p>Nenhuma turma \uff4e\uff45\uff53\uff54\uff41 página.</p>",
      "<p>NENHUMA TURMA NESTA PÁGINA.</p>",
      "<p>Nenhuma turma nesta pagina.</p>",
    ];
    for (const html of formas) expect(mostraNestaPagina(html), html).toBe(true);
    // Não confunde: outra palavra depois de "nesta", plural, "primeira página", blocos separados.
    for (const html of ["<p>Nenhuma turma nesta consulta.</p>", "<p>Nenhuma turma nestas páginas.</p>", "<a>Ir para a primeira página</a>"]) {
      expect(mostraNestaPagina(html), html).toBe(false);
    }
  });
});
