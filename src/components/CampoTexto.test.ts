import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampoTexto, dicaDoCampo } from "./CampoTexto";

const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement("label", null, "Motivo", createElement(CampoTexto, props)));

describe("CampoTexto: o mínimo aparece antes do envio", () => {
  it("mostra o mínimo e a contagem, ligados ao campo por aria-describedby; a dica fica fora do nome", () => {
    const html = render({ name: "motivo", required: true, minLength: 5, maxLength: 2000 });
    expect(html).toContain("Mínimo 5 caracteres · 0/2000");
    const describedby = /<textarea[^>]*aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(describedby).toBeTruthy();
    // O id descrito é o da dica, e a dica é aria-hidden (não entra no nome "Motivo").
    expect(html).toMatch(new RegExp(`<span id="${describedby}" aria-hidden="true"`));
    // Os atributos do <textarea> original passam adiante.
    const textarea = /<textarea[^>]*>/.exec(html)?.[0] ?? "";
    for (const attr of ['name="motivo"', 'required=""', 'minLength="5"', 'maxLength="2000"']) expect(textarea, attr).toContain(attr);
  });

  it("texto abaixo do mínimo: diz quanto falta e marca aria-invalid; vazio ou suficiente não marca", () => {
    const curto = render({ value: "ok", onChange: () => {}, minLength: 5, maxLength: 2000 });
    expect(curto).toContain("Faltam 3 caracteres (mínimo 5) · 2/2000");
    expect(curto).toMatch(/<textarea[^>]*aria-invalid="true"/);
    expect(render({ value: "", onChange: () => {}, minLength: 5 })).not.toContain("aria-invalid");
    expect(render({ value: "motivo suficiente", onChange: () => {}, minLength: 5 })).not.toContain("aria-invalid");
  });

  it("não controlado: a contagem parte do defaultValue", () => {
    expect(render({ defaultValue: "abc", minLength: 10, maxLength: 100 })).toContain("Faltam 7 caracteres (mínimo 10) · 3/100");
  });

  it("aria-describedby já informado é preservado junto com a dica", () => {
    const html = render({ minLength: 5, "aria-describedby": "ajuda-externa" });
    expect(html).toMatch(/aria-describedby="ajuda-externa [^"]+-dica"/);
  });

  it("a redação da dica: singular/plural, só máximo, sem limites", () => {
    expect(dicaDoCampo(0, 1)).toBe("Mínimo 1 caractere · 0 caracteres");
    expect(dicaDoCampo(4, 5)).toBe("Faltam 1 caractere (mínimo 5) · 4 caracteres");
    expect(dicaDoCampo(3, undefined, 50)).toBe("3/50");
    expect(dicaDoCampo(3)).toBeNull();
  });
});
