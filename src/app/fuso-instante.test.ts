import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ARQUIVO_DO_CAMPO_FUSO, ATRIBUTOS_DE_NOME, ATRIBUTOS_DE_VALOR, ATRIBUTOS_SEM_TEXTO, CORTES, EXEMPLO_DE_FUSO, IDENTIFICADOR_IANA,
  METODOS_CRUS, NOME_DE_FUSO, PALAVRA_DE_FUSO, ROTULO_DE_FUSO, camposDeFuso, instantesCrus,
} from "../../scripts/medicao-ux/fuso.mjs";

// Trava de fuso e instante (docs/43-medicao-auditoria-ux.md §6 item 6; docs/42-auditoria-frontend-ux.md, ganho
// rápido 14 e achados de fuso). Havia 20 campos de fuso digitados à mão fora do <CampoFuso> (3 começando vazios,
// 2 com outro `name`, 6 com <datalist> próprio) e 11 instantes impressos crus com toISOString() — inclusive a
// frase de auditoria da emissão e o histórico do pagador. Agora:
//
// A. CAMPO DE FUSO só pelo <CampoFuso> (src/components/CampoFuso.tsx). Pelo AST do TypeScript, em todo arquivo
//    .tsx de produção de src/app e src/components, é campo de fuso o <input>/<select> nativo (também por
//    `createElement`/`jsx`, e por tag que é constante de texto: `const T = "input"; <T …/>`) que:
//    - tem `name`/`id`/`list` com palavra de fuso (PALAVRA_DE_FUSO: fuso, fusoOrigem, pais-fuso, `fuso-${id}`,
//      listaFusosId, timeZone…), ou spread com ela (`{...register("fuso")}`);
//    - tem `value`/`defaultValue` que é um nome de fuso (`value={fuso}`, `defaultValue={ed.fusoOrigem ?? ""}`);
//    - tem placeholder com exemplo de fuso ("America/Sao_Paulo");
//    - está num <label> cujo texto começa com "Fuso", ou num <Campo rotulo="Fuso…">.
//    `type="hidden"` não é campo (é o fuso já decidido que vai junto no envio). É LISTA DE FUSOS o <datalist> com
//    palavra de fuso, identificador IANA ou `Intl.supportedValuesOf`, e o <select> com opção IANA.
// B. INSTANTE NA TELA nunca é toISOString()/toJSON()/toUTCString() — nem cortado (`.slice`, `.replace`…). É tela:
//    filho de JSX (`<p>{x}</p>`), atributo de texto (title, aria-label, placeholder, alt, label) e `${…}` de
//    template, salvo o template que é o próprio valor de um atributo sem texto (key, href, id…). O valor é
//    seguido por `??`/`||`/`+` (os dois lados), `&&` (o direito), ternário, template, `String(x)`, cortes de
//    texto, constante local e função local (o que ela devolve); qualquer outra chamada é formatação
//    (`formatarInstanteExibicao(x, …)`, `formatar(x.toISOString())`) e não conta.
// C. FALHA FECHADA: arquivo que não analisa, método chamado por nome calculado (`x[m]()`) numa posição de tela e
//    tag nativa por constante que pode ser campo contam como achado.
//
// Exceções: arquivo + tipo + trecho exato (espaços normalizados) + motivo; cada uma casa com exatamente um
// achado, e a lista é comparada com uma cópia literal (acrescentar exceção exige mexer nos dois lugares).
//
// A trava e a medição chegam ao mesmo conjunto: os critérios de texto de scripts/medicao-ux/fuso.mjs (os
// números "campos de fuso fora do CampoFuso" e "instantes crus na tela" do metricas.mjs) aplicados aos mesmos
// arquivos dão exatamente as mesmas linhas que esta trava. Fora do alcance (declarado): valor que chega por
// prop ou estado e é impresso adiante (o componente que imprime é que é conferido), e componente local que
// embrulha um <input> sem nome de fuso.

const RAIZES = ["src/app", "src/components"];
const CONTROLES = ["input", "select"];
const ELEMENTOS = ["input", "select", "datalist"];
/** Fábricas de elemento: o primeiro argumento é a tag. */
const FABRICAS = ["createElement", "jsx", "jsxs", "jsxDEV"];
/** Atributos de JSX que são texto na tela: instante cru neles conta. */
export const ATRIBUTOS_DE_TEXTO = ["title", "aria-label", "placeholder", "alt", "label"];
/** Passos de valor seguidos (constante, função local) antes de desistir. */
const PROFUNDIDADE_MAXIMA = 8;

