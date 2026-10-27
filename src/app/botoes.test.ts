import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("@/server/turmas/acoes", () => ({ criarTurma: async () => ({ ok: true }), editarTurma: async () => ({ ok: true }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ acionarKillSwitchRegua: async () => ({ ok: true }), estimarAlcanceRegua: async () => ({ ok: true }), salvarPoliticaRegua: async () => ({ ok: true }) }));

function pressionados(html: string): { sim: string[]; nao: string[] } {
  const sim: string[] = [];
  const nao: string[] = [];
  for (const m of html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)) (m[1] === "true" ? sim : nao).push(m[2]);
  return { sim, nao };
}

describe("alternâncias anunciam o estado (aria-pressed)", () => {
  it("por renderização: o dia marcado sai com aria-pressed=\"true\", o desmarcado com \"false\", e o conjunto é um grupo rotulado", async () => {
    const { TurmaFormulario } = await import("./(app)/configuracao/turmas/TurmaFormulario");
    const turma = {
      id: "t1", nome: "Turma", modalidadeId: "", nivelId: "", professorId: "", diasSemana: [1, 3], horarioInicio: "08:00", horarioFim: "09:00",
      dataInicio: "", dataFim: "", capacidade: 12, rolling: false,
    };
    const htmlTurma = renderToStaticMarkup(createElement(TurmaFormulario, { turma, modalidades: [], niveis: [], professores: [], onClose: () => {} }));
    expect(pressionados(htmlTurma)).toEqual({ sim: ["Seg", "Qua"], nao: ["Ter", "Qui", "Sex", "Sáb", "Dom"] });
    expect(htmlTurma).toContain('role="group" aria-label="Dias da semana"');

    const { PoliticaPainel } = await import("./(app)/configuracao/whatsapp/PoliticaPainel");
    const politica = {
      id: null, nome: "Cobrança", estado: "DESLIGADA", janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5], tetoPorContatoDia: 1,
      silencioPosInboundHoras: 0, killSwitch: false, numeroRemetenteId: null, degraus: [],
    };
    const htmlPolitica = renderToStaticMarkup(createElement(PoliticaPainel, { politica, numeros: [], templates: [] }));
    expect(pressionados(htmlPolitica)).toEqual({ sim: ["seg", "ter", "qua", "qui", "sex"], nao: ["dom", "sáb"] });
    expect(htmlPolitica).toContain('role="group" aria-label="Dias da semana"');
  });
});
