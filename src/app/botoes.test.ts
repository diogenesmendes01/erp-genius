import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E1 (docs/42-auditoria-frontend-ux.md): o botão tem uma fonte só (botaoClasses / <Botao>, em
// src/components/Botao.tsx). A migração é por ÁREA; nas áreas desta lista, nenhuma string de classe
// monta um botão primário ou secundário à mão. A lista só cresce.
const AREAS_MIGRADAS = ["src/app/(app)/configuracao"];

const arquivos = AREAS_MIGRADAS.flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** Strings de classe (atributo ou constante) que desenham um botão sem passar por botaoClasses. */
function botoesCrus(conteudo: string): string[] {
  const strings = [...conteudo.matchAll(/className="([^"]*)"|=\s*"([^"]*)"\s*;/g)].map((m) => m[1] ?? m[2]);
  return strings.filter((c) => {
    const t = c.split(/\s+/);
    if (t.some((x) => x.startsWith("file:"))) return false; // input de arquivo
    const primario = t.includes("bg-brand-solid") && t.includes("text-white");
    const secundario = t.includes("border-gray-300") && t.includes("hover:bg-gray-50") && !t.some((x) => x.startsWith("focus:border"));
    return primario || secundario;
  });
}

describe("botões nas áreas migradas", () => {
  it("nenhum botão primário/secundário montado à mão (use botaoClasses ou <Botao>)", () => {
    const ofensores = arquivos.flatMap(({ arquivo, conteudo }) => botoesCrus(conteudo).map((c) => `${arquivo}: "${c}"`));
    expect(ofensores).toEqual([]);
  });

  it("o detector acusa as formas antigas e não acusa campo nem input de arquivo", () => {
    expect(botoesCrus('<button className="rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white">')).toHaveLength(1);
    expect(botoesCrus('const btnSec = "rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50";')).toHaveLength(1);
    expect(botoesCrus('<input className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500">')).toHaveLength(0);
    expect(botoesCrus('<input className="file:bg-brand-solid file:text-white text-sm">')).toHaveLength(0);
    expect(botoesCrus("<button className={botaoClasses({ tamanho: \"lg\" })}>")).toHaveLength(0);
  });
});
