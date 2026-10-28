import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import { EstadoVazio, EstadoVazioLinha } from "./EstadoVazio";

const cinzas = ((config.theme?.extend?.colors ?? {}) as Record<string, Record<string, string>>).gray;
const TEXTO_LEGIVEL = new Set(["var(--text-secondary)", "var(--text-primary)"]);
const BORDA = new Set(["var(--border)", "var(--border-control)"]);

const classesDe = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
const raiz = (html: string) => {
  const m = html.match(/<(\w+)[^>]*data-estado-vazio=""[^>]*>/);
  if (!m) throw new Error("sem data-estado-vazio: " + html);
  return { tag: m[1], classes: (m[0].match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/) };
};
const tokenDe = (classe: string) => {
  const m = classe.match(/^(?:text|border)-gray-(\d+)$/);
  return m ? cinzas[m[1]] : undefined;
};

const acao = createElement("a", { href: "/novo" }, "Criar");
const emTabela = (linha: ReturnType<typeof EstadoVazioLinha>) => renderToStaticMarkup(createElement("table", null, createElement("tbody", null, linha)));
const VARIANTES = {
  compacto: renderToStaticMarkup(EstadoVazio({ children: "Mensagem." })),
  bloco: renderToStaticMarkup(EstadoVazio({ bloco: true, children: "Mensagem." })),
  linha: emTabela(EstadoVazioLinha({ colSpan: 3, children: "Mensagem." })),
};
const COM_ACAO = {
  compacto: renderToStaticMarkup(EstadoVazio({ acao, children: "Mensagem." })),
  bloco: renderToStaticMarkup(EstadoVazio({ bloco: true, acao, children: "Mensagem." })),
  linha: emTabela(EstadoVazioLinha({ colSpan: 3, acao, children: "Mensagem." })),
};

describe("EstadoVazio — invariantes de design", () => {
  it.each(Object.entries(VARIANTES))("%s: um só marcador data-estado-vazio e a mensagem num <p>", (_, html) => {
    expect(html.match(/data-estado-vazio=""/g)).toHaveLength(1);
    expect(html).toMatch(/<p>Mensagem\.<\/p>/);
  });

  it.each(Object.entries(VARIANTES))("%s: texto em token de texto legível (nem terciário, nem cor de borda), tamanho sm", (_, html) => {
    const cores = raiz(html).classes.filter((c) => /^text-gray-\d+$/.test(c));
    expect(cores).toHaveLength(1);
    expect(TEXTO_LEGIVEL.has(tokenDe(cores[0])!)).toBe(true);
    for (const c of classesDe(html).filter((c) => /^text-gray-\d+$/.test(c))) expect(TEXTO_LEGIVEL.has(tokenDe(c)!), c).toBe(true);
    expect(raiz(html).classes).toContain("text-sm");
  });

  it("as três variantes usam a mesma cor de texto", () => {
    const cor = (html: string) => tokenDe(raiz(html).classes.find((c) => /^text-gray-\d+$/.test(c))!);
    expect(new Set(Object.values(VARIANTES).map(cor)).size).toBe(1);
  });

  it("compacto: superfície suave, sem retângulo tracejado", () => {
    const { classes } = raiz(VARIANTES.compacto);
    expect(classes).toContain("bg-surface-muted");
    expect(classes).toContain("rounded-item");
    expect(classes).not.toContain("border-dashed");
    expect(classes).not.toContain("border-gray-300");
    expect(classes).not.toContain("border");
  });

  it("bloco: borda tracejada em token de borda, cantos arredondados, sem border-gray-300", () => {
    const { classes } = raiz(VARIANTES.bloco);
    expect(classes).toContain("border");
    expect(classes).toContain("border-dashed");
    expect(classes).toContain("border-gray-200");
    expect(classes).toContain("bg-surface-muted");
    expect(classes).not.toContain("border-gray-300");
    const bordas = classes.filter((c) => /^border-gray-\d+$/.test(c));
    expect(bordas).toHaveLength(1);
    expect(BORDA.has(tokenDe(bordas[0])!)).toBe(true);
    expect(classes.some((c) => /^rounded(-\w+)?$/.test(c))).toBe(true);
  });

  it("bloco é centralizado e mais espaçado que o compacto; compacto alinha à esquerda (seção)", () => {
    const bloco = raiz(VARIANTES.bloco).classes, compacto = raiz(VARIANTES.compacto).classes;
    expect(bloco).toContain("text-center");
    expect(compacto).not.toContain("text-center");
    const padding = (cs: string[]) => Math.max(0, ...cs.map((c) => c.match(/^p[xy]?-(\d+)$/)).filter(Boolean).map((m) => Number(m![1])));
    expect(padding(bloco)).toBeGreaterThanOrEqual(6);
    expect(padding(bloco)).toBeGreaterThan(padding(compacto));
  });

  it("linha: uma <tr> com a célula ocupando as colunas pedidas, centralizada", () => {
    expect(VARIANTES.linha).toMatch(/^<table><tbody><tr><td colSpan="3" data-estado-vazio=""/);
    expect(raiz(VARIANTES.linha)).toMatchObject({ tag: "td" });
    expect(raiz(VARIANTES.linha).classes).toContain("text-center");
  });

  it.each(Object.keys(COM_ACAO) as (keyof typeof COM_ACAO)[])("%s: a ação vem depois da mensagem; sem ação, nada extra", (v) => {
    expect(COM_ACAO[v].indexOf("<p>Mensagem.</p>")).toBeLessThan(COM_ACAO[v].indexOf('<a href="/novo">Criar</a>'));
    expect(VARIANTES[v]).not.toContain("<a ");
    expect(VARIANTES[v].match(/<div/g)?.length ?? 0).toBeLessThan(COM_ACAO[v].match(/<div/g)!.length);
  });

  it("className só soma posição; a cor continua a do componente", () => {
    const html = renderToStaticMarkup(EstadoVazio({ className: "mt-4", children: "Mensagem." }));
    expect(raiz(html).classes).toContain("mt-4");
    expect(raiz(html).classes.filter((c) => /^text-gray-\d+$/.test(c))).toEqual(raiz(VARIANTES.compacto).classes.filter((c) => /^text-gray-\d+$/.test(c)));
  });
});
