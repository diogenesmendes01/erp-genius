import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MAPA_VAZIO_PAGINADO } from "./vazio-paginado-mapa";

// Trava do estado vazio paginado (docs/42-auditoria-frontend-ux.md — /secretaria/desistencias #4 e
// /secretaria/envios-portal #5): listas paginadas diziam "Nenhum X nesta página." também na
// PRIMEIRA página, quando não existe registro nenhum — o operador não sabia se a fila estava zerada
// ou se estava numa página vazia.
//
// Regra: todo texto "nesta página" de um estado vazio só aparece num ramo que a paginação garante
// estar FORA da primeira página. A condição tem de citar o identificador de página da tela e ter a
// polaridade certa:
// - cursor de página presente (`cursor`, `q.cursor`, `pendenciaCursor`, `antes`, `antesVersao`,
//   `depoisId`…): `cursor ? <nesta página> : <fila zerada>`, `!cursor ? … : <nesta página>`,
//   `cursor && …`, `cursor !== undefined`. `proximoCursor` NÃO serve: diz que há página seguinte,
//   não que esta não é a primeira.
// - número de página (`pagina`, `r.pagina`, `d.paginaModelos`, `formulario.paginaDocumentos`…)
//   comparado com a primeira: `> 1`, `>= 2`, `!== 1`, `1 < pagina` (e o ramo falso de `=== 1`,
//   `<= 1`, `< 2`). `paginas` (contagem de folhas de um PDF) não é página da lista.
// - composições: `a && b` vale se um dos lados garante; `a || b`, só se os dois garantem.
// O guarda pode estar em qualquer ancestral (ternário, &&, ||, if/else com return).
//
// Apelido local vale pelo que é: `const antesPagina = true` não é guarda; `const depois = r.pagina === 1`
// é avaliado (e aqui diz "primeira").
//
// Alcance: TODO texto do código de produção (src, .ts e .tsx) — JSX, string, template e
// concatenação avaliados (`"nesta " + "página"`, `${"nesta"}`, constante local) —, não só o que está
// em <EstadoVazio>: um <p> à mão ou uma constante noutro arquivo também contam.
// Fora do alcance (declarado): early return sem else (`if (!cursor) return <A/>; return <B/>` — o
// segundo return não é ramo sintático do if; escreva como ternário).
//
// Manifesto (src/app/vazio-paginado-mapa.ts): cada "nesta página" protegido, com a CONDIÇÃO que o
// protege. Trocar o cursor de uma lista pelo da outra (`cursor` × `pendenciaCursor`) passa no nome,
// mas muda o mapa e falha.
//
// Exceções: arquivo + trecho exato (texto normalizado do nó) + motivo; cada uma tem de casar com
// exatamente um caso.

const TEXTO_DE_PAGINA = /nesta\s+página/i;
/** Cursor de página: presente ⇒ fora da primeira página. */
const CURSOR = /^(cursor|antes|depois|before|after)([A-Z]\w*)?$|^(?!proxim|next)\w+Cursor$/;
/** Número de página: 1 é a primeira. */
const NUMERO_DE_PAGINA = /^(pagina|page)([A-Z]\w*)?$/;

type Excecao = { arquivo: string; trecho: string; motivo: string };

