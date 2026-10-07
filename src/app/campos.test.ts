import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { EXCECOES_CAMPO, MAPA_CAMPOS } from "./campos-mapa";

// Trava do Campo (docs/42-auditoria-frontend-ux.md, E1 e E7; §5.2 e §5.4): havia 0 aria-invalid para
// 619 `required` e 198 controles sem nome acessível. Agora rótulo, dica, erro e obrigatoriedade passam
// por <Campo> (src/components/Campo.tsx), que entrega id + aria-* ao controle por função:
// `<Campo rotulo="Nome" obrigatorio erro={…}>{(campo) => <input {...campo} />}</Campo>`.
//
// A migração é por ÁREA (AREAS_MIGRADAS, que só cresce). Nelas, pelo AST do TypeScript:
// - todo controle obrigatório — <input>/<select>/campo de texto longo, CampoTexto, CampoMoeda, CampoFuso
//   (obrigatório por padrão) ou componente local que repassa `id` — com `required` ou `aria-required`
//   passa pelo Campo; fora dele, só com rótulo ligado E aria-invalid ligado;
// - o controle obrigatório ligado a um Campo pede `obrigatorio` no Campo (o asterisco do rótulo);
// - todo controle tem nome acessível (Campo, <label> em volta, htmlFor ↔ id, aria-label/labelledby).
// Em qualquer tela, todo <Campo> liga exatamente um controle espalhando o parâmetro da função, sem
// reescrever id/aria-* por cima da ligação.
//
// Exceções: ancoradas em arquivo + trecho exato (a tag de abertura, espaços normalizados) + motivo
// (src/app/campos-mapa.ts); cada uma tem de casar com exatamente um caso. O mesmo arquivo traz o
// manifesto de cada <Campo> de cada tela (rótulo · obrigatoriedade · controle · dica/erro): trocar um
// Campo por um controle solto, apagá-lo ou tirar o `erro`/`obrigatorio` muda o mapa e falha aqui.

/** Áreas migradas: pasta e se as subpastas entram (rotas filhas são outras telas, migradas à parte). */
const AREAS_MIGRADAS: { pasta: string; subpastas: boolean }[] = [
  { pasta: "src/app/(app)/matriculas/nova", subpastas: true },
  { pasta: "src/app/(app)/alunos/[id]", subpastas: false },
];

const RAIZES = ["src/app", "src/components"];
const FONTE_DO_CAMPO = "src/components/Campo.tsx";
const NATIVOS = new Set(["input", "select", "textarea"]);
const DO_DESIGN_SYSTEM = new Set(["CampoTexto", "CampoMoeda", "CampoFuso"]);
/** Atributos que a ligação do Campo entrega — escritos à mão no controle, sobrescrevem a ligação. */
const DA_LIGACAO = ["id", "aria-required", "aria-invalid", "aria-describedby"];
const SEM_ROTULO_PROPRIO = /^(hidden|submit|button|reset|image)$/;

const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

type Elemento = ts.JsxElement | ts.JsxSelfClosingElement;
type Achado = { linha: number; trecho: string; problema: string };

const abertura = (n: Elemento) => (ts.isJsxElement(n) ? n.openingElement : n);
const ehElemento = (n: ts.Node): n is Elemento => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n);

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
}

function atributo(n: Elemento, nome: string): ts.JsxAttribute | undefined {
  return abertura(n).attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === nome);
}

/**
 * Valor de um atributo: undefined (ausente), true (só o nome), o texto de um literal (`x="a"`, `x={"a"}`,
 * `x={`a`}`) ou a expressão normalizada entre chaves (`{IDS.nome}`).
 */
