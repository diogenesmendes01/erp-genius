import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampoFuso, FUSOS_SUGERIDOS, fusosCanonicos, todosOsFusos, validadeDoFuso } from "./CampoFuso";
import { APELIDOS_FUSO_LEGADOS, fusoIanaValido, MSG_FUSO_NAO_RECONHECIDO } from "@/server/operacao/fuso";

describe("CampoFuso", () => {
  it("pré-preenche com o fuso institucional quando ele existe", () => {
    const html = renderToStaticMarkup(createElement(CampoFuso, { padrao: "America/Sao_Paulo", className: "campo" }));
    expect(html).toContain('value="America/Sao_Paulo"');
    expect(html).not.toContain('value="UTC"');
  });

  it("sem fuso institucional configurado, fica vazio em vez de assumir um fuso plausível-mas-errado", () => {
    const html = renderToStaticMarkup(createElement(CampoFuso, { padrao: "", className: "campo" }));
    expect(html).toMatch(/<input[^>]*value=""/);
    expect(html).not.toContain('value="UTC"');
  });

  it("gera um datalist id próprio por instância na mesma árvore, mesmo com o mesmo name", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(CampoFuso, { padrao: "", name: "fuso", className: "campo" }),
      createElement(CampoFuso, { padrao: "", name: "fuso", className: "campo" }),
    ));
    const listaIds = [...html.matchAll(/list="([^"]+)"/g)].map(m => m[1]);
    expect(listaIds).toHaveLength(2);
    expect(listaIds[0]).not.toBe(listaIds[1]);
  });

  // docs/43 §6 item 6: a validação é a do servidor (fusoIanaValido), no próprio campo, sem o jargão "IANA".
  it("validade: vazio fica com o required nativo; fuso IANA passa; texto livre que não é fuso recebe a mensagem", () => {
    expect(validadeDoFuso("")).toBe("");
    expect(validadeDoFuso("  ")).toBe("");
    expect(validadeDoFuso("America/Sao_Paulo")).toBe("");
    expect(validadeDoFuso(" America/Costa_Rica ")).toBe("");
    expect(validadeDoFuso("UTC")).toBe("");
    for (const errado of ["America/Sao Paulo", "America/SaoPaulo", "GMT-3", "+03:00", "Brasil"]) expect(validadeDoFuso(errado), errado).toBe(MSG_FUSO_NAO_RECONHECIDO);
    expect(MSG_FUSO_NAO_RECONHECIDO).not.toMatch(/IANA/);
  });

  it("controlado: `valor` vira o value do input (sem defaultValue)", () => {
    const html = renderToStaticMarkup(createElement(CampoFuso, { valor: "America/Costa_Rica", onChange: () => {}, className: "campo" }));
    expect(html).toMatch(/<input[^>]*value="America\/Costa_Rica"/);
  });

  it("sugestões com o nome que a pessoa procura; a preferência pode trazer opção vazia e todos os fusos do ambiente", () => {
    const padrao = renderToStaticMarkup(createElement(CampoFuso, { padrao: "", className: "campo" }));
    for (const [valor, rotulo] of FUSOS_SUGERIDOS.map((s) => (typeof s === "string" ? [s, s] : s))) expect(padrao).toContain(`<option value="${valor}">${rotulo}</option>`);
    expect(padrao).not.toContain("Europe/Lisbon");
    const preferencia = renderToStaticMarkup(createElement(CampoFuso, { valor: "", onChange: () => {}, required: false, todos: true, opcaoVazia: "Usar fuso de origem do encontro", sugestoes: [["UTC", "UTC — horário universal"]], className: "campo" }));
    expect(preferencia).toContain('<option value="">Usar fuso de origem do encontro</option>');
    expect(preferencia).toContain('<option value="UTC">UTC — horário universal</option>');
    expect(preferencia).toContain('<option value="Europe/Lisbon">');
    expect(preferencia).not.toMatch(/<input[^>]*required/);
  });

  // Revisão R1 do #210 (C1): o ICU lista links do `backward` que um Postgres sem tzdata-legacy não aceita.
  it("a lista completa mostra o nome canônico, sem duplicatas", () => {
    expect(fusosCanonicos(["Asia/Kolkata", "Asia/Calcutta", "Europe/Kiev", "America/Sao_Paulo", "US/Eastern"]))
      .toEqual(["America/New_York", "America/Sao_Paulo", "Asia/Kolkata", "Europe/Kyiv"]);
    const todos = todosOsFusos();
    expect(todos.length).toBeGreaterThan(0);
    expect(new Set(todos).size).toBe(todos.length);
    const apelidos = new Set(Object.keys(APELIDOS_FUSO_LEGADOS));
    expect(todos.filter((f) => apelidos.has(f))).toEqual([]);
    expect(todos.filter((f) => !fusoIanaValido(f))).toEqual([]);
    const preferencia = renderToStaticMarkup(createElement(CampoFuso, { valor: "", onChange: () => {}, required: false, todos: true, sugestoes: [], className: "campo" }));
    for (const link of ["Asia/Calcutta", "Europe/Kiev", "America/Buenos_Aires", "Asia/Saigon"]) expect(preferencia).not.toContain(`value="${link}"`);
    for (const canonico of ["Asia/Kolkata", "Europe/Kyiv", "America/Argentina/Buenos_Aires", "Asia/Ho_Chi_Minh"]) {
      expect(preferencia.split(`<option value="${canonico}">`)).toHaveLength(2);
    }
  });
});
