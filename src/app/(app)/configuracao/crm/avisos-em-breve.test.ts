import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/crm-config/acoes-distribuicao", () => ({ salvarConfigSetorDaTela: vi.fn() }));
vi.mock("@/server/crm-config/acoes-respostas", () => ({ arquivarRespostaRapidaDaTela: vi.fn(), salvarRespostaRapidaDaTela: vi.fn() }));

import { AVISO_SLA_EM_BREVE, SetorPainel } from "./distribuicao/SetorPainel";
import { AVISO_ARIA, RespostasPainel } from "./respostas/RespostasPainel";

// C2 da revisão do #233: opções gravadas sem consumidor ainda aparecem como "em breve" na tela.
describe("opções ainda sem efeito avisam na tela", () => {
  it("alertas_e_horario_do_sla_marcados_em_breve", () => {
    const html = renderToStaticMarkup(createElement(SetorPainel, {
      finalidade: "COMERCIAL", rotulo: "Comercial", regra: "MANUAL", participantesIds: [], candidatos: [], prazo: 60,
      alertarResponsavel: true, alertarGerente: false, contarSoNoHorario: true,
    }));
    expect(AVISO_SLA_EM_BREVE).toMatch(/em breve/i);
    expect(html).toContain(AVISO_SLA_EM_BREVE);
  });
  // A Aria passou a ler as respostas marcadas: o aviso deixa de ser "em breve" e explica o efeito.
  it("uso_pela_aria_explica_o_efeito", () => {
    const html = renderToStaticMarkup(createElement(RespostasPainel, { respostas: [], setoresPermitidos: ["COMERCIAL"] }));
    expect(AVISO_ARIA).not.toMatch(/em breve/i);
    expect(AVISO_ARIA).toMatch(/setor/i);
    expect(html).toContain(AVISO_ARIA);
  });
});
