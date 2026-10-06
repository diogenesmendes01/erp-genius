import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  AlcanceImpactoQuantidadeAulas, CanalAvisoAlteracaoAgenda, CategoriaDocumento, ClassificacaoImpactoCoberturaAditivo,
  DecisaoImpactoTaxaAditivo, EstadoDiaCompensacao, EstadoEnvioAssinatura, EstadoLinhaPreparacaoMigracao,
  EstadoReconferenciaDeltaDesistencia, EstadoReservaDevolucaoCredito, FinalidadeTokenPortalAluno,
  ModalidadeConciliacaoFinanceiraMigracao, MotivoPendenciaAvisoAgenda, ParticipacaoAula, ResultadoEnsaioVinculoMigracao,
  SituacaoAplicacaoCadastroMigracao, SituacaoAvisoAlteracaoAgenda, SituacaoEnvioPortalAluno, SituacaoPropostaQuantidadeAulas,
  SituacaoTrocaEmailPortalAluno, StatusConjuntoImpactosCoberturaAditivo, StatusConjuntoImpactosTaxaAditivo,
  StatusCorrecaoCadastro, StatusFaturaB2B, StatusIntencao, StatusMudancaAcademica, StatusPropostaAcertoTaxaAditivo,
  StatusPropostaConciliacaoFinanceiraMigracao, StatusPropostaEntradaFinanceiraHistoricaMigracao,
  StatusPropostaPresencaHistoricaMigracao, StatusReservaSegundaChamada, StatusReservaVaga, StatusSolicitacaoEncerramento,
  StatusTemplate, StatusTurma, TipoAjuste, TipoAprovacao, TipoDestinacaoRecebimento, TipoMensagem, TipoMovimentacao,
  TipoSugestaoIA, UnidadePermutaServico, Vigencia, StatusEncontroAgenda, StatusPagamentoInformado, ReferenciaCoberturaMensal,
  FinalidadeNumero, FormaAgendaOferta,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as L from "@/lib/labels";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { PagadorEntradaFinanceiraHistoricaSchema } from "@/server/migracao/entrada-financeira-historica-schema";
import { OcorrenciaHorasSchema } from "@/server/matricula/ocorrencia-horas";
import { SaldoCompraHorasSchema } from "@/server/matricula/saldo-horas";

// E5 (docs/42-auditoria-frontend-ux.md §5.7): enum cru na tela ("Estado: PREVISTO", "COMPREENSAO ORAL",
// "PENDENTE_DECISAO") e mapas de rótulo soltos em telas (30 ad-hoc em 23 arquivos). A trava tem três
// partes:
//   (i)  telas não montam rótulo a partir do código (`replaceAll("_", " ")`, `.toLowerCase()` do enum) nem
//        imprimem campo de enum direto no texto do JSX — por AST, e por RENDERIZAÇÃO em cinco telas,
//        cada uma com todos os valores dos seus enums;
//   (ii) mapa de rótulo de enum (objeto literal com chaves de um enum e valores de texto) só existe em
//        src/lib/labels.ts — exceções ancoradas (arquivo + nome + motivo), cada uma casando com um caso;
//   (iii) os mapas novos de labels.ts cobrem exatamente os valores do enum e não repetem o código cru.

// ---------------------------------------------------------------------------------------------------
// Fontes e enums
// ---------------------------------------------------------------------------------------------------

/** Enums do schema (lidos do próprio schema.prisma) + habilidades avaliadas (enum de domínio). */
function enumsDoSchema(schema: string): Map<string, string[]> {
  const enums = new Map<string, string[]>();
  for (const m of schema.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const valores = m[2].split("\n").map((l) => l.replace(/\/\/.*$/, "").trim().split(/\s+/)[0]).filter((v) => /^[A-Z][A-Z0-9_]*$/.test(v ?? ""));
    enums.set(m[1], valores);
  }
  return enums;
}
const ENUMS = enumsDoSchema(readFileSync("prisma/schema.prisma", "utf-8"));
ENUMS.set("Habilidade", [...HABILIDADES]);

const fontes = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.(t|j)sx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** Árvore sintática; o tipo de script segue a extensão (.ts não é lido como TSX: `<T>(x)` viraria JSX). */
const arvore = (fonte: string, arquivo = "x.tsx") => ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true,
  arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : arquivo.endsWith(".jsx") ? ts.ScriptKind.JSX : arquivo.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
const visitar = (no: ts.Node, f: (n: ts.Node) => void) => { f(no); ts.forEachChild(no, (filho) => visitar(filho, f)); };
const linhaDe = (sf: ts.SourceFile, no: ts.Node) => sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1;

// ---------------------------------------------------------------------------------------------------
// (i) enum cru na tela — por AST
// ---------------------------------------------------------------------------------------------------

/** Campos que carregam valor de enum nas telas (status, situação, tipo…). */
const CAMPOS_ENUM = new Set([
  "status", "situacao", "estado", "tipo", "canal", "papel", "finalidade", "habilidade", "participacao",
  "statusMatricula", "matriculaStatus", "encontroStatus", "statusReserva", "statusBeneficio", "statusMeta",
  "alcance", "classificacao", "categoria", "modalidade", "unidade", "etapa", "forma", "temperatura", "segmento", "vigencia",
]);
/** Nomes exatos que também carregam enum (revisão R1 da #138, B1). */
const CAMPOS_ENUM_EXATOS = new Set(["decisao", "ambiente", "destino", "desfecho"]);
/** Bases que nomeiam enum também com complemento (`estadoEnvio`, `ocorrenciaHistoricaTipo`). */
const BASES_COMPOSTAS = ["status", "situacao", "estado", "tipo", "participacao", "desfecho", "finalidade", "classificacao"];
/** Complemento que faz do campo um identificador, data ou texto — não o enum (`statusId`, `estadoEm`, `tipoNome`). */
const COMPLEMENTO_NAO_ENUM = /(Id|Ids|Em|Hash|Nome|Codigo|Texto|Rotulo|Label|Versao|Conferido)$/;
/** Nome de campo de enum: o nome da lista (`status`, `decisao`), a base com complemento
 * (`estadoEnvio`, `participacaoAnterior`) ou o complemento com a base no fim (`ocorrenciaHistoricaTipo`). */
export const nomeDeEnum = (nome: string) => CAMPOS_ENUM.has(nome) || CAMPOS_ENUM_EXATOS.has(nome)
  || (!COMPLEMENTO_NAO_ENUM.test(nome) && BASES_COMPOSTAS.some((b) => (nome.startsWith(b) && /^[A-Z]/.test(nome.slice(b.length)))
    || (nome.length > b.length && nome.endsWith(b[0].toUpperCase() + b.slice(1)))));
/** Atributos JSX que são texto lido pela pessoa (os demais — key, href, name, value… — não são). */
const ATRIBUTOS_TEXTO = new Set(["title", "aria-label", "placeholder", "alt", "aria-description"]);

const semEmbrulho = (e: ts.Expression): ts.Expression => {
  let atual = e;
  while (ts.isParenthesizedExpression(atual) || ts.isNonNullExpression(atual) || ts.isAsExpression(atual) || ts.isSatisfiesExpression(atual)) atual = atual.expression;
  return atual;
};
/** Tira embrulhos que não mudam o texto: `String(x)`, `x.toString()`, `` `${x}` `` sozinho. */
const semConversao = (e: ts.Expression): ts.Expression => {
  let x = semEmbrulho(e);
  for (;;) {
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === "String" && x.arguments.length === 1) x = semEmbrulho(x.arguments[0]);
    else if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === "toString" && !x.arguments.length) x = semEmbrulho(x.expression.expression);
    else if (ts.isTemplateExpression(x) && !x.head.text && x.templateSpans.length === 1 && !x.templateSpans[0].literal.text) x = semEmbrulho(x.templateSpans[0].expression);
    else return x;
  }
};
/** Valores de texto das constantes do arquivo (`const SEP = "_"`), por nome — para argumento passado por nome. */
function constantesDeTexto(sf: ts.SourceFile): Map<string, string[]> {
  const m = new Map<string, string[]>();
  visitar(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    const i = semEmbrulho(n.initializer);
    if (ts.isStringLiteralLike(i)) m.set(n.name.text, [...(m.get(n.name.text) ?? []), i.text]);
  });
  return m;
}
/** Os textos que a expressão pode ser: literal, ou constante do arquivo com esse nome. */
const textosDe = (e: ts.Expression | undefined, consts: Map<string, string[]>): string[] => {
  if (!e) return [];
  const x = semEmbrulho(e);
  if (ts.isStringLiteralLike(x)) return [x.text];
  return ts.isIdentifier(x) ? consts.get(x.text) ?? [] : [];
};
/** Regex que pega "_" e não pega letra nem dígito (`/_/g`, `/_+/g`, `/[_]/g`, `/[_-]+/g`…). */
const regexDeSublinhado = (literal: string) => {
  const m = /^\/(.*)\/([a-z]*)$/s.exec(literal);
  if (!m) return false;
  try { const re = new RegExp(m[1], m[2].replace(/[gy]/g, "")); return re.test("_") && !re.test("a") && !re.test("A") && !re.test("0"); } catch { return false; }
};
/** Funções que transformam o código em rótulo — o valor que sai delas é texto de gente. */
const ROTULADORES = new Set(["rotular"]);
/** Métodos cujo resultado não carrega o texto do receptor (booleano, número, posição). */
const METODOS_SEM_TEXTO = new Set(["includes", "has", "some", "every", "startsWith", "endsWith", "test", "indexOf", "lastIndexOf",
  "findIndex", "localeCompare", "get", "find", "filter", "getTime", "valueOf"]);
/** Props de componente que viram texto lido (as de valor/estado — status, value, key… — não). */
const PROPS_TEXTO = new Set(["texto", "titulo", "rotulo", "label", "descricao", "mensagem", "legenda", "children", "title", "aria-label"]);
const OPS_QUE_CARREGAM_TEXTO = new Set([ts.SyntaxKind.PlusToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken]);

/** As expressões que uma função devolve (corpo de expressão ou cada `return` do bloco, sem entrar em função aninhada). */
function retornos(fn: ts.ArrowFunction | ts.FunctionExpression): ts.Expression[] {
  if (!ts.isBlock(fn.body)) return [fn.body];
  const r: ts.Expression[] = [];
  const andar = (n: ts.Node) => {
    if (ts.isReturnStatement(n) && n.expression) r.push(n.expression);
    if (!ts.isFunctionLike(n)) ts.forEachChild(n, andar);
  };
  ts.forEachChild(fn.body, andar);
  return r;
}

/**
 * Rastreia o campo de enum até o texto (revisão R2 da #138, B5): em vez de listar formas, desce por QUALQUER
 * expressão e só para onde o valor deixa de ser o código — `rotular(MAPA, x)`, `MAPA[x]`, comparação,
 * condição de ternário/`&&`, método que devolve booleano/número. Concatenação, template, `join`, `trim`,
 * `slice`, helper de identidade, `.map` (corpo de expressão ou de bloco) — tudo carrega o código adiante.
 * Alias por `const`, desestruturação, atribuição e parâmetro de `Object.values(Enum).map(...)` contam; o
 * escopo do nome é o arquivo (falha fechada).
 */