export const EXCECOES_VAZIO_PAGINADO: readonly Excecao[] = [
  {
    arquivo: "src/app/(app)/alunos/AlunosLista.tsx",
    trecho: "Nenhum aluno nesta página.",
    motivo: "o ramo só ocorre fora da primeira página: base não vazia (totalBase > 0), sem filtro e página sem itens; a volta ('Ir para a primeira página') está no próprio texto",
  },
  {
    arquivo: "src/app/(app)/empresas/EmpresasCliente.tsx",
    trecho: "Nenhuma empresa nesta página.",
    motivo: "o ramo só ocorre fora da primeira página: base não vazia (totalBase > 0), sem filtro e página sem itens; a volta ('Ir para a primeira página') está no próprio texto",
  },
  {
    arquivo: "src/app/(app)/leads/LeadsLista.tsx",
    trecho: "Nenhum lead nesta página.",
    motivo: "o ramo só ocorre fora da primeira página: carteira não vazia (totalBase > 0), sem filtro e página sem itens; a volta ('Ir para a primeira página') está no próprio texto",
  },
  // Não são estado vazio: título, opção de seleção e instrução sobre a própria tela.
  {
    arquivo: "src/app/(app)/leads/[id]/contratacao/page.tsx",
    trecho: "Turmas compatíveis nesta página",
    motivo: "título da lista de turmas da página atual da consulta (paginada por 'turmas'); descreve o recorte mostrado, não afirma ausência",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/reserva/ReservarFormulario.tsx",
    trecho: "Selecione uma turma disponível nesta página",
    motivo: "opção vazia do select: as turmas oferecidas são as da página atual; é instrução, não estado vazio",
  },
  {
    arquivo: "src/app/(app)/academico/segundas-chamadas/minhas/[reservaId]/page.tsx",
    trecho: ". Corrija e reenvie nesta página; não use o fluxo de correção de nota oficial.",
    motivo: "'nesta página' é esta tela (a de lançamento da nota), não página de lista paginada",
  },
];

const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
}

/** Nome final de `x`, `a.b.x`, `a?.x`. */
function nomeDe(e: ts.Expression): string | null {
  e = desembrulha(e);
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

const ehNuloOuIndefinido = (e: ts.Expression) => {
  e = desembrulha(e);
  return e.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(e) && e.text === "undefined");
};

/** "fora": a comparação vale exatamente fora da primeira página; "primeira": exatamente na primeira. */
function comparacaoDePagina(e: ts.BinaryExpression): "fora" | "primeira" | null {
  const K = ts.SyntaxKind;
  let op: ts.SyntaxKind = e.operatorToken.kind, esquerda = desembrulha(e.left), direita = desembrulha(e.right);
  // `1 < pagina` → `pagina > 1`.
  if (ts.isNumericLiteral(esquerda) && !ts.isNumericLiteral(direita)) {
    const espelho: Partial<Record<ts.SyntaxKind, ts.SyntaxKind>> = { [K.LessThanToken]: K.GreaterThanToken, [K.LessThanEqualsToken]: K.GreaterThanEqualsToken, [K.GreaterThanToken]: K.LessThanToken, [K.GreaterThanEqualsToken]: K.LessThanEqualsToken };
    op = espelho[op] ?? op;
    [esquerda, direita] = [direita, esquerda];
  }
  const nome = nomeDe(esquerda);
  if (nome === null) return null;
  if (NUMERO_DE_PAGINA.test(nome) && ts.isNumericLiteral(direita)) {
    const n = Number(direita.text);
    if ((op === K.GreaterThanToken && n === 1) || (op === K.GreaterThanEqualsToken && n === 2) || ((op === K.ExclamationEqualsEqualsToken || op === K.ExclamationEqualsToken) && n === 1)) return "fora";
    if (((op === K.EqualsEqualsEqualsToken || op === K.EqualsEqualsToken || op === K.LessThanEqualsToken) && n === 1) || (op === K.LessThanToken && n === 2)) return "primeira";
    return null;
  }
  if (CURSOR.test(nome) && ehNuloOuIndefinido(direita)) {
    const nulo = desembrulha(direita).kind === ts.SyntaxKind.NullKeyword;
    // `cursor != null` / `cursor !== undefined`: presente. (`!== null` deixaria passar undefined.)
    if (op === K.ExclamationEqualsToken || (op === K.ExclamationEqualsEqualsToken && !nulo)) return "fora";
    if (op === K.EqualsEqualsToken || (op === K.EqualsEqualsEqualsToken && !nulo)) return "primeira";
  }
  return null;
}

/**
 * Declarações locais do arquivo em análise (nome → inicializadores). Um apelido não vale como guarda
 * só pelo nome: `const antesPagina = true` é constante, e `const depoisDaPrimeira = r.pagina === 1`
 * tem de ser avaliado pelo que é (revisão R1 da #134, B3).
 */
