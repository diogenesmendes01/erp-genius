import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// E1/E7 (docs/42-auditoria-frontend-ux.md): 266 <textarea minLength> escondiam o mínimo até o envio.
// Campo de texto longo com mínimo usa <CampoTexto> (src/components/CampoTexto.tsx), que mostra o
// mínimo e a contagem ligados por aria-describedby. <textarea> cru só sem minLength.

/** <textarea> com minLength (em qualquer forma: atributo ou spread que o traga não é aceito). */
export function textareasComMinimo(fonte: string): number {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let n = 0;
  const visitar = (no: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(no) || ts.isJsxOpeningElement(no)) && no.tagName.getText(sf) === "textarea") {
      const props = no.attributes.properties;
      if (props.some((p) => ts.isJsxSpreadAttribute(p) || (ts.isJsxAttribute(p) && p.name.getText(sf) === "minLength"))) n++;
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);
  return n;
}

const fontes = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.(t|j)sx$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("mínimo de caracteres visível", () => {
  it("nenhum <textarea minLength> cru nas telas (use <CampoTexto>) — o próprio CampoTexto é a exceção", () => {
    const ofensores = fontes
      .filter(({ arquivo }) => arquivo !== "src/components/CampoTexto.tsx")
      .filter(({ conteudo }) => textareasComMinimo(conteudo) > 0)
      .map(({ arquivo, conteudo }) => `${arquivo}: ${textareasComMinimo(conteudo)}`);
    expect(ofensores).toEqual([]);
  });

  it("os campos de texto com mínimo estão todos no CampoTexto (a migração não perdeu nenhum)", () => {
    const usos = fontes.reduce((s, { conteudo }) => s + (conteudo.match(/<CampoTexto\b/g)?.length ?? 0), 0);
    expect(usos).toBeGreaterThanOrEqual(266);
  });

  it("o detector pega minLength e spread, e aceita textarea sem mínimo", () => {
    expect(textareasComMinimo('<textarea name="m" minLength={5} />')).toBe(1);
    expect(textareasComMinimo("<textarea {...props} />")).toBe(1);
    expect(textareasComMinimo('<textarea name="m" maxLength={200} />')).toBe(0);
    expect(textareasComMinimo('<CampoTexto name="m" minLength={5} />')).toBe(0);
  });
});
