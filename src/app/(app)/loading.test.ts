import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// #174 (pendência declarada): na primeira entrada numa área com layout próprio, quem cobre a espera é o
// (app)/loading.tsx — o layout da área ainda não montou, e o loading.tsx dela fica DENTRO dele. Antes, essa
// espera mostrava sempre o esqueleto genérico (título + três blocos), e a tela "saltava" quando o título,
// as abas e o cabeçalho da área chegavam. Agora o genérico olha o caminho de destino e desenha o formato da
// área: título e barra de abas (financeiro, configuração), cabeçalho do registro e abas (matrícula) ou só
// as abas (acadêmico, diário). Um título só, sempre.
const m = vi.hoisted(() => ({ caminho: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => m.caminho }));

import LoadingApp from "./loading";
import { areaDoEsqueleto } from "./esqueleto-area";

const render = (caminho: string) => { m.caminho = caminho; return renderToStaticMarkup(createElement(LoadingApp)); };
const conta = (html: string, marca: string) => html.split(`data-esqueleto="${marca}"`).length - 1;

describe("areaDoEsqueleto — que formato de área o caminho de destino tem", () => {
  it.each([
    ["/financeiro", "financeiro"],
    ["/financeiro/cobrancas", "financeiro"],
    ["/financeiro/aprovacoes", "financeiro"],
    ["/configuracao", "configuracao"],
    ["/configuracao/whatsapp/numeros", "configuracao"],
    ["/matriculas/m1", "matricula"],
    ["/matriculas/m1/preparacao", "matricula"],
    ["/academico", "abas"],
    ["/academico/recuperacoes/planos/p1", "abas"],
    ["/diario/encontros", "abas"],
  ])("%s → %s", (caminho, area) => {
    expect(areaDoEsqueleto(caminho)?.area).toBe(area);
  });

  it.each([
    "/", "/home", "/alunos", "/secretaria",
    "/financeiro/acertos-taxa", "/financeiro/continuidade", // fora do (painel): sem título nem abas de área
    "/matriculas/nova", "/matriculas", "/configuracaox", "/academicos",
  ])("%s → genérico", (caminho) => {
    expect(areaDoEsqueleto(caminho)).toBeNull();
  });
});

describe("(app)/loading.tsx — esqueleto no formato da área de destino", () => {
  it("fora das áreas com layout próprio: o genérico de sempre", () => {
    const html = render("/home");
    expect(html).toContain(">Carregando</p>");
    expect(conta(html, "titulo")).toBe(1);
    expect(conta(html, "abas")).toBe(0);
  });

  it.each([
    ["/financeiro/cobrancas", "Carregando financeiro", 1],
    ["/configuracao/paises", "Carregando configuração", 1],
    ["/matriculas/m1/pagador", "Carregando matrícula", 1],
    ["/academico", "Carregando acadêmico", 1],
    ["/diario", "Carregando diário de aulas", 1],
  ])("%s: anuncia a área, um título e a barra de abas", (caminho, rotulo, abas) => {
    const html = render(caminho);
    expect(html).toMatch(/^<div[^>]*\baria-busy="true"/);
    expect(html).toMatch(new RegExp(`<p(?=[^>]*\\brole="status")[^>]*>${rotulo}</p>`));
    expect(conta(html, "titulo")).toBe(1);
    expect(conta(html, "abas")).toBe(abas);
  });

  it("matrícula: o cabeçalho do registro (código · aluno · estado) vem antes das abas", () => {
    const html = render("/matriculas/m1");
    expect(conta(html, "registro")).toBe(1);
    expect(html.indexOf('data-esqueleto="registro"')).toBeLessThan(html.indexOf('data-esqueleto="abas"'));
  });
});
