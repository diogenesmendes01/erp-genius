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

/**
 * Expressão do atributo, normalizada para casar htmlFor com id: `x="a"`, `x={"a"}` e `x={`a`}` viram `a`;
 * template continua com o `${…}` (`${campoId}-forma` ≠ `${campoId}-froma`); variável vira `{nome}`.
 */
function expressao(trecho: string, attr: string) {
  const m = new RegExp(String.raw`\s${attr}=`).exec(trecho);
  if (!m) return undefined;
  const ini = m.index + m[0].length;
  if (trecho[ini] === '"') return trecho.slice(ini + 1, trecho.indexOf('"', ini + 1));
  if (trecho[ini] !== "{") return undefined;
  let nivel = 0, fim = ini;
  for (; fim < trecho.length; fim++) if (trecho[fim] === "{") nivel++; else if (trecho[fim] === "}" && --nivel === 0) break;
  const dentro = trecho.slice(ini + 1, fim).trim();
  const literal = /^(["`])([\s\S]*)\1$/.exec(dentro);
  return literal ? literal[2] : `{${dentro.replace(/\s+/g, "")}}`;
}

/** Todos os valores de um atributo no arquivo (em qualquer tag — `<CampoMoeda id="x">` também conta). */
const valores = (conteudo: string, attr: string) =>
  new Set([...conteudo.matchAll(new RegExp(String.raw`\s${attr}=`, "g"))].map((m) => expressao(conteudo.slice(m.index), attr)).filter(Boolean));

/** O componente (função com nome em maiúscula) que contém a posição recebe `id` nas props? Então ele só repassa. */
function componenteQueRepassaId(conteudo: string, i: number) {
  const assinaturas = [...conteudo.slice(0, i).matchAll(/function ([A-Z]\w*)\s*\(\s*\{([^}]*)\}/g)];
  const ultima = assinaturas.at(-1);
  return ultima && /(?:^|[\s,])id(?:[\s,?:]|$)/.test(ultima[2]) ? ultima[1] : undefined;
}

/**
 * Componentes de campo que recebem o id por prop e o repassam (CampoMoeda, CampoFuso, SelectISO…).
 * Dentro deles `id={id}` é aceito; em troca, cada uso `<Componente …>` é conferido como um campo.
 */
const repassadores = new Set(
  telas.flatMap(({ conteudo }) =>
    [...conteudo.matchAll(/<(?:select|input|textarea)\b/g)]
      .filter((m) => expressao(tagEm(conteudo, m.index!), "id") === "{id}")
      .map((m) => componenteQueRepassaId(conteudo, m.index!))
      .filter((nome): nome is string => Boolean(nome)),
  ),
);

function camposSemRotulo() {
  const campo = new RegExp(String.raw`<(select|input|textarea|${[...repassadores].join("|")})\b`, "g");
  return telas.flatMap(({ arquivo, conteudo }) => {
    const alvos = valores(conteudo, "htmlFor");
    return [...conteudo.matchAll(campo)]
      .filter((m) => {
        const tag = tagEm(conteudo, m.index!);
        if (/\s(?:aria-label(?:ledby)?|ariaLabel)=|\stype="(?:hidden|submit|button|reset)"/.test(tag)) return false;
        const id = expressao(tag, "id");
        if (id && alvos.has(id)) return false;
        if (id === "{id}" && componenteQueRepassaId(conteudo, m.index!)) return false;
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

  it("htmlFor aponta para um id que existe no mesmo arquivo — literal, template ou variável, comparados por inteiro", () => {
    const quebrados = telas.flatMap(({ arquivo, conteudo }) => {
      const ids = valores(conteudo, "id");
      return [...conteudo.matchAll(/<label\b/g)]
        .map((m) => ({ alvo: expressao(tagEm(conteudo, m.index!), "htmlFor"), i: m.index! }))
        .filter(({ alvo }) => alvo && !ids.has(alvo))
        .map(({ alvo, i }) => `${arquivo}:${linha(conteudo, i)} ${alvo}`);
    });
    expect(quebrados).toEqual([]);
  });
});