export type TipoAchado = "campo" | "lista" | "instante" | "opaco";
export type Achado = { arquivo: string; linha: number; tipo: TipoAchado; trecho: string; problema: string };
const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
  return e;
}

/** O inicializador do `const nome = …` visível do ponto (do bloco mais interno para fora). */
function constanteVisivel(id: ts.Identifier): ts.Expression | undefined {
  for (let n: ts.Node | undefined = id.parent; n; n = n.parent) {
    if (!(ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n))) continue;
    for (const s of n.statements) {
      if (!ts.isVariableStatement(s) || !(s.declarationList.flags & ts.NodeFlags.Const)) continue;
      for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === id.text && d.initializer) return d.initializer;
    }
  }
  return undefined;
}

/** A função local com esse nome (declaração ou `const f = (…) => …`), visível do ponto. */
function funcaoVisivel(id: ts.Identifier): ts.FunctionLikeDeclaration | undefined {
  for (let n: ts.Node | undefined = id.parent; n; n = n.parent) {
    if (!(ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n))) continue;
    for (const s of n.statements) {
      if (ts.isFunctionDeclaration(s) && s.name?.text === id.text && s.body) return s;
      if (!ts.isVariableStatement(s)) continue;
      for (const d of s.declarationList.declarations) {
        const init = d.initializer ? desembrulha(d.initializer) : undefined;
        if (ts.isIdentifier(d.name) && d.name.text === id.text && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) return init;
      }
    }
  }
  return undefined;
}

/** O que a função devolve: o corpo de seta, ou cada `return` do corpo (sem entrar em funções internas). */
function retornos(f: ts.FunctionLikeDeclaration): ts.Expression[] {
  if (!f.body) return [];
  if (!ts.isBlock(f.body)) return [f.body];
  const saida: ts.Expression[] = [];
  const visita = (n: ts.Node) => {
    if (ts.isReturnStatement(n) && n.expression) saida.push(n.expression);
    if (!ts.isFunctionLike(n)) ts.forEachChild(n, visita);
  };
  ts.forEachChild(f.body, visita);
  return saida;
}

/** Os textos que a expressão pode ser (literal, ternário de literais, constante local); null se não dá para saber. */
function textosPossiveis(e: ts.Expression, prof = 0): string[] | null {
  e = desembrulha(e);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isConditionalExpression(e)) {
    const a = textosPossiveis(e.whenTrue, prof + 1), b = textosPossiveis(e.whenFalse, prof + 1);
    return a && b ? [...a, ...b] : null;
  }
  if (ts.isIdentifier(e) && prof < PROFUNDIDADE_MAXIMA) {
    const init = constanteVisivel(e);
    return init ? textosPossiveis(init, prof + 1) : null;
  }
  return null;
}

type Elemento = ts.JsxElement | ts.JsxSelfClosingElement;
const abertura = (n: Elemento) => (ts.isJsxElement(n) ? n.openingElement : n);

/** Elementos nativos que a tag pode ser: o próprio nome em minúscula, ou o texto da constante por trás de `<Tag>`. */
function tagsNativas(nome: ts.JsxTagNameExpression): string[] {
  if (!ts.isIdentifier(nome)) return [];
  if (/^[a-z]/.test(nome.text)) return [nome.text];
  return textosPossiveis(nome) ?? [];
}

const atributosDe = (n: Elemento) => abertura(n).attributes.properties;
function atributo(n: Elemento, nome: string, sf: ts.SourceFile): ts.JsxAttribute | undefined {
  return atributosDe(n).find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === nome);
}
/** Texto literal do atributo (`a="x"`, `a={"x"}`, `a={`x`}`), ou null. */
function textoLiteral(a: ts.JsxAttribute | undefined): string | null {
  const ini = a?.initializer;
  if (!ini) return null;
  if (ts.isStringLiteral(ini)) return ini.text;
  if (ts.isJsxExpression(ini) && ini.expression) {
    const e = desembrulha(ini.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  }
  return null;
}
/** O último nome de uma cadeia (`fuso`, `ed.fuso`, `x?.fusoOrigem`), antes de `??`/`||`; "" se não for cadeia. */
function nomeDoValor(e: ts.Expression): string {
  e = desembrulha(e);
  if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.BarBarToken)) e = desembrulha(e.left);
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return "";
}

