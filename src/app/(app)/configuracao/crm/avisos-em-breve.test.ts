import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/crm-config/acoes-respostas", () => ({ arquivarRespostaRapidaDaTela: vi.fn(), salvarRespostaRapidaDaTela: vi.fn() }));

import { AVISO_ARIA_EM_BREVE, RespostasPainel } from "./respostas/RespostasPainel";

// C2 da revisão do #233: opções gravadas sem consumidor ainda aparecem como "em breve" na tela.
// O SLA (alertas e contagem só no horário) já tem efeito: a tela não o marca mais (SetorPainel.test.ts).
describe("opções ainda sem efeito avisam na tela", () => {
  it("uso_pela_aria_marcado_em_breve", () => {
    const html = renderToStaticMarkup(createElement(RespostasPainel, { respostas: [], setoresPermitidos: ["COMERCIAL"] }));
    expect(AVISO_ARIA_EM_BREVE).toMatch(/em breve/i);
    expect(html).toContain(AVISO_ARIA_EM_BREVE);
  });
});
