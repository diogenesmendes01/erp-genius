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

// Captura as opções passadas a useFiltrosUrl (o caminho com JavaScript: buscar/filtrar navega pelo
// hrefDosCampos da tela) — revisão R1 da #136, B5.
const capturado = vi.hoisted(() => ({ opcoes: [] as { campos: Record<string, string>; hrefDosCampos: (c: Record<string, string>) => string }[] }));
vi.mock("@/lib/filtros-url", async (original) => {
  const real = await original<typeof import("@/lib/filtros-url")>();
  return { ...real, useFiltrosUrl: (o: Parameters<typeof real.useFiltrosUrl>[0]) => { capturado.opcoes.push(o as never); return real.useFiltrosUrl(o); } };
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

  it("cabeçalhos ordenáveis (E1): sem ordem na URL nenhum marcado; links levam os filtros e voltam à página 1", () => {
    const html = render({ empresas: [empresa(1)], total: 60, totalBase: 60, filtros: lerFiltrosEmpresas({ situacao: "ativas", pagina: "2" }) });
    expect(html).not.toContain("aria-sort"); // nenhuma coluna ordenada: a ordem padrão é "mais recentes primeiro"
    expect(html).toMatch(/<a [^>]*href="\/empresas\?situacao=ativas&amp;ordem=codigo&amp;dir=asc"[^>]*>Código</);
    expect(html).toMatch(/<a [^>]*href="\/empresas\?situacao=ativas&amp;ordem=nome&amp;dir=asc"[^>]*>Empresa</);
    // Contagem começa do maior no primeiro clique.
    expect(html).toMatch(/<a [^>]*href="\/empresas\?situacao=ativas&amp;ordem=colaboradores&amp;dir=desc"[^>]*>Colaboradores</);
    expect(html).toMatch(/<a [^>]*href="\/empresas\?situacao=ativas&amp;ordem=situacao&amp;dir=asc"[^>]*>Status</);
    // País (sem relação para ordenar) e faturas a receber (contagem filtrada) não ordenam.
    expect(html).toContain('<th class="px-4 py-2 font-medium">País</th>');
    expect(html).not.toContain('type="hidden"');
  });

  it("ordem escolhida: coluna marcada; paginação, limpar e formulário sem JavaScript mantêm a ordem", () => {
    const empresas = Array.from({ length: EMPRESAS_POR_PAGINA }, (_, i) => empresa(i));
    const html = render({ empresas, total: 120, totalBase: 300, filtros: lerFiltrosEmpresas({ busca: "acme", ordem: "colaboradores", dir: "desc", pagina: "2" }) });
    expect(html).toMatch(/aria-sort="descending"[^>]*><a [^>]*href="\/empresas\?busca=acme&amp;ordem=colaboradores&amp;dir=asc"[^>]*>Colaboradores</);
    expect(html.match(/aria-sort="/g)).toHaveLength(1);
    expect(html).toContain('href="/empresas?busca=acme&amp;ordem=colaboradores&amp;dir=desc&amp;pagina=3"');
    expect(html).toMatch(/<a[^>]*href="\/empresas\?ordem=colaboradores&amp;dir=desc"[^>]*>Limpar filtros<\/a>/);
    expect(html).toContain('<input type="hidden" name="ordem" value="colaboradores"/>');
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

describe("EmpresasCliente: a ordem escolhida sobrevive à busca, ao formulário sem JS e à volta ao início (R1 da #136, B5)", () => {
  it("buscar/filtrar com JavaScript leva ordem e direção", () => {
    render({ empresas: [empresa(1)], total: 1, totalBase: 1, filtros: lerFiltrosEmpresas({ ordem: "colaboradores", dir: "desc" }) });
    const o = capturado.opcoes.at(-1)!;
    const href = o.hrefDosCampos({ ...o.campos, busca: "acme" });
    expect(href).toContain("busca=acme");
    expect(href).toContain("ordem=colaboradores&dir=desc");
  });

  it("formulário sem JavaScript: ordem e direção em campos ocultos (decrescente não vira crescente)", () => {
    const html = render({ empresas: [empresa(1)], total: 1, totalBase: 1, filtros: lerFiltrosEmpresas({ ordem: "colaboradores", dir: "desc" }) });
    expect(html).toContain('<input type="hidden" name="ordem" value="colaboradores"/>');
    expect(html).toContain('<input type="hidden" name="dir" value="desc"/>');
  });

  it("página além do fim: \"Ir para a primeira página\" mantém a ordem", () => {
    const html = render({ empresas: [], total: 5, totalBase: 5, filtros: lerFiltrosEmpresas({ ordem: "nome", dir: "desc", pagina: "3" }) });
    // Exatamente a página 1 (sem `pagina`), mantendo a ordem — R2 da #136, B8.
    expect(html).toMatch(new RegExp('<a[^>]*href="/empresas[?]ordem=nome&amp;dir=desc"[^>]*>Ir para a primeira página</a>'));
  });
});
