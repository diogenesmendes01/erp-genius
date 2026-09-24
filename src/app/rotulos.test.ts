import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Todo campo precisa de nome acessível: <label htmlFor> ligado ao id, <label> envolvendo o campo,
// ou aria-label/aria-labelledby. Placeholder não é rótulo (some ao digitar e muitos leitores o ignoram).

/** Comentários viram espaço (mantém as linhas), para não contar `<select>` citado em texto. */
function semComentarios(fonte: string) {
  return fonte.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
}

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f), conteudo: semComentarios(readFileSync(join(raiz, f), "utf-8")) })),
);

/** Tag de abertura inteira a partir de `<`, ignorando `>` dentro de `{…}` (ex.: `onChange={(e) => …}`). */
function tagEm(fonte: string, inicio: number) {
  let nivel = 0;
  for (let i = inicio; i < fonte.length; i++) {
    const c = fonte[i];
    if (c === "{") nivel++;
    else if (c === "}") nivel--;
    else if (c === ">" && nivel === 0) return fonte.slice(inicio, i + 1);
  }
  return fonte.slice(inicio);
}

const linha = (fonte: string, i: number) => fonte.slice(0, i).split("\n").length;
/** Valor literal de um atributo (`x="a"`, `x={"a"}`, `x={`a-${i}`}`) — o suficiente para casar htmlFor com id. */
const valor = (tag: string, attr: string) => tag.match(new RegExp(String.raw`\s${attr}=(?:"([^"]*)"|\{\s*["\`]([^"\`]*)["\`]\s*\})`))?.slice(1).find(Boolean);

function camposSemRotulo() {
  return telas.flatMap(({ arquivo, conteudo }) => {
    const alvos = new Set([...conteudo.matchAll(/<label\b/g)].map((m) => valor(tagEm(conteudo, m.index!), "htmlFor")).filter(Boolean));
    return [...conteudo.matchAll(/<(select|input|textarea)\b/g)]
      .filter((m) => {
        const tag = tagEm(conteudo, m.index!);
        if (/\saria-label(?:ledby)?=|\stype="(?:hidden|submit|button|reset)"/.test(tag)) return false;
        if (/\sid=\{[a-zA-Z]+\}/.test(tag)) return false; // id repassado por prop: quem usa o componente liga o rótulo
        const id = valor(tag, "id");
        if (id && alvos.has(id)) return false;
        const antes = conteudo.slice(0, m.index);
        return antes.lastIndexOf("<label") <= antes.lastIndexOf("</label>"); // fora de <label> aberto
      })
      .map((m) => `${arquivo}:${linha(conteudo, m.index!)} <${m[1]}>`);
  });
}

/** <label> sem htmlFor que não envolve campo nenhum — rótulo solto, não nomeia nada. */
function rotulosSoltos() {
  return telas.flatMap(({ arquivo, conteudo }) =>
    [...conteudo.matchAll(/<label\b/g)]
      .filter((m) => {
        const tag = tagEm(conteudo, m.index!);
        if (/\shtmlFor=/.test(tag)) return false;
        const corpo = conteudo.slice(m.index! + tag.length, conteudo.indexOf("</label>", m.index!));
        return !/<(?:input|select|textarea)\b|<[A-Z]\w*/.test(corpo);
      })
      .map((m) => `${arquivo}:${linha(conteudo, m.index!)}`),
  );
}

describe("rótulos de formulário", () => {
  it("todo <input>/<select>/<textarea> tem rótulo ligado (htmlFor↔id, <label> em volta ou aria-label)", () => {
    expect(camposSemRotulo()).toEqual([]);
  });

  it("nenhum <label> fica solto — sem htmlFor e sem campo dentro", () => {
    expect(rotulosSoltos()).toEqual([]);
  });

  it("htmlFor aponta para um id que existe no mesmo arquivo", () => {
    const quebrados = telas.flatMap(({ arquivo, conteudo }) =>
      [...conteudo.matchAll(/<label\b/g)]
        .map((m) => ({ alvo: valor(tagEm(conteudo, m.index!), "htmlFor"), i: m.index! }))
        .filter(({ alvo }) => alvo && !alvo.includes("${") && !new RegExp(String.raw`\sid=(?:"|\{\s*["\`])${alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["\`]`).test(conteudo))
        .map(({ alvo, i }) => `${arquivo}:${linha(conteudo, i)} ${alvo}`),
    );
    expect(quebrados).toEqual([]);
  });
});
