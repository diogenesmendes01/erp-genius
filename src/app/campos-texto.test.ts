import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E1/E7 (docs/42-auditoria-frontend-ux.md): 266 <textarea minLength> escondiam o mínimo até o envio.
// Todo campo de texto longo das telas é <CampoTexto> (src/components/CampoTexto.tsx), que mostra o
// mínimo e a contagem ligados por aria-describedby.
//
// A trava não depende da sintaxe (R1 da #121): em vez de reconhecer cada forma de escrever o elemento
// (JSX, createElement, tag em variável, membro, atributo minúsculo…), a PALAVRA "textarea", em qualquer
// caixa, simplesmente não aparece no código das telas — só em CampoTexto.tsx. A única exceção é o tipo
// HTMLTextAreaElement (tipo do TypeScript, não cria elemento). Em comentário, escreva "campo de texto".

const TIPO_PERMITIDO = /HTMLTextAreaElement/g;

/** Ocorrências da palavra textarea (qualquer caixa) num fonte, fora do tipo HTMLTextAreaElement. */
export function mencoesDeTextarea(fonte: string): number {
  return fonte.replace(TIPO_PERMITIDO, "").match(/textarea/gi)?.length ?? 0;
}

const fontes = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.(t|j)sx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("campo de texto longo só pelo CampoTexto", () => {
  it("a palavra \"textarea\" (qualquer caixa, qualquer sintaxe) só aparece em src/components/CampoTexto.tsx", () => {
    const ofensores = fontes
      .filter(({ arquivo }) => arquivo !== "src/components/CampoTexto.tsx")
      .filter(({ conteudo }) => mencoesDeTextarea(conteudo) > 0)
      .map(({ arquivo, conteudo }) => `${arquivo}: ${mencoesDeTextarea(conteudo)}`);
    expect(ofensores).toEqual([]);
  });

  it("todos os campos de texto longo estão no CampoTexto (a migração não perdeu nenhum)", () => {
    const usos = fontes.reduce((s, { conteudo }) => s + (conteudo.match(/<CampoTexto\b/g)?.length ?? 0), 0);
    expect(usos).toBeGreaterThanOrEqual(319); // 266 com mínimo + 53 sem
  });

  it("o detector pega JSX, createElement, tag em variável, membro e atributo minúsculo; aceita o tipo", () => {
    expect(mencoesDeTextarea('<textarea name="m" minLength={5} />')).toBe(1);
    expect(mencoesDeTextarea('createElement("textarea", { minLength: 5 })')).toBe(1);
    expect(mencoesDeTextarea('const Tag = "textarea"; <Tag minLength={5} />')).toBe(1);
    expect(mencoesDeTextarea("<foo.textarea minLength={5} />")).toBe(1);
    expect(mencoesDeTextarea("<TEXTAREA minlength={5} />")).toBe(1);
    expect(mencoesDeTextarea("(e.target as HTMLTextAreaElement).name")).toBe(0);
    expect(mencoesDeTextarea('<CampoTexto name="m" minLength={5} />')).toBe(0);
  });
});