let declaracoes = new Map<string, ts.Expression[]>();
function coletarDeclaracoes(sf: ts.SourceFile): Map<string, ts.Expression[]> {
  const mapa = new Map<string, ts.Expression[]>();
  const visita = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) mapa.set(n.name.text, [...(mapa.get(n.name.text) ?? []), desembrulha(n.initializer)]);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return mapa;
}
const ehLiteral = (e: ts.Expression) =>
  [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(e.kind) || ts.isNumericLiteral(e) || ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
const OPERADORES_BOOLEANOS = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken]);
const ehBooleano = (e: ts.Expression) =>
  (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) || (ts.isBinaryExpression(e) && OPERADORES_BOOLEANOS.has(e.operatorToken.kind));

/** A expressão avaliar como `valor` garante estar fora da primeira página? */
export function foraDaPrimeira(e: ts.Expression, valor: boolean, profundidade = 0): boolean {
  e = desembrulha(e);
  const K = ts.SyntaxKind;
  if (profundidade > 5) return false;
  if (ts.isPrefixUnaryExpression(e) && e.operator === K.ExclamationToken) return foraDaPrimeira(e.operand, !valor, profundidade);
  const nome = nomeDe(e);
  if (nome !== null) {
    // Apelido local: constante literal nunca é guarda; expressão booleana vale pelo que avalia.
    const inits = ts.isIdentifier(e) ? declaracoes.get(e.text) ?? [] : [];
    if (inits.some(ehLiteral)) return false;
    const booleanos = inits.filter(ehBooleano);
    if (booleanos.length) return booleanos.every((i) => foraDaPrimeira(i, valor, profundidade + 1));
    return valor && CURSOR.test(nome);
  }
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (op === K.AmpersandAmpersandToken) {
      return valor ? foraDaPrimeira(e.left, true) || foraDaPrimeira(e.right, true) : foraDaPrimeira(e.left, false) && foraDaPrimeira(e.right, false);
    }
    if (op === K.BarBarToken) {
      return valor ? foraDaPrimeira(e.left, true) && foraDaPrimeira(e.right, true) : foraDaPrimeira(e.left, false) || foraDaPrimeira(e.right, false);
    }
    const c = comparacaoDePagina(e);
    if (c === "fora") return valor;
    if (c === "primeira") return !valor;
  }
  return false;
}

/** Condição do ancestral que escolhe este ramo só fora da primeira página (texto normalizado), ou null. */
function guardaDaPaginacao(no: ts.Node, sf: ts.SourceFile): string | null {
  const K = ts.SyntaxKind;
  const texto = (c: ts.Node) => normaliza(c.getText(sf));
  let filho: ts.Node = no;
  for (let p = no.parent; p; filho = p, p = p.parent) {
    if (ts.isConditionalExpression(p)) {
      if (p.whenTrue === filho && foraDaPrimeira(p.condition, true)) return texto(p.condition);
      if (p.whenFalse === filho && foraDaPrimeira(p.condition, false)) return `!(${texto(p.condition)})`;
    } else if (ts.isBinaryExpression(p) && p.right === filho) {
      if (p.operatorToken.kind === K.AmpersandAmpersandToken && foraDaPrimeira(p.left, true)) return texto(p.left);
      if (p.operatorToken.kind === K.BarBarToken && foraDaPrimeira(p.left, false)) return `!(${texto(p.left)})`;
    } else if (ts.isIfStatement(p)) {
      if (p.thenStatement === filho && foraDaPrimeira(p.expression, true)) return texto(p.expression);
      if (p.elseStatement === filho && foraDaPrimeira(p.expression, false)) return `!(${texto(p.expression)})`;
    }
  }
  return null;
}

const DESCONHECIDO = "\u0000";
/**
 * Texto que a expressão produz, juntando literal, template (`${"nesta"}`), concatenação (`"nesta " + "página"`)
 * e constante local de um só valor. O que não dá para saber sem executar (chamada, ternário) vira
 * DESCONHECIDO — e os ramos de um ternário são avaliados como textos próprios, com o seu guarda.
 */
