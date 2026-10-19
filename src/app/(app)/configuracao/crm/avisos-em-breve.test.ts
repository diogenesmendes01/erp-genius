import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/crm-config/acoes-respostas", () => ({ arquivarRespostaRapidaDaTela: vi.fn(), salvarRespostaRapidaDaTela: vi.fn() }));

import { AVISO_ARIA, RespostasPainel } from "./respostas/RespostasPainel";

// C2 da revisão do #233: opções gravadas sem consumidor ainda aparecem como "em breve" na tela.
// O SLA (alertas e contagem só no horário) já tem efeito: a tela não o marca mais (SetorPainel.test.ts).
describe("opções ainda sem efeito avisam na tela", () => {
  // A Aria passou a ler as respostas marcadas: o aviso deixa de ser "em breve" e explica o efeito.
  it("uso_pela_aria_explica_o_efeito", () => {
    const html = renderToStaticMarkup(createElement(RespostasPainel, { respostas: [], setoresPermitidos: ["COMERCIAL"] }));
    expect(AVISO_ARIA).not.toMatch(/em breve/i);
    expect(AVISO_ARIA).toMatch(/setor/i);
    // C3 da R1 do #238: hoje a Aria só atua no Comercial; marcada em outro setor ainda não tem efeito.
    expect(AVISO_ARIA).toMatch(/só atua no Comercial/);
    expect(AVISO_ARIA).toMatch(/outros setores.*ainda não têm efeito/);
    expect(html).toContain(AVISO_ARIA);
  });
});