/** O <label> ou <Campo> mais interno em volta, com o texto que o rotula; null fora deles. */
function rotuloEmVolta(n: ts.Node, sf: ts.SourceFile): string | null {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (!ts.isJsxElement(p)) continue;
    const tag = p.openingElement.tagName.getText(sf);
    if (tag === "Campo") return (textoLiteral(atributo(p, "rotulo", sf)) ?? "").trim();
    if (tag === "label") {
      let texto = "";
      for (const filho of p.children) { if (!ts.isJsxText(filho)) break; texto += filho.text; }
      return texto.trim();
    }
  }
  return null;
}

/** Campo de fuso num <input>/<select> nativo (regra A). */
function controleDeFuso(n: Elemento, sf: ts.SourceFile): boolean {
  if (textoLiteral(atributo(n, "type", sf)) === "hidden") return false;
  for (const p of atributosDe(n)) {
    if (ts.isJsxSpreadAttribute(p)) { if (PALAVRA_DE_FUSO.test(p.expression.getText(sf))) return true; continue; }
    const nome = p.name.getText(sf), ini = p.initializer;
    if (!ini) continue;
    if (ATRIBUTOS_DE_NOME.includes(nome) && PALAVRA_DE_FUSO.test(ini.getText(sf))) return true;
    if (ATRIBUTOS_DE_VALOR.includes(nome) && ts.isJsxExpression(ini) && ini.expression && NOME_DE_FUSO.test(nomeDoValor(ini.expression))) return true;
    if (nome === "placeholder" && EXEMPLO_DE_FUSO.test(ini.getText(sf))) return true;
  }
  const rotulo = rotuloEmVolta(n, sf);
  return rotulo !== null && ROTULO_DE_FUSO.test(rotulo);
}

/** Lista de fusos (regra A): <datalist> com palavra de fuso/IANA/Intl; <select> com opção IANA ou Intl. */
function listaDeFusos(n: Elemento, tag: string, sf: ts.SourceFile): boolean {
  const corpo = ts.isJsxElement(n) ? n.children.map((c) => c.getText(sf)).join("") : "";
  if (tag === "datalist") return PALAVRA_DE_FUSO.test(n.getText(sf)) || IDENTIFICADOR_IANA.test(corpo) || /supportedValuesOf/.test(corpo);
  if (/supportedValuesOf/.test(corpo)) return true;
  let comOpcaoIana = false;
  const visita = (x: ts.Node) => {
    if ((ts.isJsxOpeningElement(x) || ts.isJsxSelfClosingElement(x)) && x.tagName.getText(sf) === "option") {
      const valor = x.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === "value");
      if (valor?.initializer && IDENTIFICADOR_IANA.test(valor.initializer.getText(sf))) comOpcaoIana = true;
    }
    ts.forEachChild(x, visita);
  };
  if (ts.isJsxElement(n)) n.children.forEach(visita);
  return comOpcaoIana;
}

/** Os nós de instante cru que uma expressão leva à tela (regra B); `opaco` quando não dá para saber. */
function crusImpressos(e: ts.Expression, prof = 0): { no: ts.Node; opaco: boolean }[] {
  e = desembrulha(e);
  if (prof > PROFUNDIDADE_MAXIMA) return [];
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.PlusToken) return [...crusImpressos(e.left, prof), ...crusImpressos(e.right, prof)];
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.CommaToken) return crusImpressos(e.right, prof);
    return [];
  }
  if (ts.isConditionalExpression(e)) return [...crusImpressos(e.whenTrue, prof), ...crusImpressos(e.whenFalse, prof)];
  if (ts.isTemplateExpression(e)) return e.templateSpans.flatMap((s) => crusImpressos(s.expression, prof));
  if (ts.isCallExpression(e)) {
    const f = desembrulha(e.expression);
    if (ts.isPropertyAccessExpression(f)) {
      const metodo = f.name.text;
      if (METODOS_CRUS.includes(metodo)) return [{ no: e, opaco: false }];
      if (CORTES.includes(metodo)) return crusImpressos(f.expression, prof);
      // `Date.prototype.toISOString.call(d)`
      const alvo = desembrulha(f.expression);
      if ((metodo === "call" || metodo === "apply") && ts.isPropertyAccessExpression(alvo) && METODOS_CRUS.includes(alvo.name.text)) return [{ no: e, opaco: false }];
      return [];
    }
    if (ts.isElementAccessExpression(f)) {
      const nomes = textosPossiveis(f.argumentExpression);
      if (!nomes) return [{ no: e, opaco: true }];
      if (nomes.some((m) => METODOS_CRUS.includes(m))) return [{ no: e, opaco: false }];
      return nomes.some((m) => CORTES.includes(m)) ? crusImpressos(f.expression, prof) : [];
    }
    if (ts.isIdentifier(f)) {
      if (f.text === "String" && e.arguments[0]) return crusImpressos(e.arguments[0], prof);
      const funcao = funcaoVisivel(f);
      if (funcao) return retornos(funcao).flatMap((r) => crusImpressos(r, prof + 1));
    }
    return [];
  }
  if (ts.isIdentifier(e)) {
    const init = constanteVisivel(e);
    return init ? crusImpressos(init, prof + 1) : [];
  }
  return [];
}

