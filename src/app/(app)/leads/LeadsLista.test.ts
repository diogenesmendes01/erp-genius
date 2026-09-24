import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EtapaLead, Segmento, Temperatura } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
// useTransition simulado: `pendente.valor` decide se a navegação está em andamento no render.
const pendente = vi.hoisted(() => ({ valor: false }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useTransition: () => [pendente.valor, (f: () => void) => f()] as const };
});
vi.mock("./LeadFormulario", () => ({ LeadFormulario: () => null }));

import { LeadsLista, type LeadRow } from "./LeadsLista";
import { LEADS_POR_PAGINA, lerFiltrosLeads } from "@/server/comercial/filtros";

const lead = (i: number): LeadRow => ({
  id: `l${i}`, codigo: `L-${i}`, nome: `Lead ${i}`, telefoneE164: null, segmento: Segmento.ADULTO,
  temperatura: Temperatura.MORNO, etapa: EtapaLead.NOVO, b2b: false, pais: null, vendedor: null,
});
const render = (props: Partial<Parameters<typeof LeadsLista>[0]>) =>
  renderToStaticMarkup(createElement(LeadsLista, {
    leads: [], total: 0, totalBase: 0, filtros: lerFiltrosLeads({}), donos: [], paises: [], vendedores: [], podeAtribuir: false, ...props,
  }));

describe("LeadsLista (filtros na URL)", () => {
  it("formulário de busca GET com os filtros atuais preenchidos", () => {
    const html = render({ leads: [lead(1)], total: 1, totalBase: 1, filtros: lerFiltrosLeads({ busca: "ana", etapa: "NOVO", tipo: "b2b" }) });
    expect(html).toMatch(/<form[^>]*action="\/leads"/);
    expect(html).toContain('role="search"');
    expect(html).toContain('value="ana"');
    expect(html).toContain('<option value="b2b" selected="">');
    expect(html).toMatch(/<option value="NOVO" selected="">/);
    expect(html).toContain("Limpar filtros");
  });

  it("filtro por dono só aparece com opções (gerente/admin)", () => {
    expect(render({})).not.toContain('aria-label="Filtrar por dono"');
    const html = render({ donos: [{ id: "v1", nome: "Bia" }], filtros: lerFiltrosLeads({ dono: "v1" }) });
    expect(html).toContain('aria-label="Filtrar por dono"');
    expect(html).toContain('<option value="v1" selected="">Bia</option>');
  });

  it("estado vazio duplo: carteira vazia × filtro sem resultado", () => {
    expect(render({ totalBase: 0 })).toContain("Nenhum lead na sua carteira.");
    const filtrado = render({ totalBase: 7, filtros: lerFiltrosLeads({ etapa: "NOVO" }) });
    expect(filtrado).toContain("Nenhum lead com esses filtros.");
  });

  it("contador e paginação bidirecional preservando os filtros", () => {
    const leads = Array.from({ length: LEADS_POR_PAGINA }, (_, i) => lead(i));
    const html = render({ leads, total: 120, totalBase: 300, filtros: lerFiltrosLeads({ etapa: "NOVO", pagina: "2" }) });
    expect(html).toContain("51–100 de 120 leads encontrados (de 300 no total)");
    expect(html).toContain('href="/leads?etapa=NOVO"'); // anterior = página 1, sem `pagina`
    expect(html).toContain('href="/leads?etapa=NOVO&amp;pagina=3"');
  });

  it("enquanto navega: botão desabilitado com \"Buscando…\" e tabela aria-busy", () => {
    pendente.valor = true;
    try {
      const html = render({ leads: [lead(1)], total: 1, totalBase: 1 });
      expect(html).toMatch(/<button type="submit" disabled=""[^>]*>Buscando…<\/button>/);
      expect(html).toContain('aria-busy="true"');
    } finally {
      pendente.valor = false;
    }
  });
});
