import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Renderização dos indicadores de seleção que saíram de bg-brand-600 para bg-brand-solid (docs/43 §6 item 5):
// chip de dia da TurmaFormulario e da PoliticaPainel e o passo do assistente de matrícula. SubTabs,
// BarraAbasFinanceiro e FichaLead têm o teste no próprio arquivo. A trava estática é src/app/contraste.test.ts.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => "/" }));
vi.mock("@/server/turmas/acoes", () => ({
  criarTurma: async () => ({ ok: true }),
  editarTurma: async () => ({ ok: true }),
  solicitarAberturaTurma: async () => ({ ok: true }),
}));
vi.mock("@/server/whatsapp/acoes", () => ({ acionarKillSwitchRegua: async () => ({ ok: true }), salvarPoliticaRegua: async () => ({ ok: true }) }));
vi.mock("@/server/matricula/acoes", () => ({ criarMatricula: async () => ({ ok: true }) }));

import { TurmaFormulario } from "./(app)/configuracao/turmas/TurmaFormulario";
import { PoliticaPainel } from "./(app)/configuracao/whatsapp/PoliticaPainel";
import { MatriculaFormulario } from "./(app)/matriculas/nova/MatriculaFormulario";

/** Classe de cada <button> com aria-pressed igual ao dado. */
const botoes = (html: string, pressionado: "true" | "false") =>
  [...html.matchAll(/<button\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes(`aria-pressed="${pressionado}"`))
    .map((tag) => tag.match(/\sclass="([^"]*)"/)?.[1] ?? "");

describe("indicadores de seleção com texto: bg-brand-solid, nunca bg-brand-500/600", () => {
  it("TurmaFormulario: dia marcado em bg-brand-solid com texto branco; desmarcado sem fundo da marca", () => {
    const turma = {
      id: "t1", nome: "Turma", modalidadeId: "", nivelId: "", professorId: "", diasSemana: [1, 3], horarioInicio: "08:00", horarioFim: "09:00",
      dataInicio: "", dataFim: "", capacidade: 12, rolling: false,
    };
    const html = renderToStaticMarkup(createElement(TurmaFormulario, { turma, modalidades: [], niveis: [], professores: [], onClose: () => {} }));
    expect(botoes(html, "true")).toEqual(new Array<string>(2).fill("rounded-md border px-3 py-1.5 text-sm border-brand-solid bg-brand-solid text-white"));
    expect(botoes(html, "false")).toHaveLength(5);
    for (const c of botoes(html, "false")) expect(c).not.toMatch(/bg-brand|text-white/);
    expect(html).not.toMatch(/bg-brand-(?:500|600)/);
  });

  it("PoliticaPainel: dia marcado em bg-brand-solid com texto branco; desmarcado sem fundo da marca", () => {
    const politica = {
      id: null, nome: "Cobrança", estado: "DESLIGADA", janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5], tetoPorContatoDia: 1,
      silencioPosInboundHoras: 0, killSwitch: false, numeroRemetenteId: null, degraus: [],
    };
    const html = renderToStaticMarkup(createElement(PoliticaPainel, { politica, numeros: [], templates: [] }));
    expect(botoes(html, "true")).toEqual(new Array<string>(5).fill("rounded-full px-2 py-0.5 text-[11px] bg-brand-solid text-white"));
    expect(botoes(html, "false")).toHaveLength(2);
    for (const c of botoes(html, "false")) expect(c).not.toMatch(/bg-brand|text-white/);
    expect(html).not.toMatch(/bg-brand-(?:500|600)/);
  });

  it("MatriculaFormulario: o passo ativo do assistente em bg-brand-solid com texto branco; o seguinte em neutro", () => {
    const props = {
      podeCriar: true,
      lead: null,
      paises: [{ id: "cr", nome: "Costa Rica", moedaLocal: "CRC", codigoISO: "CR", tiposDocumento: [{ id: "ced", nome: "Cédula" }] }],
      produtos: [{ id: "prod", label: "Inglês" }],
      turmas: [],
      niveis: [],
      precos: [],
    };
    const html = renderToStaticMarkup(createElement(MatriculaFormulario, props));
    const passos = [...html.matchAll(/<span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ([^"]*)">([^<]*)<\/span>/g)].map((m) => [m[2], m[1]]);
    expect(passos).toEqual([
      ["1", "bg-brand-solid text-white"],
      ["2", "bg-gray-100 text-gray-500"],
    ]);
    expect(html).not.toMatch(/bg-brand-(?:500|600)/);
  });
});
