import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CLASSES_TOM } from "@/components/BadgeEstado";
import { CONTROLE_CAMPO } from "@/components/Campo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/server/empresas/acoes", () => ({ salvarEmpresa: vi.fn() }));
const pendente = vi.hoisted(() => ({ valor: false }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useTransition: () => [pendente.valor, (f: () => void) => f()] as const };
});

const capturado = vi.hoisted(() => ({ opcoes: [] as { campos: Record<string, string>; hrefDosCampos: (c: Record<string, string>) => string }[] }));
vi.mock("@/lib/filtros-url", async (original) => {
  const real = await original<typeof import("@/lib/filtros-url")>();
  return { ...real, useFiltrosUrl: (o: Parameters<typeof real.useFiltrosUrl>[0]) => {
    capturado.opcoes.push(o as never);
    const r = real.useFiltrosUrl(o);
    return { ...r, aoClicar: (href: string) => Object.assign(r.aoClicar(href), { navegaPara: href }) };
  } };
});
const links = vi.hoisted(() => ({ lista: [] as { href: string; texto: string; onClick?: { navegaPara?: string } }[] }));
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  const texto = (c: unknown): string => typeof c === "string" ? c : Array.isArray(c) ? c.map(texto).join("") : "";
  return { default: ({ href, onClick, children, ...resto }: { href: string; onClick?: { navegaPara?: string }; children?: unknown }) => {
    links.lista.push({ href: String(href), texto: texto(children), onClick });
    return h("a", { href, ...resto }, children as never);
  } };
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
    expect(html).toContain(">Inativas<");
    expect(html).toContain('<input type="hidden" name="situacao" value="inativas"/>');
    expect(html).toContain(">Costa Rica<");
    expect(html).toContain('<input type="hidden" name="pais" value="p1"/>');
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
    expect(html).toContain(">Faturas a receber</th>");
    expect(html).toContain('href="/empresas?situacao=ativas"');
    expect(html).toContain('href="/empresas?situacao=ativas&amp;pagina=3"');
  });

  it("cabeçalhos ordenáveis (E1): sem ordem na URL nenhum marcado; links levam os filtros e voltam à página 1", () => {
    const html = render({ empresas: [empresa(1)], total: 60, totalBase: 60, filtros: lerFiltrosEmpresas({ situacao: "ativas", pagina: "2" }) });
    expect(html).not.toContain("aria-sort");
    expect(html).toMatch(/<a [^>]*href="\/empresas\?situacao=ativas&amp;ordem=codigo&amp;dir=asc"[^>]*>Código</);
    expect(html).toMatch(/<a [^>]*href="\/empresas\?situacao=ativas&amp;ordem=nome&amp;dir=asc"[^>]*>Empresa</);
    expect(html).toMatch(/<a [^>]*href="\/empresas\?situacao=ativas&amp;ordem=colaboradores&amp;dir=desc"[^>]*>Colaboradores</);
    expect(html).toMatch(/<a [^>]*href="\/empresas\?situacao=ativas&amp;ordem=situacao&amp;dir=asc"[^>]*>Status</);
    expect(html).toContain(">País</th>");
    expect(html).toContain('<input type="hidden" name="situacao" value="ativas"/>');
    expect(html).toContain('<input type="hidden" name="pais" value=""/>');
    expect(html).not.toContain('name="ordem"');
    expect(html).not.toContain('name="dir"');
  });

  it("ordem escolhida: coluna marcada; paginação, limpar e formulário sem JavaScript mantêm a ordem", () => {
    const empresas = Array.from({ length: EMPRESAS_POR_PAGINA }, (_, i) => empresa(i));
    const html = render({ empresas, total: 120, totalBase: 300, filtros: lerFiltrosEmpresas({ busca: "acme", ordem: "colaboradores", dir: "desc", pagina: "2" }) });
    expect(html).toMatch(/aria-sort="descending"[^>]*><a [^>]*href="\/empresas\?busca=acme&amp;ordem=colaboradores&amp;dir=asc"[^>]*>Colaboradores</);
    expect(html.match(/aria-sort="/g)).toHaveLength(1);
    expect(html).toContain('href="/empresas?busca=acme&amp;ordem=colaboradores&amp;dir=desc&amp;pagina=3"');
    expect(html).toMatch(/<a[^>]*href="\/empresas\?ordem=colaboradores&amp;dir=desc"[^>]*>Limpar filtros<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/empresas\?busca=acme"[^>]*>Voltar à ordem padrão<\/a>/);
    expect(html).toContain('<input type="hidden" name="ordem" value="colaboradores"/>');
  });

  it("enquanto navega: botão desabilitado com \"Buscando…\" e tabela aria-busy", () => {
    pendente.valor = true;
    try {
      const html = render({ empresas: [empresa(1)], total: 1, totalBase: 1 });
      expect(html).toMatch(/<button type="submit" disabled=""[^>]*>Buscando…<\/button>/);
      expect(html).toContain('aria-busy="true"');
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
    expect(html).toMatch(new RegExp('<a[^>]*href="/empresas[?]ordem=nome&amp;dir=desc"[^>]*>Ir para a primeira página</a>'));
  });
});

describe("EmpresasCliente: com JavaScript, o clique de cada link vai para o MESMO href do link (R3 da #136, B10)", () => {
  const cliques = (props: Parameters<typeof render>[0]) => {
    links.lista = [];
    render(props);
    return links.lista;
  };
  const CASOS: [nome: string, props: Parameters<typeof render>[0], esperados: string[]][] = [
    ["página além do fim, com ordem: \"Ir para a primeira página\"", { empresas: [], total: 5, totalBase: 5, filtros: lerFiltrosEmpresas({ ordem: "nome", dir: "desc", pagina: "3" }) }, ["Ir para a primeira página"]],
    ["filtro sem resultado: os dois \"Limpar filtros\" (barra e vazio)", { empresas: [], total: 0, totalBase: 5, filtros: lerFiltrosEmpresas({ busca: "x", ordem: "nome", dir: "desc" }) }, ["Limpar filtros"]],
    ["lista com resultados e ordem: colunas, paginação e limpar", { empresas: [empresa(1)], total: EMPRESAS_POR_PAGINA * 3, totalBase: EMPRESAS_POR_PAGINA * 3, filtros: lerFiltrosEmpresas({ busca: "e", ordem: "colaboradores", dir: "desc", pagina: "2" }) }, ["Código", "Empresa", "Colaboradores", "Limpar filtros"]],
  ];
  for (const [nome, props, esperados] of CASOS) {
    it(nome, () => {
      const lista = cliques(props);
      const daLista = lista.filter((l) => l.href === "/empresas" || l.href.startsWith("/empresas?"));
      expect(daLista.filter((l) => !l.onClick).map((l) => `${l.texto} ${l.href}`), "link da lista sem clique na transição").toEqual([]);
      expect(daLista.filter((l) => l.onClick?.navegaPara !== l.href).map((l) => `${l.texto}: href ${l.href} · clique ${l.onClick?.navegaPara}`)).toEqual([]);
      for (const texto of esperados) expect(daLista.some((l) => l.texto === texto), texto).toBe(true);
    });
  }
});

describe("EmpresasCliente · design system", () => {
  it("a fonte usa os primitivos e não traz borda cinza nem badge ad-hoc", () => {
    const fonte = readFileSync("src/app/(app)/empresas/EmpresasCliente.tsx", "utf8");
    expect(fonte).toContain("Avatar");
    expect(fonte).toContain("BadgeEstado");
    expect(fonte).toContain("CONTROLE_CAMPO");
    expect(fonte).toContain("LinhaCampo");
    expect(fonte).toContain("font-mono");
    expect(fonte).toContain("tabular-nums");
    expect(fonte).not.toContain("border-gray-300");
    for (const cor of ["bg-green-100", "bg-amber-100", "bg-blue-100", "bg-red-100", "bg-yellow-100"]) {
      expect(fonte).not.toContain(cor);
    }
  });

  it("filtros, código, empresa e status usam controle, avatar, badge e mono", () => {
    const html = render({
      empresas: [
        { ...empresa(1), nome: "Acme Brasil", codigo: "E-9", ativo: true, colaboradores: 12, faturasAReceber: 3, pais: "Costa Rica" },
        { ...empresa(2), nome: "Beta Leste", codigo: null, ativo: false, colaboradores: 0, faturasAReceber: 1, pais: null },
      ],
      total: 2,
      totalBase: 2,
    });
    expect(html).toContain(CONTROLE_CAMPO);
    expect(html).toContain("font-mono");
    expect(html).toContain("tabular-nums");
    expect(html).toContain(">AB<");
    expect(html).toContain(">BL<");
    expect(html).toContain("#E-9");
    expect(html).toContain(CLASSES_TOM.sucesso);
    expect(html).toContain(CLASSES_TOM.neutro);
    expect(html).toContain("Ativa");
    expect(html).toContain("Inativa");
    expect(html).toContain("País");
    expect(html).toContain('href="/empresas/e1"');
    expect(html).toContain("bg-surface-muted");
    expect(html).toContain("hover:bg-surface-muted");
    expect(html).not.toContain("border-gray-300");
    expect(html).not.toContain("bg-green-100");
  });
});