function avaliarTexto(e: ts.Expression, profundidade = 0): string {
  e = desembrulha(e);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((s) => avaliarTexto(s.expression, profundidade + 1) + s.literal.text).join("");
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) return avaliarTexto(e.left, profundidade + 1) + avaliarTexto(e.right, profundidade + 1);
  // `["Nenhuma turma nesta", "página."].join(" ")` e `"a".concat(b)` (R2 da #134, B1).
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
    const alvo = e.expression.expression, metodo = e.expression.name.text;
    if (metodo === "join" && ts.isArrayLiteralExpression(alvo)) {
      const sep = e.arguments[0] ? avaliarTexto(e.arguments[0], profundidade + 1) : ",";
      return alvo.elements.map((x) => avaliarTexto(x as ts.Expression, profundidade + 1)).join(sep);
    }
    if (metodo === "concat") return avaliarTexto(alvo, profundidade + 1) + e.arguments.map((a) => avaliarTexto(a, profundidade + 1)).join("");
  }
  if (ts.isIdentifier(e) && profundidade < 5) {
    const inits = declaracoes.get(e.text) ?? [];
    if (inits.length === 1) return avaliarTexto(inits[0], profundidade + 1);
  }
  return DESCONHECIDO;
}

/** Expressão de texto "inteira": não é pedaço de uma concatenação ou de um template maior. */
function textoInteiro(n: ts.Node): boolean {
  let p = n.parent;
  while (p && ts.isParenthesizedExpression(p)) p = p.parent;
  if (!p) return true;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken) return false;
  if (ts.isTemplateSpan(p)) return false;
  // Pedaço de `[…].join(…)` ou de `a.concat(b)`: o texto inteiro é o da chamada.
  if (ts.isArrayLiteralExpression(p) && ts.isPropertyAccessExpression(p.parent) && ["join", "concat"].includes(p.parent.name.text)) return false;
  if (ts.isPropertyAccessExpression(p) && ["join", "concat"].includes(p.name.text)) return false;
  if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ["join", "concat"].includes(p.expression.name.text)) return false;
  return true;
}

/** Chamada que monta texto: `[…].join(…)` de lista literal ou `x.concat(…)`. */
const montaTexto = (n: ts.Node) =>
  ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
  && ((n.expression.name.text === "join" && ts.isArrayLiteralExpression(n.expression.expression)) || n.expression.name.text === "concat");

type Achado = { linha: number; trecho: string; guarda: string | null };

/**
 * Todo texto "nesta página" do arquivo — JSX, string, template, concatenação, constante —, com a condição
 * de paginação que o protege (null: a página 1 pode mostrá-lo). Não só o que está em <EstadoVazio>: um
 * <p> à mão ou uma constante noutro arquivo também contam (revisão R1 da #134, B3).
 */
export function textosDePagina(fonte: string, arquivo = "x.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
  declaracoes = coletarDeclaracoes(sf);
  const achados: Achado[] = [];
  const registra = (n: ts.Node, texto: string) => {
    if (!TEXTO_DE_PAGINA.test(texto)) return;
    achados.push({ linha: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, trecho: normaliza(texto.split(DESCONHECIDO).join("…")), guarda: guardaDaPaginacao(n, sf) });
  };
  const visita = (n: ts.Node) => {
    if (ts.isJsxText(n)) registra(n, n.text);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n) || (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) || montaTexto(n))
      && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent) && textoInteiro(n)) registra(n, avaliarTexto(n as ts.Expression));
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** Textos "nesta página" que a página 1 pode mostrar. */
export const vaziosPaginadosSemGuarda = (fonte: string, arquivo = "x.tsx") => textosDePagina(fonte, arquivo).filter((a) => a.guarda === null);

/** Fonte de produção: .ts e .tsx de src, sem testes e sem os manifestos das travas. */
function fontes(): { arquivo: string; fonte: string }[] {
  const saida: { arquivo: string; fonte: string }[] = [];
  for (const f of readdirSync("src", { recursive: true }) as string[]) {
    const arquivo = join("src", f).split("\\").join("/");
    // Manifestos das travas (dados de teste que citam os textos das telas) ficam de fora pelo caminho
    // EXATO — um arquivo de produção *-mapa.ts continua varrido (R2 da #134, B1).
    if (!/\.tsx?$/.test(arquivo) || /\.test\.|\.d\.ts$/.test(arquivo) || ["src/app/vazio-paginado-mapa.ts", "src/app/estados-vazios-mapa.ts", "src/app/botoes-mapa.ts"].includes(arquivo)) continue;
    saida.push({ arquivo, fonte: readFileSync(arquivo, "utf8") });
  }
  return saida;
}