function rastreadorDeEnum(sf: ts.SourceFile, arquivo?: string): Rastreador {
  const consts = constantesDeTexto(sf), aliases = new Set<string>();
  const enumsImportados = new Set<string>();
  /** Nome importado de outro arquivo do projeto → caminho do arquivo (para analisar o helper na origem). */
  const importados = new Map<string, string>();
  for (const d of sf.statements) {
    if (!ts.isImportDeclaration(d) || !ts.isStringLiteral(d.moduleSpecifier)) continue;
    const b = d.importClause?.namedBindings, origem = d.moduleSpecifier.text;
    if (origem === "@prisma/client" && b && ts.isNamedImports(b)) for (const e of b.elements) enumsImportados.add(e.name.text);
    const caminho = arquivo && resolverModulo(arquivo, origem);
    if (caminho && b && ts.isNamedImports(b)) for (const e of b.elements) importados.set(e.name.text, caminho + "#" + (e.propertyName ?? e.name).text);
  }
  const campoDireto = (x: ts.Expression) => (ts.isPropertyAccessExpression(x) && nomeDeEnum(x.name.text))
    || (ts.isElementAccessExpression(x) && textosDe(x.argumentExpression, consts).some(nomeDeEnum));
  // Funções locais (declaração ou const com arrow/function): o código só atravessa uma delas se ela devolve
  // o parâmetro (ou algo feito dele) sem rotular — `const tipo = (v) => rotular(MAPA, v)` é seguro.
  const funcoes = new Map<string, ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration>();
  visitar(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) funcoes.set(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(semEmbrulho(n.initializer)) || ts.isFunctionExpression(semEmbrulho(n.initializer)))) funcoes.set(n.name.text, semEmbrulho(n.initializer) as ts.ArrowFunction);
  });
  const deixaPassar = new Map<string, boolean>();
  const atravessa = (nome: string): boolean => {
    if (deixaPassar.has(nome)) return deixaPassar.get(nome)!;
    deixaPassar.set(nome, true); // recursão: falha fechada
    const fn = funcoes.get(nome)!;
    const params = new Set(fn.parameters.flatMap((p) => ts.isIdentifier(p.name) ? [p.name.text] : []));
    const corpo = ts.isFunctionDeclaration(fn) ? retornos({ body: fn.body! } as ts.FunctionExpression) : retornos(fn);
    const r = corpo.some((e) => crus(e, params).length > 0);
    deixaPassar.set(nome, r);
    return r;
  };
  const crus = (e: ts.Expression, params: ReadonlySet<string> = new Set()): ts.Expression[] => {
    const x = semEmbrulho(e);
    if (campoDireto(x)) return [x];
    if (ts.isIdentifier(x)) return aliases.has(x.text) || params.has(x.text) ? [x] : [];
    if (ts.isConditionalExpression(x)) return [...crus(x.whenTrue, params), ...crus(x.whenFalse, params)];
    if (ts.isBinaryExpression(x)) {
      const op = x.operatorToken.kind;
      if (OPS_QUE_CARREGAM_TEXTO.has(op)) return [...crus(x.left, params), ...crus(x.right, params)];
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.CommaToken) return crus(x.right, params);
      return [];
    }
    if (ts.isTemplateExpression(x)) return x.templateSpans.flatMap((s) => crus(s.expression, params));
    if (ts.isArrayLiteralExpression(x)) return x.elements.flatMap((el) => crus(ts.isSpreadElement(el) ? el.expression : el, params));
    if (ts.isCallExpression(x)) {
      if (ts.isIdentifier(x.expression) && ROTULADORES.has(x.expression.text)) return [];
      if (ts.isPropertyAccessExpression(x.expression)) {
        const metodo = x.expression.name.text, [fn] = x.arguments;
        if (METODOS_SEM_TEXTO.has(metodo)) return [];
        if (["map", "flatMap"].includes(metodo) && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return retornos(fn).flatMap((r) => crus(r, params));
        return [...crus(x.expression.expression, params), ...x.arguments.flatMap((a) => crus(a, params))];
      }
      // Função local que rotula não deixa passar; a que devolve o parâmetro, e a de fora do arquivo (falha
      // fechada), deixam o código atravessar pelos argumentos.
      if (ts.isIdentifier(x.expression) && funcoes.has(x.expression.text) && !atravessa(x.expression.text)) return [];
      if (ts.isIdentifier(x.expression) && importados.has(x.expression.text)) {
        const [caminho, nome] = importados.get(x.expression.text)!.split("#");
        const outro = rastreadorDoArquivo(caminho);
        if (outro.funcoes.has(nome) && !outro.atravessa(nome)) return [];
      }
      return x.arguments.flatMap((a) => crus(a, params));
    }
    return [];
  };
  // Ponto fixo dos aliases: um pode guardar outro (`const a = d.status; const b = "" + a;`).
  for (let mudou = true; mudou;) {
    mudou = false;
    const marcar = (nome: string) => { if (!aliases.has(nome)) { aliases.add(nome); mudou = true; } };
    visitar(sf, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && crus(n.initializer).length) marcar(n.name.text);
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left) && crus(n.right).length) marcar(n.left.text);
      if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && !n.dotDotDotToken && ts.isObjectBindingPattern(n.parent)) {
        const chave = n.propertyName ? (ts.isIdentifier(n.propertyName) || ts.isStringLiteral(n.propertyName) ? n.propertyName.text : null) : n.name.text;
        if (chave && nomeDeEnum(chave)) marcar(n.name.text);
      }
      // Object.values(StatusTurma).map((v) => <option>{v}</option>): o parâmetro é o código.
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ["map", "flatMap", "forEach", "filter"].includes(n.expression.name.text)) {
        const alvo = semEmbrulho(n.expression.expression), [fn] = n.arguments;
        const deEnum = ts.isCallExpression(alvo) && /^Object\.(values|keys)$/.test(alvo.expression.getText(sf)) && alvo.arguments[0]
          && ts.isIdentifier(alvo.arguments[0]) && enumsImportados.has(alvo.arguments[0].text);
        if (deEnum && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && fn.parameters[0] && ts.isIdentifier(fn.parameters[0].name)) marcar(fn.parameters[0].name.text);
      }
    });
  }
  return { crus, campoDireto, consts, funcoes, atravessa };
}
type Rastreador = { crus: (e: ts.Expression) => ts.Expression[]; campoDireto: (x: ts.Expression) => boolean; consts: Map<string, string[]>;
  funcoes: Map<string, unknown>; atravessa: (nome: string) => boolean };
/** Caminho do arquivo do projeto que o import aponta ("./X", "../X", "@/X"), se existir. */
function resolverModulo(de: string, origem: string): string | null {
  const base = origem.startsWith("@/") ? "src/" + origem.slice(2) : origem.startsWith(".") ? posix.join(posix.dirname(de), origem) : null;
  if (!base) return null;
  return [".tsx", ".ts", "/index.tsx", "/index.ts"].map((ext) => base + ext).find((c) => existsSync(c)) ?? null;
}
const rastreadores = new Map<string, Rastreador>();
const rastreadorDoArquivo = (caminho: string): Rastreador => {
  if (!rastreadores.has(caminho)) rastreadores.set(caminho, rastreadorDeEnum(arvore(readFileSync(caminho, "utf-8"), caminho), caminho));
  return rastreadores.get(caminho)!;
};

export type EnumCru = { tipo: "sublinhado" | "caixa" | "texto"; trecho: string; linha: number };

/** O atributo JSX é texto lido? (atributo de texto do HTML, ou prop de texto de componente). */
const atributoDeTexto = (a: ts.JsxAttribute) => {
  const nome = a.name.getText();
  if (ATRIBUTOS_TEXTO.has(nome)) return true;
  const tag = a.parent.parent.tagName.getText();
  return /^[A-Z]|\./.test(tag) && PROPS_TEXTO.has(nome);
};

/** Enum cru que uma tela imprime ou transforma em "rótulo". */
export function enumsCrus(fonte: string, arquivo = "x.tsx"): EnumCru[] {
  const sf = arvore(fonte, arquivo);
  const achados: EnumCru[] = [];
  const achar = (tipo: EnumCru["tipo"], no: ts.Node) => achados.push({ tipo, trecho: no.getText(sf).replace(/\s+/g, " ").slice(0, 90), linha: linhaDe(sf, no) });
  const { crus, campoDireto, consts } = rastreadorDeEnum(sf, arquivo);
  visitar(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text, [a, b] = n.arguments;
      // x.replaceAll("_", " "), x.replace(/_+/g, " "), x.replace(SEP, ESP), x.split("_") (código partido no "_")
      const sublinhado = (arg?: ts.Expression) => !!arg && (textosDe(arg, consts).includes("_") || (ts.isRegularExpressionLiteral(semEmbrulho(arg)) && regexDeSublinhado(semEmbrulho(arg).getText(sf))));
      const branco = (arg?: ts.Expression) => textosDe(arg, consts).some((t) => /^\s+$/.test(t));
      if ((metodo === "replaceAll" || metodo === "replace") && sublinhado(a) && branco(b)) achar("sublinhado", n);
      if (metodo === "split" && sublinhado(a)) achar("sublinhado", n);
      // x.status.toLowerCase(): o código em minúscula não é rótulo ("a agenda está cancelado")
      if (/^to(Locale)?(Lower|Upper)Case$/.test(metodo) && campoDireto(semConversao(n.expression.expression))) achar("caixa", n);
    }
    // Posições de texto: filho de JSX, atributo de texto, prop de texto de componente.
    if (ts.isJsxExpression(n) && n.expression) {
      const emTexto = ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent) || (ts.isJsxAttribute(n.parent) && atributoDeTexto(n.parent));
      if (emTexto) for (const campo of crus(n.expression)) achar("texto", campo);
    }
  });
  return achados;
}

/**
 * Código de enum escrito como TEXTO na tela (revisão R2/R3 da #138, B10): `"PAGAMENTO_COMPROVADO"` no lugar de
 * "Pagamento comprovado". Procura, nas posições de texto (filho de JSX, texto solto do JSX, atributo e prop
 * de texto), literais que chegam ao texto — ramos de ternário, `??`/`||`/`+`, `&&` à direita, partes de
 * template, itens de lista, argumentos de função que não rotula — e acusa cada palavra com cara de código
 * (MAIÚSCULAS com "_"). Com `codigos`, só os códigos dessa lista; sem ela (`null`), qualquer código — também
 * os de domínio que não estão no schema (`PAGAMENTO_COMPROVADO` é situação da conciliação de migração).
 */
export function codigosEmTexto(fonte: string, codigos: ReadonlySet<string> | null, arquivo = "x.tsx"): { codigo: string; linha: number }[] {
  const sf = arvore(fonte, arquivo);
  const achados: { codigo: string; linha: number }[] = [];
  const palavras = (texto: string, no: ts.Node) => {
    for (const p of texto.match(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/g) ?? []) if (!codigos || codigos.has(p)) achados.push({ codigo: p, linha: linhaDe(sf, no) });
  };
  const literais = (e: ts.Expression) => {
    const x = semEmbrulho(e);
    if (ts.isStringLiteralLike(x)) return palavras(x.text, x);
    if (ts.isTemplateExpression(x)) { palavras(x.head.text, x); for (const s of x.templateSpans) { literais(s.expression); palavras(s.literal.text, s); } return; }
    if (ts.isConditionalExpression(x)) { literais(x.whenTrue); literais(x.whenFalse); return; }
    if (ts.isBinaryExpression(x)) {
      const op = x.operatorToken.kind;
      if (OPS_QUE_CARREGAM_TEXTO.has(op)) { literais(x.left); literais(x.right); }
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) literais(x.right);
      return;
    }
    if (ts.isArrayLiteralExpression(x)) { for (const el of x.elements) literais(ts.isSpreadElement(el) ? el.expression : el); return; }
    if (ts.isCallExpression(x) && !(ts.isIdentifier(x.expression) && ROTULADORES.has(x.expression.text))) for (const a of x.arguments) literais(a);
  };
  visitar(sf, (n) => {
    if (ts.isJsxText(n)) palavras(n.text, n);
    if (ts.isJsxExpression(n) && n.expression) {
      const emTexto = ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent) || (ts.isJsxAttribute(n.parent) && atributoDeTexto(n.parent));
      if (emTexto) literais(n.expression);
    }
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && atributoDeTexto(n)) palavras(n.initializer.text, n);
  });
  return achados;
}