/** Todos os achados de um arquivo (regras A, B e C). */
export function analisar(fonte: string, arquivo = "virtual.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const linha = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const achados: Achado[] = [];
  const acusa = (n: ts.Node, tipo: TipoAchado, problema: string, trecho = n.getText(sf)) => achados.push({ arquivo, linha: linha(n), tipo, trecho: normaliza(trecho), problema });
  const diagnosticos = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (diagnosticos.length) {
    achados.push({ arquivo, linha: 1, tipo: "opaco", trecho: "(arquivo)", problema: `não analisa: ${ts.flattenDiagnosticMessageText(diagnosticos[0].messageText, " ")}` });
    return achados;
  }
  const vistos = new Set<ts.Node>();
  const instantes = (e: ts.Expression) => {
    for (const { no, opaco } of crusImpressos(e)) {
      if (vistos.has(no)) continue;
      vistos.add(no);
      acusa(no, opaco ? "opaco" : "instante", opaco ? "método chamado por nome calculado numa posição de tela" : "instante cru na tela (use formatarInstanteExibicao com o fuso de exibição e a origem)");
    }
  };
  const visita = (n: ts.Node) => {
    // Regra A — elementos nativos.
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const nomes = tagsNativas(abertura(n).tagName).filter((t) => ELEMENTOS.includes(t));
      const ab = abertura(n);
      if (nomes.some((t) => CONTROLES.includes(t)) && controleDeFuso(n, sf)) acusa(ab, "campo", "campo de fuso fora do CampoFuso");
      for (const t of nomes.filter((x) => x === "datalist" || x === "select")) {
        if (listaDeFusos(n, t, sf)) { acusa(ab, "lista", "lista de fusos fora do CampoFuso"); break; }
      }
    }
    // Regra A — createElement/jsx com tag nativa.
    if (ts.isCallExpression(n)) {
      const f = desembrulha(n.expression);
      const nomeFabrica = ts.isIdentifier(f) ? f.text : ts.isPropertyAccessExpression(f) ? f.name.text : "";
      const [tag, ...resto] = n.arguments;
      if (FABRICAS.includes(nomeFabrica) && tag) {
        const tags = (textosPossiveis(tag) ?? []).filter((t) => ELEMENTOS.includes(t));
        const texto = resto.map((r) => r.getText(sf)).join(",");
        const campo = tags.some((t) => CONTROLES.includes(t)) && PALAVRA_DE_FUSO.test(texto);
        const lista = tags.some((t) => t !== "input") && (IDENTIFICADOR_IANA.test(texto) || /supportedValuesOf/.test(texto) || (tags.includes("datalist") && PALAVRA_DE_FUSO.test(texto)));
        if (campo || lista) acusa(n, campo ? "campo" : "lista", `${campo ? "campo" : "lista"} de fuso por ${nomeFabrica} fora do CampoFuso`);
      }
    }
    // Regra B — filho de JSX, atributo de texto e template.
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) instantes(n.expression);
    if (ts.isJsxAttribute(n) && ATRIBUTOS_DE_TEXTO.includes(n.name.getText(sf)) && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) instantes(n.initializer.expression);
    if (ts.isTemplateExpression(n)) {
      const pai = n.parent;
      const semTexto = ts.isJsxExpression(pai) && ts.isJsxAttribute(pai.parent) && ATRIBUTOS_SEM_TEXTO.includes(pai.parent.name.getText(sf));
      if (!semTexto) instantes(n);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados.sort((a, b) => a.linha - b.linha);
}

