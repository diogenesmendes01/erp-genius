import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Segmento, Temperatura } from "@prisma/client";

// R1 da #173 (C2): ao editar um lead salvo, "Matrícula prevista" e "Comissão prevista" começam no formato
// do próprio campo ("150,50"), nunca String(150.5) = "150.5", que parseMoeda recusa (ponto ambíguo,
// issue #167). Sem banco: as actions do servidor são dublês.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/comercial/acoes", () => ({ criarLead: vi.fn(), editarLead: vi.fn() }));

import { LeadFormulario, type LeadParaEditar } from "./LeadFormulario";

const lead = (p: Partial<LeadParaEditar>): LeadParaEditar => ({
  id: "lead", nome: "Ana", telefoneE164: "+5511999998888", paisId: "", segmento: Segmento.ADULTO, temperatura: Temperatura.MORNO,
  b2b: false, origemCampanha: "", origemAnuncio: "", valorPrevisto: null, planoPrevisto: "", comissaoPrevista: null, ...p,
});
const render = (l?: LeadParaEditar) =>
  renderToStaticMarkup(createElement(LeadFormulario, { lead: l, paises: [], vendedores: [], podeAtribuir: false, onClose: () => {} }));

const valorDo = (html: string, id: string) =>
  new RegExp(`<input\\b[^>]*\\sid="${id}"[^>]*>`).exec(html)?.[0].match(/\svalue="([^"]*)"/)?.[1];

describe("LeadFormulario — valores previstos do lead salvo (R1 da #173, C2)", () => {
  it("valor e comissão fracionados de 1 a 3 dígitos (150.5, 12.5) começam como 150,50 e 12,50", () => {
    const html = render(lead({ valorPrevisto: 150.5, comissaoPrevista: 12.5 }));
    expect(valorDo(html, "lead-valor-previsto")).toBe("150,50");
    expect(valorDo(html, "lead-comissao-prevista")).toBe("12,50");
    expect(html).not.toContain('value="150.5"');
  });

  it("valor inteiro sai com duas casas (o lead não tem moeda própria)", () => {
    expect(valorDo(render(lead({ valorPrevisto: 1500 })), "lead-valor-previsto")).toBe("1500,00");
  });

  it("sem valor (lead salvo com null, ou lead novo): campo vazio", () => {
    expect(valorDo(render(lead({})), "lead-valor-previsto")).toBe("");
    expect(valorDo(render(), "lead-comissao-prevista")).toBe("");
  });
});