/** Código que a tela mostra de propósito (não é enum a rotular). Cada um casa com exatamente um achado. */
const CODIGOS_EM_TEXTO: { arquivo: string; codigo: string; motivo: string }[] = [
  { arquivo: "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx", codigo: "ANTHROPIC_API_KEY", motivo: "nome da variável de ambiente que a Administração precisa configurar" },
];

/** Campos com nome de enum que já chegam como texto (o servidor rotulou) ou não são enum. Cada um casa com
 * exatamente `vezes` achados (1, se omitido). */
const TEXTO_JA_ROTULADO: { arquivo: string; trecho: string; motivo: string; vezes?: number }[] = [
  { arquivo: "src/app/(app)/academico/recuperacoes/page.tsx", trecho: "item.estado", motivo: "o servidor já devolve o texto (\"Sem nota\", \"Oficializada\"…), server/avaliacoes/recuperacao-consulta.ts" },
  { arquivo: "src/app/(app)/financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx", trecho: "c.tipo", motivo: "tipo de comissão já rotulado no servidor (\"Fixa\"/\"Percentual\"), server/contratos/aditivo-acerto-taxa-consulta.ts" },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", trecho: "acerto.alcance", motivo: "frase montada por descreverAcerto (\"todas as cobranças da matrícula\"…)" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx", trecho: "t.categoria", motivo: "categoria do template na Meta (utility/marketing), texto livre e não enum do schema" },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx", trecho: "p.destino", motivo: "frase montada pela página (\"Aula T-01 — …\" / \"Reposição M-1 — Ana\"), regularizacoes-gravacao/page.tsx" },
  { arquivo: "src/app/(app)/alunos/[id]/creditos/[creditoId]/DevolucaoCredito.tsx", trecho: "p.destino", motivo: "destino da devolução digitado pela pessoa (texto livre), server/financeiro/devolucao-credito.ts" },
  { arquivo: "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx", trecho: "impacto.destino", vezes: 2, motivo: "código ou nome da turma de destino, resolvido no servidor (diario/correcao-reposicao-consulta.ts)" },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx", trecho: "statusOrigem", motivo: "situação no sistema de origem, texto do legado preservado (CorrespondenciaStatusMatriculaMigracao.statusOrigem é String)" },
];