// ---------------------------------------------------------------------------------------------------
// Exceções (arquivo + tipo + trecho exato + motivo) e a varredura.
// ---------------------------------------------------------------------------------------------------
export type Excecao = { arquivo: string; tipo: TipoAchado; trecho: string; motivo: string };

export const EXCECOES: Excecao[] = [
  {
    arquivo: ARQUIVO_DO_CAMPO_FUSO,
    tipo: "lista",
    trecho: "<datalist id={listaId}>",
    motivo: "é a lista de sugestões do próprio CampoFuso (id por useId, sugestões da escola e, na preferência, todos os fusos do Intl); todo campo de fuso do sistema passa por ela",
  },
];

export function conferirExcecoes(achados: Achado[], excecoes: Excecao[]): { semExcecao: string[]; soltas: string[] } {
  const casa = (a: Achado, e: Excecao) => a.arquivo === e.arquivo && a.tipo === e.tipo && a.trecho === normaliza(e.trecho);
  return {
    semExcecao: achados.filter((a) => !excecoes.some((e) => casa(a, e))).map((a) => `${a.arquivo}:${a.linha}: [${a.tipo}] ${a.trecho} — ${a.problema}`),
    soltas: excecoes.filter((e) => achados.filter((a) => casa(a, e)).length !== 1).map((e) => `${e.arquivo}: [${e.tipo}] ${e.trecho}`),
  };
}

function telasDeProducao() {
  const saida: { arquivo: string; fonte: string }[] = [];
  for (const raiz of RAIZES) for (const f of (readdirSync(raiz, { recursive: true }) as string[]).sort()) {
    if (!/\.tsx$/.test(f) || /\.test\.tsx$/.test(f)) continue;
    const arquivo = join(raiz, f).split("\\").join("/");
    saida.push({ arquivo, fonte: readFileSync(arquivo, "utf8") });
  }
  return saida;
}

/** Arquivos migrados nesta trava (docs/43 §6 item 6): cada um usa o CampoFuso. */
export const MIGRADOS = [
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/Formularios.tsx",
  "src/app/(app)/academico/grades/nova/PrepararGradeFormulario.tsx",
  "src/app/(app)/academico/indisponibilidades/SolicitarAusencia.tsx",
  "src/app/(app)/academico/recuperacoes/AgendaPublicada.tsx",
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/FormularioOcorrencia.tsx",
  "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/Formulario.tsx",
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/Formulario.tsx",
  "src/app/(app)/alunos/[id]/FichaAluno.tsx",
  "src/app/(app)/configuracao/migracao/[loteId]/AplicarVinculoMigracao.tsx",
  "src/app/(app)/configuracao/operacao/OperacaoFormulario.tsx",
  "src/app/(app)/configuracao/paises/PaisFormulario.tsx",
  "src/app/(app)/diario/encontros/[id]/remarcacao/RemarcacaoParticular.tsx",
  "src/app/(app)/diario/reposicoes/ReposicoesEquipe.tsx",
  "src/app/(app)/leads/[id]/contratacao/AgendaParticularFormulario.tsx",
  "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/agenda/ConferenciaAgendaFormulario.tsx",
  "src/app/(app)/matriculas/[id]/fechamentos-horas/PrepararFechamento.tsx",
  "src/app/(app)/matriculas/[id]/nova-reserva/Formulario.tsx",
  "src/app/(app)/preferencias/FusoExibicaoFormulario.tsx",
  "src/app/portal-aluno/preferencias-formulario.tsx",
];

