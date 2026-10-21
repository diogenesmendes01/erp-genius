import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import { MAPA_ESTADOS_VAZIOS } from "@/app/estados-vazios-mapa";
import { EstadoVazio, EstadoVazioLinha } from "./EstadoVazio";

// Segunda trava do estado vazio (a primeira é src/app/estados-vazios.test.ts, com o HTML exato):
// invariantes de design que não dependem de repetir a string do componente, e a contagem de usos
// conferida por outro caminho (texto do fonte, não a árvore sintática).
//
// Cores: resolvidas pelo tailwind.config.ts (docs/18) — o texto do vazio tem de estar num token de
// TEXTO legível (secundário ou primário), nunca no terciário nem num token de borda (o gray-300 é
// a borda de controle: "text-gray-300" seria texto na cor de borda). Vale nos dois temas, porque os
// tokens invertem no .dark.

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
    // Nenhum descendente troca a cor por uma ilegível.
    for (const c of classesDe(html).filter((c) => /^text-gray-\d+$/.test(c))) expect(TEXTO_LEGIVEL.has(tokenDe(c)!), c).toBe(true);
    expect(raiz(html).classes).toContain("text-sm");
  });

  it("as três variantes usam a mesma cor de texto", () => {
    const cor = (html: string) => tokenDe(raiz(html).classes.find((c) => /^text-gray-\d+$/.test(c))!);
    expect(new Set(Object.values(VARIANTES).map(cor)).size).toBe(1);
  });

  it.each(["compacto", "bloco"] as const)("%s: borda tracejada em token de borda, cantos arredondados", (v) => {
    const { classes } = raiz(VARIANTES[v]);
    expect(classes).toContain("border");
    expect(classes).toContain("border-dashed");
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

// Contagem por outro caminho: o texto do fonte (tag de abertura), comparado ao manifesto. Apagar ou
// trocar um EstadoVazio numa tela falha aqui mesmo que a trava de src/app seja removida.
const USOS_DA_MIGRACAO_E1 = 219;

describe("EstadoVazio — usos nas telas", () => {
  const reais: Record<string, number> = {};
  for (const raizDir of ["src/app", "src/components"]) for (const f of readdirSync(raizDir, { recursive: true }) as string[]) {
    if (!f.endsWith(".tsx") || f.includes(".test.")) continue;
    const arquivo = join(raizDir, f).split("\\").join("/");
    if (arquivo === "src/components/EstadoVazio.tsx") continue;
    const n = (readFileSync(arquivo, "utf8").match(/<EstadoVazio(?:Linha)?(?=[\s>/])/g) ?? []).length;
    if (n) reais[arquivo] = n;
  }

  it("cada arquivo tem o número de usos do manifesto", () => {
    const esperado = Object.fromEntries(Object.entries(MAPA_ESTADOS_VAZIOS).map(([a, itens]) => [a, itens.length]));
    expect(reais).toEqual(esperado);
  });

  it(`a migração E1 continua completa (${USOS_DA_MIGRACAO_E1} usos)`, () => {
    expect(Object.values(reais).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(USOS_DA_MIGRACAO_E1);
  });
});