function valor(n: Elemento, nome: string, sf: ts.SourceFile): string | true | undefined {
  const a = atributo(n, nome);
  if (!a) return undefined;
  const ini = a.initializer;
  if (!ini) return true;
  if (ts.isStringLiteral(ini)) return ini.text;
  if (ts.isJsxExpression(ini) && ini.expression) {
    const e = desembrulha(ini.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    return `{${normaliza(e.getText(sf))}}`;
  }
  return normaliza(ini.getText(sf));
}

/** `required`/`aria-required` presente e não desligado (`={false}`, `"false"`). */
function ligado(v: string | true | undefined): boolean {
  return v !== undefined && v !== "false" && v !== "{false}";
}

/** O Campo a que o controle está ligado: está na função filha do Campo e espalha o parâmetro dela. */
type Ligacao = { campo: ts.JsxElement; controle: Elemento | null; problema: string | null };

function ligacaoDoCampo(campo: ts.JsxElement, sf: ts.SourceFile): Ligacao {
  const filhos = campo.children.filter((c) => !(ts.isJsxText(c) && !c.getText(sf).trim()));
  const primeiro = filhos.length === 1 ? filhos[0] : undefined;
  const unico = primeiro && ts.isJsxExpression(primeiro) && primeiro.expression ? desembrulha(primeiro.expression) : undefined;
  const funcao = unico && (ts.isArrowFunction(unico) || ts.isFunctionExpression(unico)) ? unico : undefined;
  const parametro = funcao && funcao.parameters.length === 1 && ts.isIdentifier(funcao.parameters[0].name) ? funcao.parameters[0].name.text : undefined;
  if (!funcao || !parametro) return { campo, controle: null, problema: "Campo sem função de ligação ({(campo) => …})" };
  const ligados: Elemento[] = [];
  const procura = (n: ts.Node) => {
    if (ehElemento(n) && abertura(n).attributes.properties.some((a) => ts.isJsxSpreadAttribute(a) && ts.isIdentifier(desembrulha(a.expression)) && (desembrulha(a.expression) as ts.Identifier).text === parametro)) ligados.push(n);
    ts.forEachChild(n, procura);
  };
  procura(funcao.body);
  if (ligados.length === 0) return { campo, controle: null, problema: "Campo sem controle ligado (nenhum elemento espalha o parâmetro)" };
  if (ligados.length > 1) return { campo, controle: null, problema: `Campo liga ${ligados.length} controles` };
  return { campo, controle: ligados[0], problema: null };
}

/** Funções-componente que recebem `id` por props e o repassam ao controle nativo (SelectISO, …). */
function repassadores(sf: ts.SourceFile): { nomes: Set<string>; internos: Set<ts.Node> } {
  const nomes = new Set<string>();
  const internos = new Set<ts.Node>();
  const visita = (n: ts.Node) => {
    if (ehElemento(n) && NATIVOS.has(abertura(n).tagName.getText(sf)) && valor(n, "id", sf) === "{id}") {
      let f: ts.Node | undefined = n.parent;
      while (f && !ts.isFunctionLike(f)) f = f.parent;
      const props = f && ts.isFunctionLike(f) ? f.parameters[0]?.name : undefined;
      const recebeId = !!props && ts.isObjectBindingPattern(props) && props.elements.some((e) => (e.propertyName ?? e.name).getText(sf) === "id");
      const nome = f && ts.isFunctionDeclaration(f) ? f.name?.text : f && f.parent && ts.isVariableDeclaration(f.parent) && ts.isIdentifier(f.parent.name) ? f.parent.name.text : undefined;
      if (recebeId && nome && /^[A-Z]/.test(nome)) { nomes.add(nome); internos.add(n); }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { nomes, internos };
}

/** Todo <Campo> do arquivo liga exatamente um controle (vale em qualquer tela). */
export function camposMalLigados(fonte: string, arquivo = "x.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: Achado[] = [];
  const acusa = (n: ts.Node, problema: string) => achados.push({ linha: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, trecho: normaliza(n.getText(sf)), problema });
  const visita = (n: ts.Node) => {
    if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === "Campo") acusa(n, "Campo sem função de ligação ({(campo) => …})");
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "Campo") {
      if (n.openingElement.attributes.properties.some(ts.isJsxSpreadAttribute)) acusa(n.openingElement, "spread no Campo (rótulo e obrigatoriedade não verificáveis)");
      if (!atributo(n, "rotulo")) acusa(n.openingElement, "Campo sem rótulo");
      const { controle, problema } = ligacaoDoCampo(n, sf);
      if (problema) acusa(n.openingElement, problema);
      if (controle) for (const nome of DA_LIGACAO) if (atributo(controle, nome)) acusa(abertura(controle), `atributo da ligação escrito à mão: ${nome}`);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** Nas áreas migradas: obrigatório passa pelo Campo; todo controle tem nome acessível. */
export function controlesForaDoCampo(fonte: string, arquivo = "x.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: Achado[] = [];
  const acusa = (n: Elemento, problema: string) => {
    const tag = abertura(n);
    achados.push({ linha: sf.getLineAndCharacterOfPosition(tag.getStart(sf)).line + 1, trecho: normaliza(tag.getText(sf)), problema });
  };

  // Controles ligados a um Campo → o Campo.
  const ligadoA = new Map<ts.Node, ts.JsxElement>();
  const htmlFor = new Set<string>();
  const coleta = (n: ts.Node) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "Campo") {
      const { controle } = ligacaoDoCampo(n, sf);
      if (controle) ligadoA.set(controle, n);
    }
    if (ehElemento(n)) {
      const alvo = valor(n, "htmlFor", sf);
      if (typeof alvo === "string") htmlFor.add(alvo);
    }
    ts.forEachChild(n, coleta);
  };
  coleta(sf);
  const { nomes: locais, internos } = repassadores(sf);

  const dentroDeLabel = (n: ts.Node) => {
    for (let p = n.parent; p; p = p.parent) if (ts.isJsxElement(p) && p.openingElement.tagName.getText(sf) === "label") return true;
    return false;
  };
  const temRotulo = (n: Elemento) => {
    if (atributo(n, "aria-label") || atributo(n, "aria-labelledby") || atributo(n, "ariaLabel")) return true;
    const id = valor(n, "id", sf);
    if (typeof id === "string" && htmlFor.has(id)) return true;
    return dentroDeLabel(n);
  };

  const visita = (n: ts.Node) => {
    if (ehElemento(n) && !internos.has(n)) {
      const tag = abertura(n).tagName.getText(sf);
      const ehControle = NATIVOS.has(tag) || DO_DESIGN_SYSTEM.has(tag) || locais.has(tag) || ligadoA.has(n);
      const tipo = valor(n, "type", sf);
      if (ehControle && !(tag === "input" && typeof tipo === "string" && SEM_ROTULO_PROPRIO.test(tipo))) {
        const campo = ligadoA.get(n);
        const obrigatorio = ligado(valor(n, "required", sf)) || ligado(valor(n, "aria-required", sf))
          || (tag === "CampoFuso" && valor(n, "required", sf) !== "{false}");
        if (campo) {
          if (obrigatorio && !ligado(valor(campo, "obrigatorio", sf))) acusa(n, "obrigatório num Campo sem `obrigatorio`");
        } else if (obrigatorio) {
          if (!(temRotulo(n) && ligado(valor(n, "aria-invalid", sf)))) acusa(n, "obrigatório fora do Campo (sem rótulo e aria-invalid ligados)");
        } else if (!temRotulo(n)) {
          acusa(n, "sem nome acessível");
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** Cada <Campo> do arquivo, na ordem: rótulo · obrigatoriedade · controle ligado [· dica] [· erro]. */
export function mapaDeCampos(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const itens: string[] = [];
  const visita = (n: ts.Node) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "Campo") {
      const rotulo = valor(n, "rotulo", sf);
      const obrig = valor(n, "obrigatorio", sf);
      const obrigatoriedade = obrig === undefined || obrig === "{false}" ? "opcional"
        : obrig === true || obrig === "{true}" ? "obrigatório"
          : `obrigatório se ${typeof obrig === "string" ? obrig.replace(/^\{|\}$/g, "") : obrig}`;
      const { controle } = ligacaoDoCampo(n, sf);
      const partes = [rotulo === true || rotulo === undefined ? "(sem rótulo)" : rotulo, obrigatoriedade, controle ? abertura(controle).tagName.getText(sf) : "(sem controle)"];
      if (atributo(n, "dica")) partes.push("dica");
      if (atributo(n, "erro")) partes.push("erro");
      itens.push(partes.join(" · "));
    }
    if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === "Campo") itens.push("(sem controle)");
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return itens;
}

function telas(): { arquivo: string; fonte: string }[] {
  const saida: { arquivo: string; fonte: string }[] = [];
  for (const raiz of RAIZES) for (const f of readdirSync(raiz, { recursive: true }) as string[]) {
    if (!f.endsWith(".tsx") || f.includes(".test.")) continue;
    const arquivo = join(raiz, f).split("\\").join("/");
    saida.push({ arquivo, fonte: readFileSync(arquivo, "utf8") });
  }
  return saida;
}

const naArea = (arquivo: string) => AREAS_MIGRADAS.some(({ pasta, subpastas }) => {
  if (!arquivo.startsWith(`${pasta}/`)) return false;
  return subpastas || !arquivo.slice(pasta.length + 1).includes("/");
});

describe("detector do Campo (autoteste)", () => {
  const fora = (corpo: string, cabeca = "") => controlesForaDoCampo(`${cabeca}\nexport function T({ v, e, c }: any) { return (<>${corpo}</>); }`).map((a) => a.problema);
  const mal = (corpo: string) => camposMalLigados(`export function T({ v }: any) { return (<>${corpo}</>); }`).map((a) => a.problema);

  it("obrigatório (required, aria-required, CampoFuso por padrão) fora do Campo é acusado", () => {
    expect(fora('<input required value={v} />')).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
    expect(fora('<select aria-required="true" value={v} />')).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
    expect(fora('<CampoTexto required={c} value={v} />')).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
    expect(fora('<CampoMoeda required value={v} onChange={c} className="x" />')).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
    expect(fora('<CampoFuso padrao="" className="x" />')).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
    // Rótulo sem aria-invalid ainda não basta.
    expect(fora('<label htmlFor="a">A</label><input id="a" required />')).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
    expect(fora('<label>A <input required /></label>')).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
  });

  it("fora do Campo, obrigatório com rótulo E aria-invalid ligados passa; desligado não é obrigatório", () => {
    expect(fora('<label htmlFor="a">A</label><input id="a" required aria-invalid={!!e} />')).toEqual([]);
    expect(fora('<input aria-label="A" required aria-invalid={!!e} />')).toEqual([]);
    expect(fora('<label>A <input required aria-invalid={!!e} /></label>')).toEqual([]);
    expect(fora('<input aria-label="A" required={false} />')).toEqual([]);
    expect(fora('<CampoFuso padrao="" required={false} ariaLabel="Fuso" className="x" />')).toEqual([]);
  });

  it("dentro do Campo: passa; obrigatório pede `obrigatorio` no Campo", () => {
    expect(fora('<Campo rotulo="A" obrigatorio>{(campo) => <input {...campo} required />}</Campo>')).toEqual([]);
    expect(fora('<Campo rotulo="A" obrigatorio={c}>{(campo) => <CampoFuso {...campo} padrao="" className="x" />}</Campo>')).toEqual([]);
    expect(fora('<Campo rotulo="A">{(campo) => <input {...campo} required />}</Campo>')).toEqual(["obrigatório num Campo sem `obrigatorio`"]);
    expect(fora('<Campo rotulo="A" obrigatorio={false}>{(campo) => <CampoFuso {...campo} padrao="" className="x" />}</Campo>')).toEqual(["obrigatório num Campo sem `obrigatorio`"]);
    // Controle opcional ligado: o nome vem do rótulo do Campo.
    expect(fora('<Campo rotulo="A">{(campo) => <select {...campo} value={v} />}</Campo>')).toEqual([]);
    // Elemento que só está DENTRO do Campo, sem espalhar a ligação, não está ligado.
    expect(fora('<Campo rotulo="A">{(campo) => <><input {...campo} /><input required /></>}</Campo>')).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
  });

  it("nome acessível de todo controle: Campo, <label> em volta, htmlFor ↔ id, aria-label/labelledby", () => {
    expect(fora("<input value={v} />")).toEqual(["sem nome acessível"]);
    expect(fora('<label htmlFor="b">B</label><input id="a" />')).toEqual(["sem nome acessível"]);
    expect(fora('<label htmlFor="a">A</label><input id="a" />')).toEqual([]);
    expect(fora("<label htmlFor={ids.a}>A</label><input id={ids.a} />")).toEqual([]);
    expect(fora('<label className="x"><input type="checkbox" /> A</label>')).toEqual([]);
    expect(fora('<h2 id="t">T</h2><select aria-labelledby="t" />')).toEqual([]);
    expect(fora('<input type="hidden" name="x" value={v} />')).toEqual([]);
    expect(fora('<CampoMoeda value={v} onChange={c} className="x" />')).toEqual(["sem nome acessível"]);
    expect(fora('<CampoMoeda ariaLabel="Valor" value={v} onChange={c} className="x" />')).toEqual([]);
  });

  it("componente local que repassa `id` é conferido em cada uso (e não por dentro)", () => {
    const cabeca = "function SelectX({ id, ...resto }: any) { return <select id={id} {...resto} />; }";
    expect(fora("<SelectX value={v} />", cabeca)).toEqual(["sem nome acessível"]);
    expect(fora("<SelectX aria-required value={v} />", cabeca)).toEqual(["obrigatório fora do Campo (sem rótulo e aria-invalid ligados)"]);
    expect(fora('<Campo rotulo="País" obrigatorio>{(campo) => <SelectX {...campo} value={v} />}</Campo>', cabeca)).toEqual([]);
  });

  it("todo Campo liga exatamente um controle, sem reescrever a ligação", () => {
    expect(mal('<Campo rotulo="A">{(campo) => <input {...campo} />}</Campo>')).toEqual([]);
    expect(mal('<Campo rotulo="A">{function (campo) { return <input {...campo} />; }}</Campo>')).toEqual([]);
    expect(mal('<Campo rotulo="A"><input /></Campo>')).toEqual(["Campo sem função de ligação ({(campo) => …})"]);
    expect(mal('<Campo rotulo="A" />')).toEqual(["Campo sem função de ligação ({(campo) => …})"]);
    expect(mal('<Campo rotulo="A">{({ id }) => <input id={id} />}</Campo>')).toEqual(["Campo sem função de ligação ({(campo) => …})"]);
    expect(mal('<Campo rotulo="A">{(campo) => <input id={campo.id} />}</Campo>')).toEqual(["Campo sem controle ligado (nenhum elemento espalha o parâmetro)"]);
    expect(mal('<Campo rotulo="A">{(campo) => <><input {...campo} /><select {...campo} /></>}</Campo>')).toEqual(["Campo liga 2 controles"]);
    expect(mal('<Campo rotulo="A">{(campo) => <input {...campo} id="x" aria-invalid={v} />}</Campo>'))
      .toEqual(["atributo da ligação escrito à mão: id", "atributo da ligação escrito à mão: aria-invalid"]);
    expect(mal('<Campo {...v}>{(campo) => <input {...campo} />}</Campo>')).toEqual(["spread no Campo (rótulo e obrigatoriedade não verificáveis)", "Campo sem rótulo"]);
  });

  it("mapa: rótulo, obrigatoriedade, controle, dica e erro de cada Campo, na ordem", () => {
    expect(mapaDeCampos([
      '<><Campo id="a" rotulo="Nome" obrigatorio erro={e.nome}>{(c) => <input {...c} />}</Campo>',
      '<Campo rotulo={t ? "Empresa" : "Responsável"} obrigatorio={p !== "ALUNO"} dica="Ajuda">{(c) => <SelectISO {...c} />}</Campo>',
      '<Campo rotulo="Obs">{(c) => <CampoTexto {...c} />}</Campo><Campo rotulo="X"><input /></Campo></>',
    ].join(""))).toEqual([
      "Nome · obrigatório · input · erro",
      '{t ? "Empresa" : "Responsável"} · obrigatório se p !== "ALUNO" · SelectISO · dica',
      "Obs · opcional · CampoTexto",
      "X · opcional · (sem controle)",
    ]);
  });
});

describe("Campo nas telas", () => {
  const todas = telas();
  const migradas = todas.filter(({ arquivo }) => naArea(arquivo));

  it("a varredura acha as áreas migradas (não passa vazia por erro de caminho)", () => {
    for (const { pasta } of AREAS_MIGRADAS) expect(migradas.some(({ arquivo }) => arquivo.startsWith(`${pasta}/`)), pasta).toBe(true);
    expect(migradas.map(({ arquivo }) => arquivo)).toContain("src/app/(app)/matriculas/nova/MatriculaFormulario.tsx");
    expect(migradas.map(({ arquivo }) => arquivo)).toContain("src/app/(app)/alunos/[id]/FichaAluno.tsx");
    // Rota filha de /alunos/[id] é outra tela: entra quando for migrada.
    expect(migradas.map(({ arquivo }) => arquivo)).not.toContain("src/app/(app)/alunos/[id]/financeiro/FichaFinanceira.tsx");
  });

  it("nas áreas migradas, obrigatório passa pelo Campo e todo controle tem nome (ou exceção ancorada: arquivo + trecho)", () => {
    const casadas = new Map<number, number>();
    const pendentes: string[] = [];
    const achados = [
      ...migradas.flatMap(({ arquivo, fonte }) => controlesForaDoCampo(fonte, arquivo).map((a) => ({ arquivo, ...a }))),
      ...todas.filter(({ arquivo }) => arquivo !== FONTE_DO_CAMPO).flatMap(({ arquivo, fonte }) => camposMalLigados(fonte, arquivo).map((a) => ({ arquivo, ...a }))),
    ];
    for (const a of achados) {
      const i = EXCECOES_CAMPO.findIndex((e) => e.arquivo === a.arquivo && e.trecho === a.trecho);
      if (i >= 0) { casadas.set(i, (casadas.get(i) ?? 0) + 1); continue; }
      pendentes.push(`${a.arquivo}:${a.linha} ${a.problema} | ${a.trecho.slice(0, 140)}`);
    }
    expect(pendentes).toEqual([]);
    // Cada exceção casa com exatamente um caso: vencida (0) ou ampla demais (2+) falha.
    const soltas = EXCECOES_CAMPO.map((e, i) => ({ vezes: casadas.get(i) ?? 0, e })).filter((x) => x.vezes !== 1).map((x) => `${x.vezes}× ${x.e.arquivo} | ${x.e.trecho.slice(0, 80)}`);
    expect(soltas).toEqual([]);
    for (const e of EXCECOES_CAMPO) expect(e.motivo.trim(), e.trecho).not.toBe("");
  });

  it("cada tela tem exatamente os Campos do manifesto (trocar, apagar ou tirar erro/obrigatório aparece aqui)", () => {
    const real: Record<string, string[]> = {};
    for (const { arquivo, fonte } of todas) {
      const itens = mapaDeCampos(fonte);
      if (itens.length && arquivo !== FONTE_DO_CAMPO) real[arquivo] = itens;
    }
    expect(real).toEqual(MAPA_CAMPOS);
  });

  it("o wrapper local de /matriculas/nova não volta (o Campo é o compartilhado)", () => {
    const fonte = migradas.find(({ arquivo }) => arquivo.endsWith("/MatriculaFormulario.tsx"))!.fonte;
    expect(fonte).not.toMatch(/function Campo\b/);
    expect(fonte).toMatch(/import \{[^}]*\bCampo\b[^}]*\} from "@\/components\/Campo"/);
  });
});