describe("(i) enum cru na tela — AST", () => {
  const achados = fontes.flatMap(({ arquivo, conteudo }) => enumsCrus(conteudo, arquivo).map((a) => ({ arquivo, ...a })));

  it("nenhuma tela monta rótulo trocando \"_\" por espaço nem muda a caixa do código", () => {
    expect(achados.filter((a) => a.tipo !== "texto").map((a) => `${a.arquivo}:${a.linha} ${a.trecho}`)).toEqual([]);
  });

  it("nenhuma tela imprime campo de enum direto no texto (rotular(MAPA, valor) ou MAPA[valor])", () => {
    const sobra = achados.filter((a) => a.tipo === "texto" && !TEXTO_JA_ROTULADO.some((e) => e.arquivo === a.arquivo && e.trecho === a.trecho));
    expect(sobra.map((a) => `${a.arquivo}:${a.linha} ${a.trecho}`)).toEqual([]);
  });

  it("cada exceção casa com exatamente os seus achados (exceção sem caso sai da lista)", () => {
    for (const e of TEXTO_JA_ROTULADO) {
      expect(achados.filter((a) => a.tipo === "texto" && a.arquivo === e.arquivo && a.trecho === e.trecho), `${e.arquivo} ${e.trecho}`).toHaveLength(e.vezes ?? 1);
    }
  });

  it("nenhuma tela escreve código de enum como texto (\"PAGAMENTO_COMPROVADO\" no lugar do rótulo)", () => {
    // Qualquer palavra com cara de código (MAIÚSCULAS com "_"), do schema ou de domínio, salvo as exceções.
    const escritos = fontes.flatMap(({ arquivo, conteudo }) => codigosEmTexto(conteudo, null, arquivo).map((a) => ({ arquivo, ...a })));
    expect(escritos.filter((a) => !CODIGOS_EM_TEXTO.some((e) => e.arquivo === a.arquivo && e.codigo === a.codigo)).map((a) => `${a.arquivo}:${a.linha} ${a.codigo}`)).toEqual([]);
    for (const e of CODIGOS_EM_TEXTO) expect(escritos.filter((a) => a.arquivo === e.arquivo && a.codigo === e.codigo), `${e.arquivo} ${e.codigo}`).toHaveLength(1);
  });

  it("autoteste (R3 da #138, B10): código de enum em texto solto, literal, template, ternário e atributo", () => {
    const codigos = new Set(["PAGAMENTO_COMPROVADO", "EM_ANDAMENTO"]);
    const achar = (fonte: string) => codigosEmTexto(fonte, codigos).map((a) => a.codigo);
    expect(achar("const r = <p>Proposto: PAGAMENTO_COMPROVADO</p>;")).toEqual(["PAGAMENTO_COMPROVADO"]);
    expect(achar('const r = <p>{x ? "PAGAMENTO_COMPROVADO" : "—"} {`Situação: EM_ANDAMENTO`}</p>;')).toEqual(["PAGAMENTO_COMPROVADO", "EM_ANDAMENTO"]);
    expect(achar('const r = <p title="EM_ANDAMENTO" aria-label={"Estado " + "PAGAMENTO_COMPROVADO"} />;')).toEqual(["EM_ANDAMENTO", "PAGAMENTO_COMPROVADO"]);
    // Não acusa: código em comparação, em valor/key/className, no argumento do rotular, ou que não é enum.
    expect(achar([
      'const r = <p className="EM_ANDAMENTO" key="PAGAMENTO_COMPROVADO">{s === "EM_ANDAMENTO" ? "Em andamento" : rotular(M, "PAGAMENTO_COMPROVADO")}</p>;',
      'const s = <><input value="EM_ANDAMENTO" /><p>OUTRO_CODIGO</p></>;',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste: o detector pega as formas conhecidas em fontes virtuais", () => {
    const tipos = (fonte: string) => enumsCrus(fonte).map((a) => `${a.tipo}:${a.trecho}`);
    expect(tipos('const r = <p>{i.habilidade.replaceAll("_", " ")}</p>;')).toEqual(["texto:i.habilidade", 'sublinhado:i.habilidade.replaceAll("_", " ")']);
    expect(tipos('const r = s.replace(/_/g, " ");')).toEqual(['sublinhado:s.replace(/_/g, " ")']);
    expect(tipos("const r = `(${t.statusMeta.toLowerCase().replace(\"_\", \" \")})`;")).toEqual([
      'sublinhado:t.statusMeta.toLowerCase().replace("_", " ")', "caixa:t.statusMeta.toLowerCase()",
    ]);
    expect(tipos('const r = x.split("_").join(" ");')).toEqual(['sublinhado:x.split("_")']);
    expect(tipos("const r = <p>Estado: {i.status}.</p>;")).toEqual(["texto:i.status"]);
    expect(tipos("const r = <p>{d.encontro!.status}</p>;")).toEqual(["texto:d.encontro!.status"]);
    expect(tipos('const r = <p>{x ? p.situacao : "—"} {NOTA[d.status] ?? d.status}</p>;')).toEqual(["texto:p.situacao", "texto:d.status"]);
    expect(tipos("const r = <h3>{`Proposta ${p.estado}`}</h3>;")).toEqual(["texto:p.estado"]);
    expect(tipos("const r = <input aria-label={`Motivo ${p.tipo}`} />;")).toEqual(["texto:p.tipo"]);
    expect(tipos("const r = <p>A agenda está {a.encontroStatus.toLowerCase()}</p>;")).toEqual(["texto:a.encontroStatus", "caixa:a.encontroStatus.toLowerCase()"]);
    // Não acusa: rótulo do mapa, key/name/value, comparação, campo que não é enum, minúscula de rótulo.
    expect(tipos([
      "const r = <li key={`${p.papel}:${p.etapa}`} data-x={p.status}>{rotular(MAPA, i.status)} {MAPA[i.status]} {p.nome}</li>;",
      "const s = <input name={`nota-${n.habilidade}`} value={c.tipo} />;",
      'const t = i.status === "PREVISTO" ? 1 : 2; const u = f.get(`${p.papel}_nome`);',
      "const v = <p>{rotular(MAPA, x.tipo).toLowerCase()} {busca.trim().toLowerCase()}</p>;",
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R2 da #138, B5): o código chega ao texto por qualquer expressão, atributo ou prop de texto", () => {
    const textos = (fonte: string) => enumsCrus(fonte).filter((a) => a.tipo === "texto").map((a) => a.trecho);
    const um = (jsx: string, extra = "") => textos(`${extra}\nconst r = ${jsx};`);
    expect(um("<p aria-label={d.status} title={d.tipo} />")).toEqual(["d.status", "d.tipo"]);
    expect(um('<p>{"" + d.status} {[d.status].join("")} {d.status.trim()}</p>')).toEqual(["d.status", "d.status", "d.status"]);
    expect(um("<p>{d.status.charAt(0) + d.status.slice(1).toLowerCase()}</p>")).toEqual(["d.status", "d.status"]);
    expect(um("<p>{cru(d.status)}</p>", "const cru = (s: string) => s;")).toEqual(["d.status"]);
    expect(um("<p>{s}</p>", 'let s = ""; s = d.status;')).toEqual(["s"]);
    expect(um("<p>{d[CAMPO]}</p>", 'const CAMPO = "status";')).toEqual(["d[CAMPO]"]);
    expect(um("<Etiqueta texto={d.status} />")).toEqual(["d.status"]);
    expect(um('<p>{xs.map((i) => { return i.status; }).join(", ")} {xs.map((i) => "" + i.tipo)}</p>')).toEqual(["i.status", "i.tipo"]);
    expect(um("<select>{Object.values(StatusTurma).map((v) => <option key={v}>{v}</option>)}</select>", 'import { StatusTurma } from "@prisma/client";')).toEqual(["v"]);
    expect(enumsCrus('const a = x.replaceAll("_", "\\u00a0"); const b = x.split("_").map((p) => p).join(" ");').map((a) => a.tipo)).toEqual(["sublinhado", "sublinhado"]);
    // Não acusa: rótulo, comparação, prop de estado de componente, value/key, helper que rotula, booleano.
    expect(textos([
      "const rot = (v: string) => rotular(MAPA, v);",
      'const r = <p>{rotular(MAPA, d.status)} {d.status === "A" ? "Sim" : "Não"} {lista.includes(d.status) ? "Na lista" : "Fora"} {rot(d.tipo)}</p>;',
      "const s = <><StatusBadge status={d.status} /><input value={d.status} key={d.tipo} /></>;",
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R1 da #138, B1): alias, desestruturação, String(), colchete, campo composto, regex e constante", () => {
    const tipos = (fonte: string) => enumsCrus(fonte).map((a) => `${a.tipo}:${a.trecho}`);
    expect(tipos("const s = d.status; const r = <p>{s}</p>;")).toEqual(["texto:s"]);
    expect(tipos("const a = d.status; const b = a; const r = <p>{b}</p>;")).toEqual(["texto:b"]);
    expect(tipos("const { situacao } = d; const r = <p>{situacao}</p>;")).toEqual(["texto:situacao"]);
    expect(tipos("const { status: s } = d; const r = <p>{s}</p>;")).toEqual(["texto:s"]);
    expect(tipos("function B({ estado }: P) { return <p>{estado}</p>; }")).toEqual(["texto:estado"]);
    expect(tipos("const r = <p>{String(d.status)} {d.tipo.toString()}</p>;")).toEqual(["texto:d.status", "texto:d.tipo"]);
    expect(tipos("const r = <p>{`${d.status}`}</p>;")).toEqual(["texto:d.status"]);
    expect(tipos('const r = <p>{d["status"]}</p>;')).toEqual(['texto:d["status"]']);
    expect(tipos("const r = <p>{processo.estadoEnvio} {i.decisao} {f.participacaoAnterior} {o.ocorrenciaHistoricaTipo} {p.ambiente}</p>;")).toEqual([
      "texto:processo.estadoEnvio", "texto:i.decisao", "texto:f.participacaoAnterior", "texto:o.ocorrenciaHistoricaTipo", "texto:p.ambiente",
    ]);
    expect(tipos('const r = <p>{xs.map((i) => i.status).join(", ")} {ys.map((y) => y.tipo)}</p>;')).toEqual(["texto:i.status", "texto:y.tipo"]);
    expect(tipos('const r = h.habilidade.replace(/_+/g, " ");')).toEqual(['sublinhado:h.habilidade.replace(/_+/g, " ")']);
    expect(tipos('const r = x.replace(/[_]/g, " ");')).toEqual(['sublinhado:x.replace(/[_]/g, " ")']);
    expect(tipos('const SEP = "_", ESP = " "; const r = x.replaceAll(SEP, ESP);')).toEqual(["sublinhado:x.replaceAll(SEP, ESP)"]);
    // Não acusa: id/data/nome/texto de campo de enum, motivo da decisão, rótulo de produto, regex que não pega "_" sozinho.
    expect(tipos([
      "const r = <p>{d.statusId} {d.estadoEm} {d.tipoNome} {d.motivoDecisao} {d.decisaoId} {p.produtoDestino}</p>;",
      'const s = x.replace(/a_b/g, " ");',
    ].join("\n"))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// (i) enum cru na tela — por renderização: cada tela com cada valor dos seus enums
// ---------------------------------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  avisos: vi.fn(), envios: vi.fn(), preferencia: vi.fn(), cancelamento: vi.fn(), quantidade: vi.fn(), segundas: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn(async () => ({ id: "u" })) }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/comunicacoes-agenda/consultas", () => ({ consultarAvisosAlteracaoAgenda: mocks.avisos }));
vi.mock("@/app/(app)/secretaria/avisos-agenda/ReconferirPendencia", () => ({ ReconferirPendencia: () => null }));
vi.mock("@/server/portal-aluno/fila-envios", () => ({ consultarFilaEnviosPortalAluno: mocks.envios }));
vi.mock("@/app/(app)/secretaria/envios-portal/ConciliacaoEnvio", () => ({ ConciliacaoEnvio: () => null }));
vi.mock("@/server/avaliacoes/recuperacao-agenda-cancelamento", () => ({ consultarCancelamentoAgendaRecuperacao: mocks.cancelamento }));
vi.mock("@/app/(app)/academico/avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => null }));
vi.mock("@/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/Formularios", () => ({ Propor: () => null, Decidir: () => null }));
vi.mock("@/server/agenda/modalidade-quantidade-consulta", () => ({ consultarPropostaQuantidadeAulasModalidade: mocks.quantidade }));
vi.mock("@/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas", () => ({ DecidirQuantidadeAulas: () => null }));
vi.mock("@/server/avaliacoes/segunda-chamada-docente", () => ({ listarSegundasChamadasDocente: mocks.segundas }));

import AvisosAgendaPage from "@/app/(app)/secretaria/avisos-agenda/page";
import EnviosPortalPage from "@/app/(app)/secretaria/envios-portal/page";
import CancelamentoRecuperacaoPage from "@/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/page";
import PropostaQuantidadePage from "@/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/page";
import MinhasSegundasChamadasPage from "@/app/(app)/academico/segundas-chamadas/minhas/page";

const instante = new Date("2026-10-01T03:30:00.000Z");
type Campos = Record<string, string>;
type Tela = { renderizar: (c: Campos) => Promise<string>; enums: { campo: string; valores: readonly string[]; mapa: Readonly<Record<string, string>>; fixo: string }[] };

const TELAS: Record<string, Tela> = {
  "/secretaria/avisos-agenda": {
    renderizar: async (c) => {
      mocks.avisos.mockResolvedValue({ ok: true, dado: {
        itens: [{ id: "a", alunoNome: "Ana", canal: c.canal, situacao: c.situacao, atualizadoEm: instante }],
        pendencias: [{ id: "p", matriculaId: "m", matriculaCodigo: "M-1", alunoNome: "Ana", motivo: c.motivo, situacao: "PENDENTE", criadoEm: instante }],
        proximoCursor: null, proximoCursorPendencia: null,
      } });
      return renderToStaticMarkup(await AvisosAgendaPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "canal", valores: Object.values(CanalAvisoAlteracaoAgenda), mapa: L.CANAL_AVISO_ALTERACAO_AGENDA_LABEL, fixo: "EMAIL" },
      { campo: "situacao", valores: Object.values(SituacaoAvisoAlteracaoAgenda), mapa: L.SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, fixo: "PREPARADO" },
      { campo: "motivo", valores: Object.values(MotivoPendenciaAvisoAgenda), mapa: L.MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, fixo: "CONTATO_INDISPONIVEL" },
    ],
  },
  "/secretaria/envios-portal": {
    renderizar: async (c) => {
      mocks.envios.mockResolvedValue({ ok: true, dado: { proximoCursor: null, itens: [
        { id: "e", alunoNome: "Ana", finalidade: c.finalidade, situacao: c.situacao, criadoEm: instante, atualizadoEm: instante, conciliacao: null },
      ] } });
      return renderToStaticMarkup(await EnviosPortalPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "finalidade", valores: Object.values(FinalidadeTokenPortalAluno), mapa: L.FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, fixo: "CONVITE" },
      { campo: "situacao", valores: Object.values(SituacaoEnvioPortalAluno), mapa: L.SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, fixo: "PREPARADO" },
    ],
  },
  "cancelamento da recuperação pela escola": {
    renderizar: async (c) => {
      mocks.cancelamento.mockResolvedValue({ ok: true, dado: {
        identificacao: {}, estadoConferido: "a".repeat(64), podePropor: false, proximoAntesId: null, propostas: [],
        atual: { reservaId: "r", matriculaId: "m", cancelamentoId: null, itens: [{ id: "i", habilidade: c.habilidade, realizacaoId: null, inicio: "2026-01-01T02:30:00Z", fim: "2026-01-01T03:30:00Z", status: c.status, fusoOrigem: "UTC" }] },
      } });
      return renderToStaticMarkup(await CancelamentoRecuperacaoPage({ params: Promise.resolve({ reservaId: "r" }), searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "habilidade", valores: HABILIDADES, mapa: L.HABILIDADE_LABEL, fixo: "LEITURA" },
      { campo: "status", valores: Object.values(StatusEncontroAgenda), mapa: L.STATUS_ENCONTRO_LABEL, fixo: "PREVISTO" },
    ],
  },
  "revisão da quantidade de aulas": {
    renderizar: async (c) => {
      mocks.quantidade.mockResolvedValue({ ok: true, dado: {
        id: "p", modalidadeId: "m", modalidade: { nome: "Inglês" }, versao: 2, quantidadeAnterior: 2, quantidadeNova: 3, situacao: c.situacao,
        motivo: "Revisão", preparador: { nome: "Secretaria" }, decisao: null, aplicadaEm: null,
        impactos: [{ id: "i", turmaId: "t", turma: { codigo: "T-01" }, quantidadeAnterior: 2, quantidadeNova: 3, alcance: c.alcance, excecoesQ37: [], snapshot: {} }],
      } });
      return renderToStaticMarkup(await PropostaQuantidadePage({ params: Promise.resolve({ id: "m", propostaId: "p" }) }));
    },
    enums: [
      { campo: "situacao", valores: Object.values(SituacaoPropostaQuantidadeAulas), mapa: L.SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL, fixo: "APLICADA" },
      { campo: "alcance", valores: Object.values(AlcanceImpactoQuantidadeAulas), mapa: L.ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL, fixo: "AUMENTO_NAO_INICIADA" },
    ],
  },
  "/academico/segundas-chamadas/minhas": {
    renderizar: async (c) => {
      mocks.segundas.mockResolvedValue({ ok: true, dado: { proximoId: null, itens: [{
        reservaId: "r", codigoAvaliacao: "AV", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fusoOrigem: "UTC",
        status: c.status, aluno: "Ana", matriculaCodigo: "M", turma: "T", realizacao: null, podeRealizar: false,
      }] } });
      return renderToStaticMarkup(await MinhasSegundasChamadasPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [{ campo: "status", valores: Object.values(StatusReservaSegundaChamada), mapa: L.STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, fixo: "RESERVADA" }],
  },
};

/** Só o texto lido (sem tags nem atributos). */
const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&");
const ocorrencias = (t: string, trecho: string) => t.split(trecho).length - 1;
const codigoCru = (t: string, valor: string) => new RegExp(`(^|[^A-Za-z0-9_])${valor}([^A-Za-z0-9_]|$)`).test(t);

describe("(i) enum cru na tela — renderização com cada valor", () => {
  beforeEach(() => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
  });

  for (const [tela, { renderizar, enums }] of Object.entries(TELAS)) {
    for (const { campo, valores, mapa } of enums) {
      it(`${tela} · ${campo}: cada valor aparece pelo rótulo do mapa central, nunca pelo código`, async () => {
        const fixos = Object.fromEntries(enums.map((e) => [e.campo, e.fixo]));
        // Linha de base com valor desconhecido: o rótulo testado tem de aparecer A MAIS, por causa do valor.
        const base = texto(await renderizar({ ...fixos, [campo]: "VALOR_DESCONHECIDO" }));
        for (const valor of valores) {
          const t = texto(await renderizar({ ...fixos, [campo]: valor }));
          expect(codigoCru(t, valor), `${tela} · ${campo}=${valor} imprimiu o código`).toBe(false);
          expect(ocorrencias(t, mapa[valor]) - ocorrencias(base, mapa[valor]), `${tela} · ${campo}=${valor} → "${mapa[valor]}"`).toBeGreaterThanOrEqual(1);
        }
      });
    }
  }

  it("autoteste: o detector de código cru no texto não confunde rótulo com código", () => {
    expect(codigoCru(texto("<p>Situação: RESERVADA.</p>"), "RESERVADA")).toBe(true);
    expect(codigoCru(texto('<p data-v="RESERVADA">Situação: Reservada.</p>'), "RESERVADA")).toBe(false);
    expect(codigoCru(texto("<p>LIBERADA_CANCELAMENTO_ESCOLA</p>"), "LIBERADA")).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------
// (ii) mapa de rótulo de enum só em src/lib/labels.ts
// ---------------------------------------------------------------------------------------------------

export type MapaLocal = { nome: string; enums: string[]; linha: number };
const CODIGO = /^[A-Z][A-Z0-9_]*$/;
const CLASSE = /(^|\s)(bg|text|border|ring|from|to)-[a-z]/;

/** Nomes próprios e marcas que mantêm a maiúscula no meio do rótulo. */
const NOMES_PROPRIOS = new Set(["WhatsApp", "Meta", "Q10"]);
/** Palavras depois da primeira com maiúscula inicial (Title Case) ou caixa misturada, fora de siglas e nomes próprios. */
export const foraDeSentenceCase = (rotulo: string) => rotulo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean).filter((p, i) => !SIGLAS.has(p) && !NOMES_PROPRIOS.has(p)
  && ((i > 0 && /^[A-ZÀ-Þ]/.test(p)) || /[a-zà-ÿ][A-ZÀ-Þ]/.test(p) || /^[A-ZÀ-Þ]{2,}[a-zà-ÿ]/.test(p)));
/** Objeto não vazio só com valores de texto, e não de classes CSS — a forma de um mapa de rótulo. */
const ehMapaDeTexto = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).length > 0
  && Object.values(v).every((x) => typeof x === "string") && !Object.values(v).some((x) => CLASSE.test(x as string));

/**
 * Mapas de rótulo de enum numa fonte — o mapa ad-hoc — em qualquer forma que associe código a texto
 * (revisão R2 da #138, B6): objeto literal (chave simples, entre aspas ou computada, mesmo de uma chave só),
 * `new Map`/`Object.fromEntries` de pares, `switch` que devolve texto por `case`, cadeia de ternários (com
 * `!==` ou sob guarda) ou série de `&&` sobre o mesmo sujeito, e reabertura do mapa central — spread ou
 * `Object.assign` (também por alias) com texto próprio, ou "override" de um valor antes do `rotular`. As
 * chaves precisam ser códigos de enum (do schema ou dos mapas de labels.ts); o mapa pode misturar enums.
 */
export function mapasDeRotulo(fonte: string, enums: Map<string, string[]>, arquivo = "x.tsx"): MapaLocal[] {
  const sf = arvore(fonte, arquivo);
  const mapas: MapaLocal[] = [];
  const consts = constantesDeTexto(sf);
  // Nomes que vêm de src/lib/labels.ts (import nomeado ou namespace), e os aliases locais deles.
  const deLabels = new Set<string>(), aliasesCentrais = new Set<string>();
  for (const d of sf.statements) {
    if (!ts.isImportDeclaration(d) || !ts.isStringLiteral(d.moduleSpecifier) || !/(^|\/)labels$/.test(d.moduleSpecifier.text)) continue;
    const b = d.importClause?.namedBindings;
    if (b && ts.isNamedImports(b)) for (const e of b.elements) deLabels.add(e.name.text);
    if (b && ts.isNamespaceImport(b)) deLabels.add(b.name.text);
  }
  const ehMapaCentral = (e: ts.Expression): boolean => {
    const x = semEmbrulho(e);
    if (ts.isIdentifier(x)) return deLabels.has(x.text) || aliasesCentrais.has(x.text) || /_LABEL$/.test(x.text);
    return ts.isPropertyAccessExpression(x) && (/_LABEL$/.test(x.name.text) || (ts.isIdentifier(x.expression) && deLabels.has(x.expression.text)));
  };
  for (let mudou = true; mudou;) {
    mudou = false;
    visitar(sf, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ehMapaCentral(n.initializer) && !aliasesCentrais.has(n.name.text)) { aliasesCentrais.add(n.name.text); mudou = true; }
    });
  }
  const nomeDoLiteral = (n: ts.Node) => {
    // Nome da constante só quando o literal É o valor dela (parênteses, as/satisfies, Object.freeze);
    // literal dentro de JSX ou de expressão maior é "inline".
    let no: ts.Node = n.parent;
    while (no && (ts.isParenthesizedExpression(no) || ts.isAsExpression(no) || ts.isSatisfiesExpression(no)
      || (ts.isCallExpression(no) && no.expression.getText(sf) === "Object.freeze"))) no = no.parent;
    return no && ts.isVariableDeclaration(no) && ts.isIdentifier(no.name) ? no.name.text : `(literal na linha ${linhaDe(sf, n)})`;
  };
  /** O texto do valor: literal (também sob `String()`), ou constante de texto do arquivo (um só valor possível). */
  const valorDeTexto = (e: ts.Expression) => { const v = textosDe(semConversao(e), consts); return v.length === 1 ? v[0] : null; };
  const ehRotulo = (valores: string[]) => valores.some((v) => /[A-Za-zÀ-ú]/.test(v)) && !valores.every((v) => CODIGO.test(v)) && !valores.some((v) => CLASSE.test(v));
  /** O código de uma chave: identificador, texto, `[ "ATIVA" ]`, `[StatusX.ATIVA]` ou constante do arquivo. */
  const codigoDeChave = (k: ts.PropertyName | ts.Expression): string | null => {
    if (ts.isComputedPropertyName(k)) return codigoDeChave(k.expression);
    if (ts.isIdentifier(k) && ts.isPropertyName(k) && !ts.isExpression(k.parent as ts.Node)) return k.text;
    const x = ts.isIdentifier(k) || ts.isStringLiteralLike(k) ? k : semEmbrulho(k as ts.Expression);
    if (ts.isStringLiteralLike(x)) return x.text;
    if (ts.isPropertyAccessExpression(x) && CODIGO.test(x.name.text)) return x.name.text;
    if (ts.isIdentifier(x)) { const v = consts.get(x.text) ?? []; return v.length === 1 ? v[0] : x.text; }
    return null;
  };
  const donosDe = (chaves: string[]) => {
    const unico = [...enums].filter(([, valores]) => chaves.every((c) => valores.includes(c))).map(([nome]) => nome);
    if (unico.length) return unico;
    // Mapa misto (tipo + desfecho…): cada chave é código de algum enum.
    if (chaves.length < 2 || !chaves.every((c) => [...enums].some(([, v]) => v.includes(c)))) return [];
    return [...new Set(chaves.map((c) => [...enums].find(([, v]) => v.includes(c))![0]))];
  };
  type Par = { chave: string | null; valor: string | null };
  const registrar = (n: ts.Node, nome: string, pares: Par[] | null, minimo = 1) => {
    if (!pares || pares.length < minimo || pares.some((p) => p.chave === null || p.valor === null)) return;
    const validos = pares as { chave: string; valor: string }[];
    if (!validos.every((p) => CODIGO.test(p.chave)) || !ehRotulo(validos.map((p) => p.valor))) return;
    const donos = donosDe(validos.map((p) => p.chave));
    if (donos.length) mapas.push({ nome, enums: donos, linha: linhaDe(sf, n) });
  };
  const paresDeEntradas = (e: ts.Expression | undefined): Par[] | null => {
    const x = e && semEmbrulho(e);
    if (!x || !ts.isArrayLiteralExpression(x)) return null;
    return x.elements.map((el) => {
      const par = semEmbrulho(el as ts.Expression);
      return ts.isArrayLiteralExpression(par) && par.elements.length === 2 ? { chave: codigoDeChave(par.elements[0]), valor: valorDeTexto(par.elements[1]) } : { chave: null, valor: null };
    });
  };
  /** `s === "ATIVA"`, `"ATIVA" == s`, `s !== "ATIVA"` (negada), sob guarda (`ok && s === "ATIVA"`). */
  type Comparacao = { sujeito: string; codigo: string; negada: boolean };
  const comparacao = (c0: ts.Expression): Comparacao | null => {
    const c = semEmbrulho(c0);
    if (!ts.isBinaryExpression(c)) return null;
    const op = c.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return comparacao(c.right) ?? comparacao(c.left);
    const iguais = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken], diferentes = [ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];
    if (!iguais.includes(op) && !diferentes.includes(op)) return null;
    const [lado, literal] = ts.isStringLiteralLike(semEmbrulho(c.right)) ? [c.left, semEmbrulho(c.right)] : [c.right, semEmbrulho(c.left)];
    if (!ts.isStringLiteralLike(literal) || !CODIGO.test(literal.text)) return null;
    return { sujeito: semConversao(lado).getText(sf), codigo: literal.text, negada: diferentes.includes(op) };
  };
  /** A folha rotula o próprio sujeito pelo mapa central? (`rotular(MAPA, s)` / `MAPA[s]`) */
  const rotulaSujeito = (e: ts.Expression, sujeito: string) => {
    const x = semEmbrulho(e);
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === "rotular") return x.arguments[1] !== undefined && semConversao(x.arguments[1]).getText(sf) === sujeito;
    return ts.isElementAccessExpression(x) && semConversao(x.argumentExpression).getText(sf) === sujeito;
  };
  visitar(sf, (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      // { ...STATUS_X_LABEL, CODIGO: "Outra redação" }: espalha o mapa central (ou alias dele) e sobrescreve rótulo.
      const espalhados = n.properties.filter((p): p is ts.SpreadAssignment => ts.isSpreadAssignment(p) && ehMapaCentral(p.expression));
      if (espalhados.length) {
        const proprios = n.properties.filter(ts.isPropertyAssignment);
        if (proprios.some((p) => valorDeTexto(p.initializer) !== null)) mapas.push({ nome: nomeDoLiteral(n), enums: espalhados.map((p) => `...${p.expression.getText(sf)}`), linha: linhaDe(sf, n) });
        return;
      }
      // O objeto de sobrescrita dentro de Object.assign(…, MAPA_CENTRAL, { … }) já conta no achado do assign.
      const pai = semPai(n);
      if (ts.isCallExpression(pai) && pai.expression.getText(sf) === "Object.assign" && pai.arguments.some(ehMapaCentral)) return;
      registrar(n, nomeDoLiteral(n), n.properties.map((p) => ts.isPropertyAssignment(p) ? { chave: codigoDeChave(p.name), valor: valorDeTexto(p.initializer) } : { chave: null, valor: null }));
      return;
    }
    // Object.assign({}, STATUS_X_LABEL, { ATIVA: "Em vigor" })
    if (ts.isCallExpression(n) && n.expression.getText(sf) === "Object.assign") {
      const central = n.arguments.find(ehMapaCentral);
      const comTexto = n.arguments.some((a) => ts.isObjectLiteralExpression(semEmbrulho(a)) && (semEmbrulho(a) as ts.ObjectLiteralExpression).properties.some((p) => ts.isPropertyAssignment(p) && valorDeTexto(p.initializer) !== null));
      if (central && comTexto) mapas.push({ nome: nomeDoLiteral(n), enums: [`Object.assign(${central.getText(sf)})`], linha: linhaDe(sf, n) });
      return;
    }
    // new Map([["ATIVA", "Ativa"], …]) / Object.fromEntries([["ATIVA", "Ativa"], …])
    if ((ts.isNewExpression(n) && n.expression.getText(sf) === "Map") || (ts.isCallExpression(n) && n.expression.getText(sf) === "Object.fromEntries")) {
      registrar(n, nomeDoLiteral(n), paresDeEntradas(n.arguments?.[0]));
      return;
    }
    // switch (s) { case "ATIVA": return "Ativa"; … }
    if (ts.isSwitchStatement(n)) {
      const pares: Par[] = n.caseBlock.clauses.filter(ts.isCaseClause).map((c) => {
        let valor: string | null = null;
        for (const st of c.statements) {
          if (ts.isReturnStatement(st) && st.expression) valor = valorDeTexto(st.expression);
          if (ts.isExpressionStatement(st) && ts.isBinaryExpression(st.expression) && st.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) valor = valorDeTexto(st.expression.right);
          if (valor !== null) break;
        }
        return { chave: codigoDeChave(c.expression), valor };
      });
      registrar(n, `switch ${semEmbrulho(n.expression).getText(sf)}`, pares, 2);
      return;
    }
    // Ternários: cadeia sobre o MESMO sujeito, com todas as folhas texto de rótulo (duas ou mais comparações),
    // ou "override" de um valor antes do mapa central (`s === "ATIVA" ? "Em vigor" : rotular(MAPA, s)`).
    // Cabeça da cadeia: sem ternário acima, ou com um ternário acima cuja condição não é comparação de código
    // (`i.status ? (i.status === "A" ? … : …) : "—"` — a guarda de existência não esconde o mapa; R3 da #138, B7).
    const acima = semPai(n);
    if (ts.isConditionalExpression(n) && (!ts.isConditionalExpression(acima) || !comparacao(acima.condition))) {
      const codigos: string[] = [], folhasTexto: (string | null)[] = [], folhasNos: ts.Expression[] = [], sujeitos = new Set<string>();
      let ok = true;
      const percorrer = (e: ts.Expression) => {
        const x = semEmbrulho(e);
        if (!ts.isConditionalExpression(x)) { folhasTexto.push(valorDeTexto(x)); folhasNos.push(x); return; }
        const c = comparacao(x.condition);
        if (!c) { ok = false; return; }
        codigos.push(c.codigo); sujeitos.add(c.sujeito);
        const [sim, nao] = c.negada ? [x.whenFalse, x.whenTrue] : [x.whenTrue, x.whenFalse];
        percorrer(sim); percorrer(nao);
      };
      percorrer(n);
      if (!ok || sujeitos.size !== 1) return;
      const sujeito = [...sujeitos][0];
      const override = folhasNos.some((f) => rotulaSujeito(f, sujeito)) && folhasTexto.some((v) => v !== null && /[A-Za-zÀ-ú]/.test(v));
      if (override) { mapas.push({ nome: `override ${sujeito}`, enums: donosDe(codigos).length ? donosDe(codigos) : ["(mapa central)"], linha: linhaDe(sf, n) }); return; }
      if (codigos.length < 2 || folhasTexto.some((v) => v === null) || !ehRotulo(folhasTexto as string[])) return;
      const donos = donosDe(codigos);
      if (donos.length) mapas.push({ nome: `ternário ${sujeito}`, enums: donos, linha: linhaDe(sf, n) });
      return;
    }
    // Série de && entre irmãos do JSX: {s === "ATIVA" && "Ativa"}{s === "PAUSADA" && "Pausada"}
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const porSujeito = new Map<string, Par[]>();
      for (const filho of n.children) {
        if (!ts.isJsxExpression(filho) || !filho.expression) continue;
        const x = semEmbrulho(filho.expression);
        if (!ts.isBinaryExpression(x) || x.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) continue;
        const c = comparacao(x.left);
        if (!c || c.negada) continue;
        porSujeito.set(c.sujeito, [...(porSujeito.get(c.sujeito) ?? []), { chave: c.codigo, valor: valorDeTexto(x.right) }]);
      }
      for (const [sujeito, pares] of porSujeito) registrar(n, `série && ${sujeito}`, pares, 2);
    }
  });
  return mapas;
}
/** Pai sem parênteses (para saber se o ternário é ramo de outro). */
const semPai = (n: ts.Node): ts.Node => { let p = n.parent; while (p && ts.isParenthesizedExpression(p)) p = p.parent; return p; };

/** Mapas que ficam na tela: frases do fluxo (próximo passo, confirmação, dica), não o nome do valor. */
const MAPAS_DE_TELA: { arquivo: string; nome: string; motivo: string }[] = [
  { arquivo: "src/app/(app)/academico/MudancasAcademicasPainel.tsx", nome: "nomesStatus", motivo: "fila pedagógica: o texto diz o próximo passo (\"Aprovada · aguardando execução\")" },
  { arquivo: "src/app/(app)/academico/equivalencias/page.tsx", nome: "nomesEstado", motivo: "frases do fluxo de equivalência (\"Autorizada para execução\", \"Transferência efetivada\")" },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/MovimentacoesPainel.tsx", nome: "status", motivo: "fila de pausa/retomada: o texto diz o próximo passo (\"Aprovada; aplicação pendente\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/page.tsx", nome: "acoesResolucao", motivo: "frase do histórico no particípio (\"Cancelamento da solicitação registrado\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/ResolucaoRevisaoProgressao.tsx", nome: "rotulosAcao", motivo: "opção de ação no infinitivo (\"Registrar o cancelamento da solicitação\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/ResolucaoRevisaoProgressao.tsx", nome: "efeitoAcao", motivo: "explicação do efeito de cada ação, não rótulo" },
  { arquivo: "src/app/(app)/configuracao/paises/PaisesPainel.tsx", nome: "CONFIRMACAO_STATUS", motivo: "mensagem de confirmação da transição (\"País ativado.\")" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx", nome: "ESTADO_HINT", motivo: "dica do efeito de cada estado da política" },
  { arquivo: "src/app/(app)/diario/reposicoes/ReposicoesEquipe.tsx", nome: "rotuloParticipacaoOrigem", motivo: "frase sobre a aula de origem (\"falta na aula de origem\")" },
  { arquivo: "src/app/(app)/inbox/InboxCliente.tsx", nome: "NOTA_POR_STATUS", motivo: "mensagem de resultado do envio (\"Mensagem enviada.\")" },
  { arquivo: "src/app/(app)/inbox/InboxCliente.tsx", nome: "ORIGEM_LABEL", motivo: "fragmento minúsculo ao lado da hora da mensagem; envio humano fica sem marca (\"\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/preparacao/page.tsx", nome: "tipos", motivo: "rotula também o regime da preparação, com a duração da hora (\"Hora particular (60 minutos)\")" },
  // Ternários (revisão R1 da #138, B2): os que eram só rótulo foram para labels.ts; ficam as frases do fluxo.
  { arquivo: "src/app/(app)/financeiro/RetomadasPainel.tsx", nome: "ternário p.status", motivo: "fila de retomada: \"Aguardando aprovação\" diz quem age (o Financeiro aprova)" },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", nome: "ternário v.status", motivo: "versão das condições de encerramento: \"Aguardando aprovação\" diz quem age" },
  { arquivo: "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx", nome: "ternário v.status", motivo: "versão das condições de horas aguarda REVISÃO da gestão (\"Aguardando revisão\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx", nome: "ternário versao.status", motivo: "versão das condições de continuidade aguarda REVISÃO da gestão (\"Aguardando revisão\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/compensacoes/[cobrancaId]/CompensacaoCobertura.tsx", nome: "ternário proposta.status", motivo: "frase do direito à compensação (\"Direito aprovado\", \"Proposta rejeitada\")" },
  { arquivo: "src/app/(app)/academico/equivalencias/[propostaId]/page.tsx", nome: "ternário proposta.estado", motivo: "frases do fluxo de equivalência (\"Autorizada para execução\"), as mesmas de nomesEstado na lista" },
  { arquivo: "src/app/(app)/academico/recuperacoes/AgendaPublicada.tsx", nome: "ternário agenda.status", motivo: "frase do encontro publicado (\"Realização registrada\", \"Encontro previsto\")" },
  { arquivo: "src/app/(app)/academico/correcoes/page.tsx", nome: "ternário i.tipo", motivo: "texto do link de ação por destino (\"Conferir histórico da aula\")" },
  { arquivo: "src/app/(app)/diario/encontros/[id]/correcao/CorrecaoAula.tsx", nome: "ternário reposicao.agendaParticular.statusBeneficio", motivo: "fragmento minúsculo no meio da frase do benefício (\"benefício reservado\", \"isenção excepcional registrada\")" },
  { arquivo: "src/app/(app)/diario/encontros/[id]/OcorrenciaParticular.tsx", nome: "nomes", motivo: "opção do informe docente, na voz do professor (\"Aluno faltou\", \"Cancelada pela escola\")" },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/SegundaChamadaPainel.tsx", nome: "override item.reserva.status", motivo: "frase explicativa das reservas consumidas/liberadas (\"consumida por falta; encontro não realizado\"); as demais vêm do mapa central" },
  { arquivo: "src/app/(app)/financeiro/AcessoAulasPainel.tsx", nome: "ternário m.status", motivo: "frase do acesso às aulas sob a guarda da liberação (\"Contrato pausado\", \"Contrato não ativo…\")" },
  { arquivo: "src/app/(app)/leads/[id]/FichaLead.tsx", nome: "ternário lead.temperatura", motivo: "faixa de prioridade derivada da temperatura (Alta/Média/Baixa, doc 09), não o nome da temperatura" },
];

describe("(ii) mapa de rótulo de enum só em src/lib/labels.ts", () => {
  // Enums do schema e os domínios dos mapas de labels.ts (ambiente da assinatura, desfecho de horas…).
  const enumsEMapas = new Map([...ENUMS, ...Object.entries(L).filter(([, v]) => ehMapaDeTexto(v)).map(([k, v]) => [`labels.${k}`, Object.keys(v as object)] as [string, string[]])]);
  const mapas = fontes.flatMap(({ arquivo, conteudo }) => mapasDeRotulo(conteudo, enumsEMapas, arquivo).map((m) => ({ arquivo, ...m })));

  it("nenhuma tela define mapa de rótulo de enum fora das exceções (use src/lib/labels.ts)", () => {
    const fora = mapas.filter((m) => !MAPAS_DE_TELA.some((e) => e.arquivo === m.arquivo && e.nome === m.nome));
    expect(fora.map((m) => `${m.arquivo}:${m.linha} ${m.nome} (${m.enums.join("|")})`)).toEqual([]);
  });

  it("cada exceção casa com exatamente um mapa (exceção sem caso sai da lista)", () => {
    for (const e of MAPAS_DE_TELA) expect(mapas.filter((m) => m.arquivo === e.arquivo && m.nome === e.nome), `${e.arquivo}#${e.nome}`).toHaveLength(1);
  });

  it("autoteste: o detector pega mapa tipado, sem tipo, inline e com aspas na chave; ignora de-para, classes e chave fora de enum", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]], ["Habilidade", ["FALA", "LEITURA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => `${m.nome}:${m.enums.join("|")}`);
    expect(nomes('const r: Record<StatusX, string> = { ATIVA: "Ativa", PAUSADA: "Pausada", ENCERRADA: "Encerrada" };')).toEqual(["r:StatusX"]);
    expect(nomes('const nomes = { FALA: "Fala", LEITURA: "Leitura" };')).toEqual(["nomes:Habilidade"]);
    expect(nomes('const x = <p>{({ ATIVA: "Ativa", PAUSADA: "Pausada" })[s]}</p>;')).toEqual(["(literal na linha 1):StatusX"]);
    expect(nomes('const r = { "ATIVA": "ativa", "PAUSADA": "pausada" } satisfies Record<string, string>;')).toEqual(["r:StatusX"]);
    expect(nomes('const de = { ATIVA: "ATIVACAO", PAUSADA: "PAUSA" };')).toEqual([]);
    expect(nomes('const cls = { ATIVA: "bg-green-100 text-green-700", PAUSADA: "bg-amber-100" };')).toEqual([]);
    expect(nomes('const m = { ATIVA: "Ativa", OUTRA: "Outra" };')).toEqual([]);
    expect(nomes('const m = { ATIVA: { label: "Ativa" }, PAUSADA: { label: "Pausada" } };')).toEqual([]);
  });

  it("autoteste (R1 da #138, B2): spread do mapa central, valor por constante e mapa em ternário", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => `${m.nome}:${m.enums.join("|")}`);
    expect(nomes('import { STATUS_X_LABEL } from "@/lib/labels"; const m = { ...STATUS_X_LABEL, ATIVA: "Em vigor" };')).toEqual(["m:...STATUS_X_LABEL"]);
    expect(nomes('import * as L from "@/lib/labels"; const m = { ...L.ROTULOS, PAUSADA: "Parada" };')).toEqual(["m:...L.ROTULOS"]);
    expect(nomes('const A = "Ativa", P = "Pausada"; const m = { ATIVA: A, PAUSADA: P };')).toEqual(["m:StatusX"]);
    expect(nomes('const r = <p>{s === "ATIVA" ? "Ativa" : s === "PAUSADA" ? "Pausada" : "Encerrada"}</p>;')).toEqual(["ternário s:StatusX"]);
    expect(nomes('const r = <p>{(d.status === "ATIVA") ? "Ativa" : (d.status === "PAUSADA" ? "Pausada" : "Encerrada")}</p>;')).toEqual(["ternário d.status:StatusX"]);
    // Não acusa: sim/não (uma comparação), sujeitos diferentes, classes, folha que não é texto, spread sem sobrescrever.
    expect(nomes([
      'const a = s === "ATIVA" ? "Ativa" : "Inativa";',
      'const b = s === "ATIVA" ? "Ativa" : t === "PAUSADA" ? "Pausada" : "Encerrada";',
      'const c = s === "ATIVA" ? "bg-green-50" : s === "PAUSADA" ? "bg-amber-50" : "bg-gray-50";',
      'const d = s === "ATIVA" ? rotulo : s === "PAUSADA" ? "Pausada" : "Encerrada";',
      'import { X_LABEL } from "@/lib/labels"; const e = { ...X_LABEL };',
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R2 da #138, B6): mapa misto, de uma chave, por API, por alias, switch, && e override", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]], ["TipoY", ["FALTA", "REALIZADA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => m.nome);
    expect(nomes('const misto = { ATIVA: "Ativa", FALTA: "Falta" };')).toEqual(["misto"]);
    expect(nomes('const um = { ATIVA: "Em vigor" };')).toEqual(["um"]);
    expect(nomes('const c = { [StatusX.ATIVA]: "Ativa", ["PAUSADA"]: "Pausada" };')).toEqual(["c"]);
    expect(nomes('const s = { ATIVA: String("Ativa"), PAUSADA: "Pausada" };')).toEqual(["s"]);
    expect(nomes('import { STATUS_X_LABEL } from "@/lib/labels"; const base = STATUS_X_LABEL; const m = { ...base, ATIVA: "Em vigor" };')).toEqual(["m"]);
    expect(nomes('import { STATUS_X_LABEL } from "@/lib/labels"; const m = Object.assign({}, STATUS_X_LABEL, { ATIVA: "Em vigor" });')).toEqual(["m"]);
    expect(nomes('const mp = new Map([["ATIVA", "Ativa"], ["PAUSADA", "Pausada"]]); const fe = Object.fromEntries([["ATIVA", "Ativa"]]);')).toEqual(["mp", "fe"]);
    expect(nomes('function r(s: string) { switch (s) { case "ATIVA": return "Ativa"; case "PAUSADA": return "Pausada"; default: return "—"; } }')).toEqual(["switch s"]);
    expect(nomes('const t = s !== "ATIVA" ? (s === "PAUSADA" ? "Pausada" : "Encerrada") : "Ativa";')).toEqual(["ternário s"]);
    expect(nomes('const g = ok && s === "ATIVA" ? "Ativa" : ok && s === "PAUSADA" ? "Pausada" : "—";')).toEqual(["ternário s"]);
    expect(nomes('const j = <p>{s === "ATIVA" && "Ativa"}{s === "PAUSADA" && "Pausada"}</p>;')).toEqual(["série && s"]);
    expect(nomes('const o = s === "ATIVA" ? "Em vigor" : rotular(STATUS_X_LABEL, s);')).toEqual(["override s"]);
    // R3 da #138 (B7): a guarda de existência por cima não esconde o mapa.
    expect(nomes('const v = s ? (s === "ATIVA" ? "Ativa" : s === "PAUSADA" ? "Pausada" : "Encerrada") : "—";')).toEqual(["ternário s"]);
    // Não acusa: um && só, condição booleana, chave fora de enum, valor não texto.
    expect(nomes([
      'const a = <p>{s === "ATIVA" && "Ativa"}</p>;',
      'const b = ok ? "Sim" : "Não";',
      'const c = { OUTRA: "Outra" };',
      'const d = { ATIVA: 1, PAUSADA: 2 };',
    ].join("\n"))).toEqual([]);
  });

  it("os mapas que as telas tinham soltos continuam fora delas (movidos para labels.ts)", () => {
    const fonte = (arquivo: string) => fontes.find((f) => f.arquivo === arquivo)?.conteudo ?? "";
    const MOVIDOS: [arquivo: string, trecho: string][] = [
      ["src/app/(app)/financeiro/FinanceiroPainel.tsx", "TIPO_APROVACAO_LABEL[a.tipo]"],
      ["src/app/(app)/configuracao/catalogo/PrecosPainel.tsx", "TIPO_COBRANCA_LABEL[p.tipoCobranca]"],
      ["src/app/(app)/configuracao/catalogo/ModalidadesPainel.tsx", "SEGMENTO_LABEL[m.segmento]"],
      ["src/components/CopilotoSugestoes.tsx", "rotular(ETAPA_LABEL, String(p.etapa))"],
      ["src/app/(app)/secretaria/avisos-agenda/page.tsx", "rotular(CANAL_AVISO_ALTERACAO_AGENDA_LABEL, i.canal)"],
      ["src/app/(app)/academico/segundas-chamadas/agendas/page.tsx", "const rotulosReserva = STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL;"],
      ["src/app/(app)/academico/avaliacoes/[alocacaoId]/page.tsx", "HABILIDADE_LABEL[h.habilidade]"],
    ];
    expect(MOVIDOS.filter(([arquivo, trecho]) => !fonte(arquivo).includes(trecho))).toEqual([]);
    // "Comunicação oral" era a redação divergente de FALA em três telas; o mapa central usa "Fala".
    expect(fontes.filter((f) => f.conteudo.includes("Comunicação oral")).map((f) => f.arquivo)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// (iii) os mapas novos de labels.ts cobrem o enum inteiro, em texto de gente
// ---------------------------------------------------------------------------------------------------

/** Siglas que ficam em maiúscula dentro de um rótulo. */
const SIGLAS = new Set(["PIX", "B2B", "CPF", "CNPJ", "PDF", "IA", "UTC", "ID", "API", "ERP"]);
export const palavrasEmCaixaAlta = (rotulo: string) => rotulo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter((p) => /^[A-ZÀ-Þ]{2,}$/.test(p) && !SIGLAS.has(p));
const MAPAS_NOVOS: [nome: string, mapa: Readonly<Record<string, string>>, valores: readonly string[]][] = [
  ["HABILIDADE_LABEL", L.HABILIDADE_LABEL, HABILIDADES],
  ["STATUS_TURMA_LABEL", L.STATUS_TURMA_LABEL, Object.values(StatusTurma)],
  ["STATUS_MUDANCA_ACADEMICA_LABEL", L.STATUS_MUDANCA_ACADEMICA_LABEL, Object.values(StatusMudancaAcademica)],
  ["STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL", L.STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, Object.values(StatusReservaSegundaChamada)],
  ["SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL", L.SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL, ["OFICIALIZADA", "REJEITADA", "SUBMETIDA", "RASCUNHO"]],
  ["SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL", L.SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL, Object.values(SituacaoPropostaQuantidadeAulas)],
  ["ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL", L.ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL, Object.values(AlcanceImpactoQuantidadeAulas)],
  ["PARTICIPACAO_AULA_LABEL", L.PARTICIPACAO_AULA_LABEL, Object.values(ParticipacaoAula)],
  ["FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL", L.FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, Object.values(FinalidadeTokenPortalAluno)],
  ["SITUACAO_ENVIO_PORTAL_ALUNO_LABEL", L.SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, Object.values(SituacaoEnvioPortalAluno)],
  ["SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL", L.SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL, Object.values(SituacaoTrocaEmailPortalAluno)],
  ["CANAL_AVISO_ALTERACAO_AGENDA_LABEL", L.CANAL_AVISO_ALTERACAO_AGENDA_LABEL, Object.values(CanalAvisoAlteracaoAgenda)],
  ["SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL", L.SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, Object.values(SituacaoAvisoAlteracaoAgenda)],
  ["MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL", L.MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, Object.values(MotivoPendenciaAvisoAgenda)],
  ["STATUS_RESERVA_VAGA_LABEL", L.STATUS_RESERVA_VAGA_LABEL, Object.values(StatusReservaVaga)],
  ["STATUS_CORRECAO_CADASTRO_LABEL", L.STATUS_CORRECAO_CADASTRO_LABEL, Object.values(StatusCorrecaoCadastro)],
  ["TIPO_PAGADOR_LABEL", L.TIPO_PAGADOR_LABEL, PagadorEntradaFinanceiraHistoricaSchema.shape.tipo.options],
  ["STATUS_SOLICITACAO_ENCERRAMENTO_LABEL", L.STATUS_SOLICITACAO_ENCERRAMENTO_LABEL, Object.values(StatusSolicitacaoEncerramento)],
  ["ESTADO_DIA_COMPENSACAO_LABEL", L.ESTADO_DIA_COMPENSACAO_LABEL, Object.values(EstadoDiaCompensacao)],
  ["ESTADO_ENVIO_ASSINATURA_LABEL", L.ESTADO_ENVIO_ASSINATURA_LABEL, Object.values(EstadoEnvioAssinatura)],
  ["TIPO_MOVIMENTACAO_LABEL", L.TIPO_MOVIMENTACAO_LABEL, Object.values(TipoMovimentacao)],
  ["RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL", L.RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL, Object.values(ResultadoEnsaioVinculoMigracao)],
  ["ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL", L.ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL, Object.values(EstadoLinhaPreparacaoMigracao)],
  ["SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL", L.SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL, Object.values(SituacaoAplicacaoCadastroMigracao)],
  ["CATEGORIA_DOCUMENTO_LABEL", L.CATEGORIA_DOCUMENTO_LABEL, Object.values(CategoriaDocumento)],
  ["STATUS_FATURA_B2B_LABEL", L.STATUS_FATURA_B2B_LABEL, Object.values(StatusFaturaB2B)],
  ["TIPO_SUGESTAO_IA_LABEL", L.TIPO_SUGESTAO_IA_LABEL, Object.values(TipoSugestaoIA)],
  ["STATUS_TEMPLATE_LABEL", L.STATUS_TEMPLATE_LABEL, Object.values(StatusTemplate)],
  ["TIPO_MENSAGEM_LABEL", L.TIPO_MENSAGEM_LABEL, Object.values(TipoMensagem)],
  ["STATUS_INTENCAO_LABEL", L.STATUS_INTENCAO_LABEL, Object.values(StatusIntencao)],
  ["TIPO_APROVACAO_LABEL", L.TIPO_APROVACAO_LABEL, Object.values(TipoAprovacao)],
  ["VIGENCIA_LABEL", L.VIGENCIA_LABEL, Object.values(Vigencia)],
  ["TIPO_AJUSTE_LABEL", L.TIPO_AJUSTE_LABEL, Object.values(TipoAjuste)],
  ["TIPO_DESTINACAO_RECEBIMENTO_LABEL", L.TIPO_DESTINACAO_RECEBIMENTO_LABEL, Object.values(TipoDestinacaoRecebimento)],
  ["ESTADO_PROPOSTA_DECIDIDA_LABEL", L.ESTADO_PROPOSTA_DECIDIDA_LABEL, ["PENDENTE", "APROVADA", "REJEITADA", "APLICADA"]],
  ["STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL", L.STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL, Object.values(StatusPropostaAcertoTaxaAditivo)],
  ["STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL, Object.values(StatusPropostaConciliacaoFinanceiraMigracao)],
  ["STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL, Object.values(StatusPropostaEntradaFinanceiraHistoricaMigracao)],
  ["STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL, Object.values(StatusPropostaPresencaHistoricaMigracao)],
  ["STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL", L.STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL, Object.values(StatusConjuntoImpactosTaxaAditivo)],
  ["STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL", L.STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL, Object.values(StatusConjuntoImpactosCoberturaAditivo)],
  ["DECISAO_IMPACTO_TAXA_ADITIVO_LABEL", L.DECISAO_IMPACTO_TAXA_ADITIVO_LABEL, Object.values(DecisaoImpactoTaxaAditivo)],
  ["CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL", L.CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL, Object.values(ClassificacaoImpactoCoberturaAditivo)],
  ["MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL", L.MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL, Object.values(ModalidadeConciliacaoFinanceiraMigracao)],
  ["ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL", L.ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL, Object.values(EstadoReservaDevolucaoCredito)],
  ["ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL", L.ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL, Object.values(EstadoReconferenciaDeltaDesistencia)],
  ["UNIDADE_PERMUTA_SERVICO_LABEL", L.UNIDADE_PERMUTA_SERVICO_LABEL, Object.values(UnidadePermutaServico)],
  // Revisão R1 da #138 (B2/B4): mapas que viviam em ternário ou faltavam.
  ["STATUS_PAGAMENTO_INFORMADO_LABEL", L.STATUS_PAGAMENTO_INFORMADO_LABEL, Object.values(StatusPagamentoInformado)],
  ["AMBIENTE_ASSINATURA_LABEL", L.AMBIENTE_ASSINATURA_LABEL, ["SANDBOX", "PRODUCAO"]],
  ["TIPO_OCORRENCIA_HORAS_LABEL", L.TIPO_OCORRENCIA_HORAS_LABEL, OcorrenciaHorasSchema.innerType().shape.ocorrencia.options.map((o) => o.shape.tipo.value)],
  ["DESFECHO_OCORRENCIA_HORAS_LABEL", L.DESFECHO_OCORRENCIA_HORAS_LABEL, SaldoCompraHorasSchema.innerType().shape.reservas.element.shape.desfecho.options.filter((d) => d !== "PENDENTE")],
  ["TIPO_COBRANCA_ENTRADA_LABEL", L.TIPO_COBRANCA_ENTRADA_LABEL, ["MATRICULA", "MENSALIDADE", "HORA_PARTICULAR"]],
  ["REFERENCIA_COBERTURA_MENSAL_LABEL", L.REFERENCIA_COBERTURA_MENSAL_LABEL, Object.values(ReferenciaCoberturaMensal)],
  ["FINALIDADE_NUMERO_LABEL", L.FINALIDADE_NUMERO_LABEL, Object.values(FinalidadeNumero)],
  ["FORMA_AGENDA_OFERTA_LABEL", L.FORMA_AGENDA_OFERTA_LABEL, Object.values(FormaAgendaOferta)],
];

describe("(iii) mapas novos de labels.ts", () => {
  for (const [nome, mapa, valores] of MAPAS_NOVOS) {
    it(`${nome}: chaves = valores do enum; rótulo em texto de gente; congelado`, () => {
      expect(Object.keys(mapa).sort(), nome).toEqual([...valores].sort());
      for (const [valor, rotulo] of Object.entries(mapa)) {
        expect(rotulo.trim(), `${nome}.${valor}`).not.toBe("");
        expect(rotulo, `${nome}.${valor} repete o código`).not.toBe(valor);
        // Caixa alta disfarçada (revisão R1 da #138, B3): "EM ANDAMENTO.", "CONCLUÍDA" — exige minúscula e
        // nenhuma palavra toda em maiúscula fora das siglas; rótulo é nome, sem pontuação final.
        expect(rotulo, `${nome}.${valor} sem minúscula`).toMatch(/[a-zà-ÿ]/);
        expect(palavrasEmCaixaAlta(rotulo), `${nome}.${valor} com palavra em CAIXA ALTA`).toEqual([]);
        expect(rotulo, `${nome}.${valor} com pontuação final`).not.toMatch(/[.;:!?,…·–—-]$/u);
        // Revisão R2 da #138 (B7): sem espaço nas pontas ("Concluída. "), sentence case ("Em Andamento") e sem
        // palavra de caixa misturada ("ANDAMENTo").
        expect(rotulo, `${nome}.${valor} com espaço nas pontas`).toBe(rotulo.trim());
        expect(foraDeSentenceCase(rotulo), `${nome}.${valor} fora de sentence case`).toEqual([]);
        expect(rotulo, `${nome}.${valor} com "_"`).not.toContain("_");
        expect(rotulo, `${nome}.${valor} sem maiúscula inicial (sentence case)`).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/);
      }
      expect(Object.isFrozen(mapa), `${nome} congelado`).toBe(true);
    });
  }

  it("todo mapa de texto novo de labels.ts está nesta lista, com ou sem _LABEL (mapa novo sem trava não passa)", () => {
    const ANTIGOS = new Set(["ETAPA_LABEL", "TEMPERATURA_LABEL", "SEGMENTO_LABEL", "MOTIVO_PERDA_LABEL", "STATUS_MATRICULA_LABEL", "STATUS_COBRANCA_LABEL",
      "STATUS_COMISSAO_LABEL", "STATUS_ALUNO_LABEL", "TIPO_COBRANCA_LABEL", "FORMA_PAGAMENTO_LABEL", "GENERO_LABEL", "ESCOLARIDADE_LABEL",
      "SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL", "STATUS_ENCONTRO_LABEL"]);
    // Todo mapa de texto exportado, com ou sem o sufixo _LABEL (revisão R1 da #138: `ROTULOS_TURMA` passava).
    const exportados = Object.entries(L).filter(([k, v]) => ehMapaDeTexto(v) && !ANTIGOS.has(k)).map(([k]) => k);
    expect(exportados.filter((k) => !MAPAS_NOVOS.some(([nome]) => nome === k))).toEqual([]);
  });

  it("mapa de texto interno de labels.ts só serve de base, por spread, a mapa exportado (revisão R2 da #138, B7)", () => {
    // Um mapa não exportado servido por função exportada escaparia da lista acima.
    const sfL = arvore(readFileSync("src/lib/labels.ts", "utf-8"), "src/lib/labels.ts");
    const exportado = (st: ts.Node) => ts.canHaveModifiers(st) && !!ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const objetoDeTexto = (e: ts.Expression): boolean => {
      const x = semEmbrulho(e);
      if (ts.isCallExpression(x) && x.expression.getText(sfL) === "Object.freeze" && x.arguments[0]) return objetoDeTexto(x.arguments[0]);
      return ts.isObjectLiteralExpression(x) && x.properties.length > 0 && x.properties.every((p) => ts.isPropertyAssignment(p) && ts.isStringLiteralLike(semEmbrulho(p.initializer)));
    };
    const internos = new Set<string>();
    for (const st of sfL.statements) {
      if (!ts.isVariableStatement(st) || exportado(st)) continue;
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer && objetoDeTexto(d.initializer)) internos.add(d.name.text);
    }
    const usosIndevidos: string[] = [];
    visitar(sfL, (n) => {
      if (!ts.isIdentifier(n) || !internos.has(n.text) || (ts.isVariableDeclaration(n.parent) && n.parent.name === n) || ts.isTypeQueryNode(n.parent)) return;
      let st: ts.Node = n;
      while (st.parent && !ts.isSourceFile(st.parent)) st = st.parent;
      if (!(ts.isSpreadAssignment(n.parent) && ts.isVariableStatement(st) && exportado(st))) usosIndevidos.push(`${n.text}:${linhaDe(sfL, n)}`);
    });
    expect([...internos].sort()).toEqual(["CONJUNTO_IMPACTOS", "PROPOSTA_DECIDIDA"]);
    expect(usosIndevidos).toEqual([]);
  });

  it("autoteste (R2 da #138, B7): espaço, reticências, Title Case e caixa misturada", () => {
    expect(foraDeSentenceCase("Em Andamento")).toEqual(["Andamento"]);
    expect(foraDeSentenceCase("Em ANDAMENTo")).toEqual(["ANDAMENTo"]);
    expect(foraDeSentenceCase("Envio pelo WhatsApp via API")).toEqual([]);
    expect("Concluída…").toMatch(/[.;:!?,…·–—-]$/u);
  });

  it("autoteste (R1 da #138, B3): caixa alta disfarçada com pontuação ou acento; siglas passam", () => {
    expect(palavrasEmCaixaAlta("EM ANDAMENTO.")).toEqual(["EM", "ANDAMENTO"]);
    expect(palavrasEmCaixaAlta("CONCLUÍDA")).toEqual(["CONCLUÍDA"]);
    expect(palavrasEmCaixaAlta("Concluída via API, com PIX")).toEqual([]);
  });

  it("rotular devolve o rótulo e, para valor sem rótulo, o próprio valor (nunca frase inventada)", () => {
    expect(L.rotular(L.HABILIDADE_LABEL, "COMPREENSAO_ORAL")).toBe("Compreensão oral");
    // Valor vindo do banco fora do enum atual (registro antigo): tipado como string, não como literal.
    const valorAntigo: string = "VALOR_ANTIGO";
    expect(L.rotular(L.STATUS_RESERVA_VAGA_LABEL, valorAntigo)).toBe("VALOR_ANTIGO");
  });

  it("autoteste: o leitor de enums do schema separa nome e valores, ignorando comentários", () => {
    const enums = enumsDoSchema("enum StatusX {\n  ATIVA // comentário\n  PAUSADA\n}\n\nmodel M {\n  id String\n}\nenum Outro {\n  A_B\n}\n");
    expect([...enums]).toEqual([["StatusX", ["ATIVA", "PAUSADA"]], ["Outro", ["A_B"]]]);
    expect(ENUMS.get("StatusEncontroAgenda")).toEqual(Object.values(StatusEncontroAgenda));
  });
});
