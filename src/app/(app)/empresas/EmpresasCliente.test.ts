import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/server/empresas/acoes", () => ({ salvarEmpresa: vi.fn() }));
// useTransition simulado: `pendente.valor` decide se a navegação está em andamento no render.
const pendente = vi.hoisted(() => ({ valor: false }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useTransition: () => [pendente.valor, (f: () => void) => f()] as const };
});

import { EmpresasCliente } from "./EmpresasCliente";
import { EMPRESAS_POR_PAGINA, lerFiltrosEmpresas } from "@/server/empresas/filtros";

const empresa = (i: number) => ({ id: `e${i}`, codigo: `E-${i}`, nome: `Empresa ${i}`, pais: null, ativo: true, colaboradores: 0, faturasAReceber: 0 });
const paises = [{ id: "p1", nome: "Costa Rica" }];
const render = (props: Partial<Parameters<typeof EmpresasCliente>[0]>) =>
  renderToStaticMarkup(createElement(EmpresasCliente, { empresas: [], total: 0, totalBase: 0, filtros: lerFiltrosEmpresas({}), paises, ...props }));

describe("EmpresasCliente (filtros na URL)", () => {
  it("formulário GET de busca com os filtros atuais preenchidos", () => {
    const html = render({ empresas: [empresa(1)], total: 1, totalBase: 1, filtros: lerFiltrosEmpresas({ busca: "acme", situacao: "inativas", pais: "p1" }) });
    expect(html).toMatch(/<form[^>]*action="\/empresas"/);
    expect(html).toContain('role="search"');
    expect(html).toContain('value="acme"');
    expect(html).toContain('<option value="inativas" selected="">Inativas</option>');
    expect(html).toContain('<option value="p1" selected="">Costa Rica</option>');
    expect(html).toContain("Limpar filtros");
  });

  it("estado vazio duplo: nenhuma cadastrada × filtro sem resultado", () => {
    expect(render({ totalBase: 0 })).toContain("Nenhuma empresa ainda.");
    expect(render({ totalBase: 5, filtros: lerFiltrosEmpresas({ situacao: "inativas" }) })).toContain("Nenhuma empresa com esses filtros.");
  });

  it("contador e paginação nos dois sentidos, preservando os filtros", () => {
    const empresas = Array.from({ length: EMPRESAS_POR_PAGINA }, (_, i) => empresa(i));
    const html = render({ empresas, total: 120, totalBase: 300, filtros: lerFiltrosEmpresas({ situacao: "ativas", pagina: "2" }) });
    expect(html).toContain("51–100 de 120 empresas encontradas (de 300 no total)");
    expect(html).toContain('aria-label="Páginas de empresas"');
    // Faturas FECHADAS (emitidas, aguardando pagamento): "a receber", não "em aberto" (que sugere ABERTA).
    expect(html).toContain(">Faturas a receber</th>");
    expect(html).toContain('href="/empresas?situacao=ativas"');
    expect(html).toContain('href="/empresas?situacao=ativas&amp;pagina=3"');
  });

  it("enquanto navega: botão desabilitado com \"Buscando…\" e tabela aria-busy", () => {
    pendente.valor = true;
    try {
      const html = render({ empresas: [empresa(1)], total: 1, totalBase: 1 });
      expect(html).toMatch(/<button type="submit" disabled=""[^>]*>Buscando…<\/button>/);
      expect(html).toContain('aria-busy="true"');
      // Também no estado vazio: o leitor de tela ouve que a região está carregando.
      expect(render({ totalBase: 5, filtros: lerFiltrosEmpresas({ situacao: "inativas" }) })).toMatch(/<div[^>]*aria-busy="true"[^>]*><p>Nenhuma empresa com esses filtros/);
    } finally {
      pendente.valor = false;
    }
  });
});
