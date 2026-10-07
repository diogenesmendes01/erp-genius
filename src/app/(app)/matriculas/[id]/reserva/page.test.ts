import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/reserva-comercial", () => ({ consultarTurmasParaReserva: mocks.consulta }));
vi.mock("./ReservarFormulario", () => ({ ReservarFormulario: () => null }));

import ReservaContratacaoPage from "./page";

const ENTIDADES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", shy: "" };
/**
 * Texto que a pessoa lê no HTML (revisão R3 da #134, B2): sem tags (`nesta <strong>página</strong>`),
 * entidades decodificadas (`&nbsp;`, `&#160;`, `&#xA0;`), acento composto, sem caractere invisível e com
 * todo espaço — inclusive o não separável — como um espaço só.
 */
export function textoLidoDoHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, c: string) => {
      if (c[0] !== "#") return ENTIDADES[c.toLowerCase()] ?? m;
      const n = c[1] === "x" || c[1] === "X" ? parseInt(c.slice(2), 16) : Number(c.slice(1));
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    })
    .normalize("NFC")
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
/** "nesta página" em qualquer caixa, com ou sem acento. */
const NESTA_PAGINA = /(?<!\p{L})nesta\s+p[aá]gina(?!\p{L})/iu;

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
    const texto = textoLidoDoHtml(await render(1));
    expect(texto).toContain("Nenhuma turma compatível com a contratação.");
    expect(texto).not.toMatch(NESTA_PAGINA);
    expect(texto).not.toContain("Ir para a primeira página");
  });

  it("página seguinte: 'nesta página' e a volta para a página 1", async () => {
    const html = await render(3);
    expect(textoLidoDoHtml(html)).toContain("Nenhuma turma nesta página.");
    expect(html).toContain('<a href="?pagina=1">Ir para a primeira página</a>');
  });

  it("autoteste (R3 da #134, B2): tag, entidade e espaço não separável no meio não escondem 'nesta página'", () => {
    const formas = [
      "<p>Nenhuma turma nesta <strong>página</strong>.</p>",
      "<p>Nenhuma turma <em>nesta</em> página.</p>",
      "<p>Nenhuma turma nesta&nbsp;página.</p>",
      "<p>Nenhuma turma nesta&#160;página.</p>",
      "<p>Nenhuma turma nesta&#xA0;página.</p>",
      "<p>Nenhuma turma nesta\u00a0página.</p>",
      "<p>Nenhuma turma nes&shy;ta página.</p>",
      "<p>Nenhuma turma nes\u200bta página.</p>",
      "<p>Nenhuma turma nesta pa\u0301gina.</p>",
      "<p>NENHUMA TURMA NESTA PÁGINA.</p>",
      "<p>Nenhuma turma nesta pagina.</p>",
    ];
    for (const html of formas) expect(textoLidoDoHtml(html), html).toMatch(NESTA_PAGINA);
    // Não confunde: outra palavra depois de "nesta", plural, "primeira página".
    for (const html of ["<p>Nenhuma turma nesta consulta.</p>", "<p>Nenhuma turma nestas páginas.</p>", "<a>Ir para a primeira página</a>"]) {
      expect(textoLidoDoHtml(html), html).not.toMatch(NESTA_PAGINA);
    }
  });
});