describe("fuso e instante: campo de fuso só pelo CampoFuso; instante nunca cru na tela (docs/43 §6 item 6)", () => {
  const telas = telasDeProducao();
  const achados = telas.flatMap(({ arquivo, fonte }) => analisar(fonte, arquivo));

  it("a varredura acha os arquivos (não passa vazia por erro de caminho) e inclui src/components e os migrados", () => {
    expect(telas.length).toBeGreaterThan(300);
    expect(telas.map((t) => t.arquivo)).toEqual(expect.arrayContaining([ARQUIVO_DO_CAMPO_FUSO, "src/components/PreviaConversao.tsx", ...MIGRADOS]));
  });

  it("nenhum campo/lista de fuso fora do CampoFuso e nenhum instante cru na tela — exceções ancoradas", () => {
    expect(conferirExcecoes(achados, EXCECOES)).toEqual({ semExcecao: [], soltas: [] });
  });

  it("cada exceção tem motivo de verdade", () => {
    for (const e of EXCECOES) expect(e.motivo.trim().length, `${e.arquivo}: ${e.trecho}`).toBeGreaterThan(30);
  });

  it("a lista de exceções é a combinada (cópia literal: acrescentar exceção exige mexer aqui também)", () => {
    expect(EXCECOES.map((e) => `${e.arquivo} :: ${e.tipo} :: ${e.trecho}`)).toEqual([
      "src/components/CampoFuso.tsx :: lista :: <datalist id={listaId}>",
    ]);
  });

  it("os migrados usam o CampoFuso", () => {
    for (const arquivo of MIGRADOS) expect(readFileSync(arquivo, "utf8"), arquivo).toMatch(/<CampoFuso\b/);
  });

  it("as listas fechadas da regra são as combinadas (cópia literal)", () => {
    expect(ATRIBUTOS_DE_NOME).toEqual(["name", "id", "list"]);
    expect(ATRIBUTOS_DE_VALOR).toEqual(["value", "defaultValue"]);
    expect(METODOS_CRUS).toEqual(["toISOString", "toJSON", "toUTCString"]);
    expect(CORTES).toEqual(["slice", "substring", "substr", "replace", "replaceAll", "trim", "split", "padStart", "padEnd", "toString", "concat"]);
    expect(ATRIBUTOS_SEM_TEXTO).toEqual(["key", "href", "id", "htmlFor", "name", "value", "defaultValue", "min", "max", "className", "list", "action", "src", "dateTime"]);
    expect(ATRIBUTOS_DE_TEXTO).toEqual(["title", "aria-label", "placeholder", "alt", "label"]);
  });

  it("a trava e a medição chegam ao mesmo conjunto (scripts/medicao-ux/fuso.mjs, nos mesmos arquivos)", () => {
    const daTrava = achados.filter((a) => a.tipo !== "opaco").map((a) => `${a.arquivo}:${a.linha} :: ${a.tipo === "instante" ? "instante" : a.tipo}`).sort();
    const daMedicao = telas.flatMap(({ arquivo, fonte }) => {
      const linha = (pos: number) => fonte.slice(0, pos).split("\n").length;
      return [
        ...camposDeFuso(fonte).map((c) => `${arquivo}:${linha(c.pos)} :: ${c.tipo}`),
        ...instantesCrus(fonte).map((c) => `${arquivo}:${linha(c.pos)} :: instante`),
      ];
    }).sort();
    expect(daTrava).toEqual(daMedicao);
    // O conjunto de hoje: só a lista do próprio CampoFuso (a exceção ancorada).
    expect(daTrava).toEqual([expect.stringMatching(/^src\/components\/CampoFuso\.tsx:\d+ :: lista$/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// Autotestes em fonte virtual: cada forma antiga e cada evasão é acusada; as formas certas passam.
// A medição (texto) é conferida junto quando o caso é de texto simples, para as duas não divergirem.
// ---------------------------------------------------------------------------------------------------
const tela = (jsx: string, antes = "") => `${antes}\nexport function Tela(props: { fuso: string; c: { criadaEm: Date } }) {\n  return <div>${jsx}</div>;\n}\n`;
const tipos = (fonte: string) => analisar(fonte).map((a) => a.tipo);
const daMedicao = (fonte: string) => [...camposDeFuso(fonte).map((c) => c.tipo), ...instantesCrus(fonte).map(() => "instante")];

describe("regra A (autoteste): campo de fuso", () => {
  it("as formas que existiam (uma de cada jeito dos 20 campos) são acusadas, pela trava e pela medição", () => {
    const formas = [
      '<label>Fuso dos horários<input name="fuso" required defaultValue={props.fuso} /></label>',
      '<label>Fuso dos horários<input name="fusoOrigem" required maxLength={100} placeholder="America/Sao_Paulo" /></label>',
      '<label>Fuso novo<input name={`fuso-${props.fuso}`} defaultValue={props.fuso} required /></label>',
      '<label>Fuso de origem da turma<input required value={fuso} onChange={(e) => setFuso(e.target.value)} /></label>',
      '<input id="pais-fuso" {...register("fuso")} className={inputCls} />',
      '<Campo id="ficha-fuso" rotulo="Fuso horário">{(campo) => <input {...campo} value={ed.fuso} onChange={(e) => set("fuso", e.target.value)} />}</Campo>',
      '<input aria-label="Fuso IANA" placeholder="America/Costa_Rica" value={formulario.fusoReferencia} />',
      '<input id={id} list={`${id}-fusos`} value={fuso} onChange={e => setFuso(e.target.value)} />',
      '<label>Fuso do período<input name="fuso" placeholder="Ex.: America/Sao_Paulo" required /></label>',
    ];
    for (const f of formas) {
      expect(tipos(tela(f)), f).toEqual(["campo"]);
      expect(daMedicao(tela(f)), f).toEqual(["campo"]);
    }
  });

  it("datalist de fusos (por id, por opção IANA, pela lista do Intl) e select com opção IANA são listas", () => {
    for (const l of ['<datalist id="fusos-grade"><option value="UTC"/></datalist>', '<datalist id={listaId}><option value="America/Manaus" /></datalist>', "<datalist id={lista}>{Intl.supportedValuesOf(\"timeZone\").map((f) => <option key={f} value={f} />)}</datalist>", '<select name="regiao"><option value="America/Sao_Paulo">São Paulo</option></select>']) {
      expect(tipos(tela(l)), l).toEqual(["lista"]);
      expect(daMedicao(tela(l)), l).toEqual(["lista"]);
    }
  });

  it("evasões: createElement, jsx, tag por constante, timeZone e spread de objeto", () => {
    expect(tipos(tela('{createElement("input", { name: "fuso" })}'))).toEqual(["campo"]);
    expect(tipos(tela('{jsx("input", { name: "fusoOrigem" })}'))).toEqual(["campo"]);
    expect(tipos(tela('{React.createElement("datalist", { id: "x" }, createElement("option", { value: "UTC" }))}'))).toEqual(["lista"]);
    expect(tipos(tela('<Campo name="fuso" />', 'const Campo = "input";'))).toEqual(["campo"]);
    expect(tipos(tela('<T name="fuso" />', 'const T = cond ? "select" : "input";'))).toEqual(["campo"]);
    expect(tipos(tela('<input name="timeZone" />'))).toEqual(["campo"]);
    expect(tipos(tela('<input {...{ name: "fuso" }} />'))).toEqual(["campo"]);
  });

  it("o certo passa: CampoFuso, hidden com o fuso decidido, campo que não é de fuso, 'confuso'", () => {
    for (const ok of [
      '<label>Fuso dos horários<CampoFuso name="fusoOrigem" padrao={props.fuso} className="x" /></label>',
      '<input name="fuso" type="hidden" value={props.fuso} readOnly />',
      '<label>Início local<input name="inicioLocal" type="datetime-local" defaultValue={campoData(e.inicio, e.fusoOrigem)} /></label>',
      '<input name="confuso" value={confusao} />',
      '<label>Professor<select name="professorId"><option value="p1">Ana</option></select></label>',
      '<select value={ensaioId}><option value={e.id}>{e.texto} (horário exibido em {exibicao.fuso})</option></select>',
    ]) {
      expect(tipos(tela(ok)), ok).toEqual([]);
      expect(daMedicao(tela(ok)), ok).toEqual([]);
    }
  });

  it("falha fechada: arquivo que não analisa é achado", () => {
    expect(analisar("export function T() { return <div>; }").map((a) => a.problema)).toEqual([expect.stringMatching(/^não analisa/)]);
  });

  it("as regras de texto são as combinadas (palavra, IANA, exemplo, rótulo, nome de valor)", () => {
    expect(["fuso", "fusoOrigem", "pais-fuso", "fuso-${id}", "listaFusosId", "timeZone"].every((t) => PALAVRA_DE_FUSO.test(t))).toBe(true);
    expect(PALAVRA_DE_FUSO.test("confuso")).toBe(false);
    expect(IDENTIFICADOR_IANA.test('"America/Sao_Paulo"') && IDENTIFICADOR_IANA.test('"UTC"')).toBe(true);
    expect(EXEMPLO_DE_FUSO.test("Ex.: America/Costa_Rica") && !EXEMPLO_DE_FUSO.test("Ex.: Ana Souza")).toBe(true);
    expect(ROTULO_DE_FUSO.test("Fuso do encontro") && !ROTULO_DE_FUSO.test("Data no fuso informado")).toBe(true);
    expect(["fuso", "fusoOrigem", "fusoInstitucional"].every((t) => NOME_DE_FUSO.test(t)) && !NOME_DE_FUSO.test("inicio")).toBe(true);
  });
});

describe("regra B (autoteste): instante na tela", () => {
  it("as formas que existiam (uma de cada jeito dos 11 instantes) são acusadas, pela trava e pela medição", () => {
    const formas = [
      "<p>Conferida em {props.c.criadaEm.toISOString()} (UTC).</p>",
      "<p>Registrada em {new Date(item.criadaEm).toISOString()} (UTC).</p>",
      "<p>{p.preparador.nome}, {p.criadaEm.toISOString()}.</p>",
      "<p>em {p.dataPedido.toISOString().slice(0, 10)}.</p>",
      '<p>em {m.criadaEm.toISOString().replace("T", " ").slice(0, 19)} UTC.</p>',
    ];
    for (const f of formas) {
      expect(tipos(tela(f)), f).toEqual(["instante"]);
      expect(daMedicao(tela(f)), f).toEqual(["instante"]);
    }
    const template = 'function instanteDoEvento(valor: string) { const instante = new Date(valor); return `${instante.toISOString().replace("T", " ")} (fuso institucional não configurado)`; }';
    expect(tipos(tela("<p>{instanteDoEvento(x)}</p>", template))).toEqual(["instante"]);
    expect(daMedicao(tela("<p>{instanteDoEvento(x)}</p>", template))).toEqual(["instante"]);
  });

  it("evasões: toJSON/toUTCString, ??, ternário, &&, +, String(), constante local, função local, atributo de texto, .call e nome calculado", () => {
    expect(tipos(tela("<p>{d.toJSON()}</p>"))).toEqual(["instante"]);
    expect(tipos(tela("<p>{d.toUTCString()}</p>"))).toEqual(["instante"]);
    expect(tipos(tela('<p>{d?.toISOString() ?? "—"}</p>'))).toEqual(["instante"]);
    expect(tipos(tela('<p>{ok ? d.toISOString() : "—"}</p>'))).toEqual(["instante"]);
    expect(tipos(tela("<p>{ok && d.toISOString()}</p>"))).toEqual(["instante"]);
    expect(tipos(tela('<p>{"Em " + d.toISOString()}</p>'))).toEqual(["instante"]);
    expect(tipos(tela("<p>{String(d.toISOString())}</p>"))).toEqual(["instante"]);
    expect(tipos(tela("<p>{iso}</p>", "const iso = new Date().toISOString();"))).toEqual(["instante"]);
    expect(tipos(tela("<p>{quando(d)}</p>", "const quando = (d: Date) => d.toISOString().slice(0, 16);"))).toEqual(["instante"]);
    expect(tipos(tela("<abbr title={d.toISOString()}>agora</abbr>"))).toEqual(["instante"]);
    expect(tipos(tela("<p>{Date.prototype.toISOString.call(d)}</p>"))).toEqual(["instante"]);
    expect(tipos(tela('<p>{d["toISOString"]()}</p>'))).toEqual(["instante"]);
    expect(tipos(tela("<p>{d[metodo]()}</p>"))).toEqual(["opaco"]);
    expect(tipos(tela("<>{d.toISOString()}</>"))).toEqual(["instante"]);
  });

  it("o certo passa: formatado, como atributo sem texto, como payload e template de key", () => {
    for (const ok of [
      '<p>Conferida em {formatarInstanteExibicao(c.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC).</p>',
      "<p>de {data(r.inicio.toISOString())} a {data(r.fim.toISOString())}.</p>",
      "<input type=\"datetime-local\" max={d.toISOString().slice(0, 16)} />",
      "<Componente criadoEm={c.criadaEm.toISOString()} />",
      "<li key={`${e.criadoEm.toISOString()}-${i}`}>x</li>",
      "<p>{dataCivil(p.dataPedido)}</p>",
    ]) {
      const fonte = tela(ok, "const dataCivil = (d: Date) => formatarDataCivil(d.toISOString().slice(0, 10));");
      expect(tipos(fonte), ok).toEqual([]);
      expect(daMedicao(fonte), ok).toEqual([]);
    }
  });
});