describe("detector de vazio paginado (autoteste)", () => {
  const sem = (corpo: string) => vaziosPaginadosSemGuarda(`export function T({ xs, t, cursor, pagina, r, d, q, filtrando, antesVersao, depoisId, pendenciaCursor, proximoCursor, antes, busca, a }: any) { ${corpo} }`).map((x) => x.trecho);

  it("acusa texto fixo \"nesta página\" sem condição de paginação", () => {
    expect(sem("return <div>{!xs.length && <EstadoVazio>Nenhum pedido nesta página.</EstadoVazio>}</div>;")).toEqual(["Nenhum pedido nesta página."]);
    expect(sem("return <div>{xs.length ? <ul /> : <EstadoVazio bloco>Nenhum pedido nesta página.</EstadoVazio>}</div>;")).toEqual(["Nenhum pedido nesta página."]);
    expect(sem("return <table><tbody>{!xs.length && <EstadoVazioLinha colSpan={2}>Nenhum aluno nesta página.</EstadoVazioLinha>}</tbody></table>;")).toEqual(["Nenhum aluno nesta página."]);
    expect(sem("if (!xs.length) return <EstadoVazio>Nada nesta página.</EstadoVazio>; return <ul />;")).toEqual(["Nada nesta página."]);
    // String e template dentro do EstadoVazio; prop e variável de "vazio".
    expect(sem('return <EstadoVazio>{"Nada nesta página."}</EstadoVazio>;')).toEqual(["Nada nesta página."]);
    expect(sem("return <EstadoVazio>{`Nada de ${t} nesta página.`}</EstadoVazio>;")).toEqual(["Nada de … nesta página."]);
    expect(sem('return <Lista itens={xs} mensagemVazio="Nada nesta página." />;')).toEqual(["Nada nesta página."]);
    expect(sem('const textoVazio = "Nada nesta página."; return <Lista vazio={textoVazio} />;')).toEqual(["Nada nesta página."]);
  });

  it("acusa condição que não é de página ou que não garante sair da primeira", () => {
    // Condição de outra coisa (filtro, flag).
    expect(sem("return <div>{!xs.length && (filtrando ? <EstadoVazio>Nada nesta página.</EstadoVazio> : <EstadoVazio>Nada.</EstadoVazio>)}</div>;")).toEqual(["Nada nesta página."]);
    expect(sem('return <EstadoVazio bloco>{t ? "Nada com esse contato." : "Nenhum cadastro nesta página."}</EstadoVazio>;')).toEqual(["Nenhum cadastro nesta página."]);
    // Polaridade invertida: a página 1 é que mostra "nesta página".
    expect(sem("return <div>{cursor ? <EstadoVazio>Nada.</EstadoVazio> : <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual(["Nada nesta página."]);
    expect(sem("return <div>{pagina === 1 ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    expect(sem("return <div>{!depoisId && <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual(["Nada nesta página."]);
    // Comparação que não separa a primeira página; número de página sem comparação (sempre verdadeiro).
    expect(sem("return <div>{pagina > 0 ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    expect(sem("return <div>{r.pagina ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    // `proximoCursor` diz que há página seguinte, não que esta não é a primeira; `paginas` conta folhas.
    expect(sem("return <div>{proximoCursor ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    expect(sem("return <div>{a.paginas > 1 ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    // `||` com outra condição não garante; `cursor !== null` deixa passar undefined.
    expect(sem("return <div>{pagina > 1 || t ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    expect(sem("return <div>{cursor !== null ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    // Early return sem else: fora do alcance sintático, acusa (escreva como ternário).
    expect(sem("if (!cursor) return <EstadoVazio>Nada.</EstadoVazio>; return <EstadoVazio>Nada nesta página.</EstadoVazio>;")).toEqual(["Nada nesta página."]);
  });

  it("aceita o ramo de página seguinte: cursor presente ou número de página além da primeira", () => {
    expect(sem("return <div>{!xs.length && (cursor ? <EstadoVazio>Nada nesta página.</EstadoVazio> : <EstadoVazio>Fila zerada.</EstadoVazio>)}</div>;")).toEqual([]);
    expect(sem("return <div>{!xs.length && (!cursor ? <EstadoVazio>Fila zerada.</EstadoVazio> : <EstadoVazio>Nada nesta página.</EstadoVazio>)}</div>;")).toEqual([]);
    expect(sem("return <div>{xs.length ? <ul /> : q.cursor ? <EstadoVazio>Nada nesta página.</EstadoVazio> : <EstadoVazio>Nada.</EstadoVazio>}</div>;")).toEqual([]);
    expect(sem("return <div>{!xs.length && antesVersao && <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual([]);
    expect(sem("return <div>{depoisId ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}{pendenciaCursor ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual([]);
    expect(sem("return <div>{cursor !== undefined ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}{cursor == null ? null : <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual([]);
    expect(sem("return <div>{r.pagina > 1 ? <EstadoVazio>Nada nesta página.</EstadoVazio> : <EstadoVazio>Nada.</EstadoVazio>}</div>;")).toEqual([]);
    expect(sem("return <div>{d.paginaModelos >= 2 && <EstadoVazio>Nada nesta página.</EstadoVazio>}{pagina !== 1 && <EstadoVazio>Nada nesta página.</EstadoVazio>}{1 < pagina && <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual([]);
    expect(sem("return <div>{pagina === 1 ? <EstadoVazio>Nada.</EstadoVazio> : <EstadoVazio>Nada nesta página.</EstadoVazio>}{pagina <= 1 || <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual([]);
    // `&&` com um lado de página garante; guarda num ancestral distante também.
    expect(sem("return <div>{pagina > 1 && t ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual([]);
    expect(sem("return <div>{cursor && <section>{!xs.length && <EstadoVazio>Nada nesta página.</EstadoVazio>}</section>}</div>;")).toEqual([]);
    // Texto dentro do EstadoVazio escolhido pela página; if/else com return.
    expect(sem('return <EstadoVazio bloco>{t ? "Sem cadastro." : r.pagina > 1 ? "Nenhum cadastro nesta página." : "Nenhum cadastro."}</EstadoVazio>;')).toEqual([]);
    expect(sem("if (cursor) return <EstadoVazio>Nada nesta página.</EstadoVazio>; else return <EstadoVazio>Nada.</EstadoVazio>;")).toEqual([]);
    expect(sem("if (!xs.length) { return cursor ? <EstadoVazio>Nada nesta página.</EstadoVazio> : <EstadoVazio>Nada.</EstadoVazio>; } return <ul />;")).toEqual([]);
    // Prop de vazio com o trecho escolhido pelo cursor (como no diário).
    expect(sem("return <Lista mensagemVazio={busca ? `Nada para ${busca}${antes ? \" nesta página\" : \"\"}.` : undefined} />;")).toEqual([]);
  });

  it("ignora o texto que não fala de página", () => {
    expect(sem("return <EstadoVazio acao={<a href=\"?pagina=1\">Ir para a primeira página</a>}>Nenhum pedido aguardando decisão.</EstadoVazio>;")).toEqual([]);
    expect(sem("return <EstadoVazio>Nenhuma reserva nesta consulta.</EstadoVazio>;")).toEqual([]);
  });

  it("B3 (R1 da #134): todo texto conta, montado de qualquer jeito — fora do EstadoVazio, concatenado, em template ou constante", () => {
    expect(sem("return <p>Corrija e reenvie nesta página.</p>;")).toEqual(["Corrija e reenvie nesta página."]);
    expect(sem('return <div>{!xs.length && <p role="status">Nenhuma turma nesta página.</p>}</div>;')).toEqual(["Nenhuma turma nesta página."]);
    expect(sem('return <EstadoVazio>{"Nenhuma turma nesta " + "página."}</EstadoVazio>;')).toEqual(["Nenhuma turma nesta página."]);
    expect(sem('return <EstadoVazio>{`Nenhuma turma ${"nesta"} página.`}</EstadoVazio>;')).toEqual(["Nenhuma turma nesta página."]);
    expect(sem('const pedaco = "nesta"; return <EstadoVazio>{`Nenhuma turma ${pedaco} página.`}</EstadoVazio>;')).toEqual(["Nenhuma turma nesta página."]);
    // `.join` de lista literal e `.concat` (R2 da #134, B1).
    expect(sem('return <p>{["Nenhuma turma nesta", "página."].join(" ")}</p>;')).toEqual(["Nenhuma turma nesta página."]);
    expect(sem('return <p>{"Nenhuma turma nesta ".concat("página.")}</p>;')).toEqual(["Nenhuma turma nesta página."]);
    expect(sem('return <div>{cursor ? <p>{["Nada nesta", "página."].join(" ")}</p> : null}</div>;')).toEqual([]);
    // Constante noutro arquivo (.ts): o literal já acusa onde nasce.
    expect(vaziosPaginadosSemGuarda('export const VAZIO = "Nenhuma turma nesta página.";', "textos.ts").map((x) => x.trecho)).toEqual(["Nenhuma turma nesta página."]);
  });

  it("B3 (R1 da #134): apelido local vale pelo que é, não pelo nome", () => {
    expect(sem("const antesPagina = true; return <div>{antesPagina ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    expect(sem("const cursorX = false; return <div>{cursorX ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["Nada nesta página."]);
    expect(sem("const depoisDaPrimeira = r.pagina === 1; return <div>{depoisDaPrimeira ? <EstadoVazio>Nada nesta página.</EstadoVazio> : <EstadoVazio>Nada.</EstadoVazio>}</div>;")).toEqual(["Nada nesta página."]);
    // Apelido de verdade passa.
    expect(sem("const depoisDaPrimeira = r.pagina > 1; return <div>{depoisDaPrimeira ? <EstadoVazio>Nada nesta página.</EstadoVazio> : <EstadoVazio>Nada.</EstadoVazio>}</div>;")).toEqual([]);
    expect(sem("const primeira = !cursor; return <div>{primeira ? <EstadoVazio>Nada.</EstadoVazio> : <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual([]);
  });

  it("o guarda registrado é a condição que protege (o manifesto compara o texto dela)", () => {
    const guardas = (corpo: string) => textosDePagina(`export function T({ cursor, pendenciaCursor, d }: any) { ${corpo} }`).map((x) => x.guarda);
    expect(guardas("return <div>{pendenciaCursor ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["pendenciaCursor"]);
    expect(guardas("return <div>{cursor ? <EstadoVazio>Nada nesta página.</EstadoVazio> : null}</div>;")).toEqual(["cursor"]);
    expect(guardas("return <div>{d.paginaHistorico > 1 && <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual(["d.paginaHistorico > 1"]);
    expect(guardas("return <div>{!cursor ? null : <EstadoVazio>Nada nesta página.</EstadoVazio>}</div>;")).toEqual(["!(!cursor)"]);
  });
});

describe("estados vazios paginados nas telas", () => {
  const todos = fontes().flatMap(({ arquivo, fonte }) => textosDePagina(fonte, arquivo).map((a) => ({ arquivo, ...a })));

  it("nenhum texto \"nesta página\" aparece na primeira página (ou é exceção ancorada: arquivo + trecho)", () => {
    const casadas = new Map<number, number>();
    const soltos: string[] = [];
    for (const a of todos.filter((x) => x.guarda === null)) {
      const i = EXCECOES_VAZIO_PAGINADO.findIndex((e) => e.arquivo === a.arquivo && e.trecho === a.trecho);
      if (i >= 0) { casadas.set(i, (casadas.get(i) ?? 0) + 1); continue; }
      soltos.push(`${a.arquivo}:${a.linha} ${a.trecho}`);
    }
    expect(soltos).toEqual([]);
    // Cada exceção casa com exatamente um caso: vencida (0) ou ampla demais (2+) falha.
    const fora = EXCECOES_VAZIO_PAGINADO.map((e, i) => ({ vezes: casadas.get(i) ?? 0, e })).filter((x) => x.vezes !== 1).map((x) => `${x.vezes}× ${x.e.arquivo} | ${x.e.trecho}`);
    expect(fora).toEqual([]);
  });

  it("cada \"nesta página\" protegido tem a condição do manifesto (o cursor de outra lista muda o mapa)", () => {
    const real = todos.filter((x) => x.guarda !== null).map((x) => `${x.arquivo} | ${x.guarda} | ${x.trecho}`).sort();
    expect(real).toEqual([...MAPA_VAZIO_PAGINADO].sort());
  });
});
