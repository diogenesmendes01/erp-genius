// Critérios da medição de fuso e instante (docs/43-medicao-auditoria-ux.md §6 item 6). Texto puro, sem
// dependência, como o resto de scripts/medicao-ux. A trava src/app/fuso-instante.test.ts lê o AST do
// TypeScript e confere que chega ao MESMO conjunto destes critérios na árvore real.
import { tags } from "./nucleo.mjs";

/** O componente de fuso: o único lugar onde mora o <input> + <datalist> de fusos. */
export const ARQUIVO_DO_CAMPO_FUSO = "src/components/CampoFuso.tsx";

/**
 * Palavra de fuso num atributo, spread ou lista: "fuso" no começo ou depois de algo que não é letra
 * minúscula (`fuso`, `fusoOrigem`, `pais-fuso`, `fuso-${id}`, `listaFusosId`, `ed.fuso`), ou
 * timezone/timeZone. "confuso" não conta.
 */
export const PALAVRA_DE_FUSO = /(?:^|[^a-z])fuso|Fuso|FUSO|time_?zone|timeZone|TimeZone/;
/** Identificador IANA escrito no código (`"America/Sao_Paulo"`, `"UTC"`). */
export const IDENTIFICADOR_IANA = /["'`](?:(?:America|Europe|Asia|Africa|Pacific|Atlantic|Indian|Australia|Antarctica|US|Etc)\/[A-Za-z]|UTC["'`])/;
/** Placeholder que é exemplo de fuso (`placeholder="Ex.: America/Sao_Paulo"`). */
export const EXEMPLO_DE_FUSO = /\b(?:America|Europe|Asia|Africa|Pacific|Atlantic|Indian|Australia|Antarctica|US|Etc)\/[A-Z]/;
/** Rótulo de campo de fuso: o texto do <label> em volta (ou o `rotulo` do <Campo>) começa com "Fuso". */
export const ROTULO_DE_FUSO = /^fuso\b/i;
/** Atributos que nomeiam o campo: o valor é testado com PALAVRA_DE_FUSO. */
export const ATRIBUTOS_DE_NOME = ["name", "id", "list"];
/** Atributos de valor: contam quando o valor é um nome de fuso (`value={fuso}`, `defaultValue={ed.fusoOrigem ?? ""}`). */
export const ATRIBUTOS_DE_VALOR = ["value", "defaultValue"];
/** Nome (identificador ou último campo de `a.b.c`) que é fuso: fuso, fusoOrigem, ed.fuso, timeZone… */
export const NOME_DE_FUSO = /^fuso|Fuso|^time_?zone|^timeZone|TimeZone/;

/** Comentários viram espaço (mantém posições e linhas): exemplo em comentário não é campo. */
export function semComentarios(texto) {
  return texto.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
}

const VALOR = String.raw`("[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})`;
const ATRIBUTO = new RegExp(String.raw`\s(${[...ATRIBUTOS_DE_NOME, ...ATRIBUTOS_DE_VALOR].join("|")})=${VALOR}`, "g");
/** `{a.b.fuso}` ou `{fuso ?? ""}`: o último nome da cadeia (antes de `??`/`||`); undefined se não for cadeia. */
const NOME_DO_VALOR = /^\{\s*(?:[\w$]+\s*(?:\?\.|!\.|\.))*([\w$]+)!?\s*(?:(?:\?\?|\|\|)[^{}]*)?\}$/;
const atributoDeFuso = (nome, valor) => (ATRIBUTOS_DE_VALOR.includes(nome) ? NOME_DE_FUSO.test(NOME_DO_VALOR.exec(valor)?.[1] ?? "") : PALAVRA_DE_FUSO.test(valor));
const PLACEHOLDER = new RegExp(String.raw`\splaceholder=${VALOR}`);
const SPREAD = /\{\s*\.\.\.((?:[^{}]|\{[^{}]*\})*)\}/g;
const OCULTO = /\stype=(?:"hidden"|'hidden'|\{\s*["'`]hidden["'`]\s*\})/;

/**
 * O rótulo em volta da posição: o <label> ou <Campo> aberto mais interno. Do <label>, o texto logo
 * depois da abertura (até a primeira tag ou expressão); do <Campo>, o `rotulo` literal. null fora deles.
 */
export function rotuloEmVolta(texto, pos) {
  const marcas = [...texto.slice(0, pos).matchAll(/<(label|Campo)\b|<\/(label|Campo)>/g)];
  const fechadas = { label: 0, Campo: 0 };
  for (let i = marcas.length - 1; i >= 0; i--) {
    const m = marcas[i];
    if (m[2]) { fechadas[m[2]]++; continue; }
    if (fechadas[m[1]] > 0) { fechadas[m[1]]--; continue; }
    const abertura = tags(texto.slice(m.index), m[1])[0].texto;
    if (m[1] === "Campo") return /\srotulo=(?:"([^"]*)"|\{\s*["'`]([^"'`]*)["'`]\s*\})/.exec(abertura)?.slice(1).find((v) => v !== undefined)?.trim() ?? "";
    const inicio = m.index + abertura.length;
    const fim = texto.slice(inicio).search(/[<{]/);
    return texto.slice(inicio, fim < 0 ? undefined : inicio + fim).trim();
  }
  return null;
}

/**
 * Campo de fuso numa tag de <input>/<select> já recortada: atributo de fuso, spread de fuso ou
 * placeholder com exemplo de fuso. `type="hidden"` não é campo (é o fuso já decidido que vai junto).
 */
export function tagDeFuso(tag) {
  if (OCULTO.test(tag)) return false;
  if ([...tag.matchAll(ATRIBUTO)].some((m) => atributoDeFuso(m[1], m[2]))) return true;
  if ([...tag.matchAll(SPREAD)].some((m) => PALAVRA_DE_FUSO.test(m[1]))) return true;
  const exemplo = PLACEHOLDER.exec(tag);
  return !!exemplo && EXEMPLO_DE_FUSO.test(exemplo[1]);
}

/**
 * Campos de fuso de um arquivo de tela, cada um como "campo" (<input>/<select>/createElement de campo)
 * ou "lista" (<datalist> de fusos, <select> com opções de fuso).
 * @param {string} fonte
 * @returns {{ tipo: "campo" | "lista"; pos: number; trecho: string }[]}
 */
export function camposDeFuso(fonte) {
  const texto = semComentarios(fonte);
  const saida = [];
  for (const t of tags(texto, "input|select")) {
    const rotulo = rotuloEmVolta(texto, t.pos);
    if (tagDeFuso(t.texto) || (!OCULTO.test(t.texto) && rotulo !== null && ROTULO_DE_FUSO.test(rotulo))) saida.push({ tipo: "campo", pos: t.pos, trecho: t.texto });
  }
  for (const t of tags(texto, "datalist|select")) {
    const fim = t.texto.endsWith("/>") ? -1 : texto.indexOf(`</${t.tag}>`, t.pos);
    const corpo = fim < 0 ? "" : texto.slice(t.pos + t.texto.length, fim);
    // datalist: qualquer menção a fuso; select: opção com identificador IANA ou a lista do Intl.
    const lista = t.tag === "datalist" ? PALAVRA_DE_FUSO.test(t.texto + corpo) || IDENTIFICADOR_IANA.test(corpo) || /supportedValuesOf/.test(corpo)
      : [...corpo.matchAll(/<option\b[^>]*\svalue=("[^"]*"|\{[^}]*\})/g)].some((o) => IDENTIFICADOR_IANA.test(o[1])) || /supportedValuesOf/.test(corpo);
    if (lista) saida.push({ tipo: "lista", pos: t.pos, trecho: t.texto });
  }
  for (const m of texto.matchAll(/\bcreateElement\(\s*["'](input|select|datalist)["']\s*,((?:[^()]|\([^()]*\))*)\)/g)) {
    const campo = m[1] !== "datalist" && PALAVRA_DE_FUSO.test(m[2]);
    const lista = m[1] !== "input" && (IDENTIFICADOR_IANA.test(m[2]) || /supportedValuesOf/.test(m[2]) || (m[1] === "datalist" && PALAVRA_DE_FUSO.test(m[2])));
    if (campo || lista) saida.push({ tipo: campo ? "campo" : "lista", pos: m.index, trecho: m[0] });
  }
  return saida.sort((a, b) => a.pos - b.pos);
}

/** Métodos que imprimem o instante cru (ISO ou inglês). */
export const METODOS_CRUS = ["toISOString", "toJSON", "toUTCString"];
/** Métodos de texto que só cortam/trocam o ISO (não o formatam). */
export const CORTES = ["slice", "substring", "substr", "replace", "replaceAll", "trim", "split", "padStart", "padEnd", "toString", "concat"];
/** Atributos de JSX que não vão para a tela como texto: template neles não conta. */
export const ATRIBUTOS_SEM_TEXTO = ["key", "href", "id", "htmlFor", "name", "value", "defaultValue", "min", "max", "className", "list", "action", "src", "dateTime"];

const CADEIA = String.raw`(?:new Date\((?:[^()]|\([^()]*\))*\)|[\w$]+(?:\??\.[\w$]+|!|\[\d+\])*)\??\.(?:${METODOS_CRUS.join("|")})\(\)(?:\??\.(?:${CORTES.join("|")})\((?:[^()]|\([^()]*\))*\))*`;

/**
 * Instante cru impresso na tela: `{x.toISOString()}` (ou toJSON/toUTCString, com cortes como
 * `.slice`/`.replace` depois) como filho de JSX — não depois de `=` (atributo) — e o mesmo dentro de
 * `${…}` de template, salvo template que é valor de atributo sem texto (key, href…). Chamada em volta
 * (`formatar(x.toISOString())`) é formatação e não conta.
 * @param {string} fonte
 * @returns {{ pos: number; trecho: string }[]}
 */
export function instantesCrus(fonte) {
  const texto = semComentarios(fonte);
  const saida = [];
  for (const m of texto.matchAll(new RegExp(String.raw`(?<![=\w$])\{\s*(${CADEIA})\s*\}`, "g"))) {
    if (texto[m.index - 1] === "$") continue; // `${…}`: regra do template, abaixo
    saida.push({ pos: m.index, trecho: m[1] });
  }
  const semTexto = new RegExp(String.raw`\s(?:${ATRIBUTOS_SEM_TEXTO.join("|")})=\{\s*$`);
  for (const m of texto.matchAll(new RegExp(String.raw`\$\{\s*(${CADEIA})\s*\}`, "g"))) {
    const inicioDoTemplate = texto.lastIndexOf("`", m.index);
    if (semTexto.test(texto.slice(Math.max(0, inicioDoTemplate - 40), inicioDoTemplate))) continue;
    saida.push({ pos: m.index, trecho: m[1] });
  }
  return saida.sort((a, b) => a.pos - b.pos);
}
