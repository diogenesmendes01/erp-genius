import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

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
// Alcance: texto (JSX ou string, inclusive partes de template) dentro de <EstadoVazio>/
// <EstadoVazioLinha> — atributos inclusos —, ou num valor cujo nome fala de vazio (prop
// `mensagemVazio`, `const textoVazio = …`, `{ vazio: … }`). O ramo de lista vazia de uma tela já é
// obrigatoriamente <EstadoVazio> (src/app/estados-vazios.test.ts), então isso cobre os vazios.
// Fora do alcance (declarado): early return sem else (`if (!cursor) return <A/>; return <B/>` — o
// segundo return não é ramo sintático do if; escreva como ternário) e textos que não são estado
// vazio ("Corrija e reenvie nesta página", título "Turmas compatíveis nesta página").
//
// Exceções: arquivo + trecho exato (texto normalizado do nó) + motivo; cada uma tem de casar com
// exatamente um caso.

const RAIZES = ["src/app", "src/components"];
const COMPONENTES_DE_VAZIO = new Set(["EstadoVazio", "EstadoVazioLinha"]);
const TEXTO_DE_PAGINA = /nesta\s+página/i;
const NOME_DE_VAZIO = /vazi/i;
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

/** A expressão avaliar como `valor` garante estar fora da primeira página? */
export function foraDaPrimeira(e: ts.Expression, valor: boolean): boolean {
  e = desembrulha(e);
  const K = ts.SyntaxKind;
  if (ts.isPrefixUnaryExpression(e) && e.operator === K.ExclamationToken) return foraDaPrimeira(e.operand, !valor);
  const nome = nomeDe(e);
  if (nome !== null) return valor && CURSOR.test(nome);
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

/** Algum ancestral escolhe este ramo só fora da primeira página? */
function protegidoPelaPaginacao(no: ts.Node): boolean {
  const K = ts.SyntaxKind;
  let filho: ts.Node = no;
  for (let p = no.parent; p; filho = p, p = p.parent) {
    if (ts.isConditionalExpression(p)) {
      if (p.whenTrue === filho && foraDaPrimeira(p.condition, true)) return true;
      if (p.whenFalse === filho && foraDaPrimeira(p.condition, false)) return true;
    } else if (ts.isBinaryExpression(p) && p.right === filho) {
      if (p.operatorToken.kind === K.AmpersandAmpersandToken && foraDaPrimeira(p.left, true)) return true;
      if (p.operatorToken.kind === K.BarBarToken && foraDaPrimeira(p.left, false)) return true;
    } else if (ts.isIfStatement(p)) {
      if (p.thenStatement === filho && foraDaPrimeira(p.expression, true)) return true;
      if (p.elseStatement === filho && foraDaPrimeira(p.expression, false)) return true;
    }
  }
  return false;
}

/** O nó está num estado vazio: dentro de <EstadoVazio>/<EstadoVazioLinha> ou num valor de nome "vazio". */
function emEstadoVazio(no: ts.Node, sf: ts.SourceFile): boolean {
  for (let p = no.parent; p; p = p.parent) {
    if (ts.isJsxElement(p) && COMPONENTES_DE_VAZIO.has(p.openingElement.tagName.getText(sf))) return true;
    if (ts.isJsxAttribute(p) && NOME_DE_VAZIO.test(p.name.getText(sf))) return true;
    if ((ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p)) && ts.isIdentifier(p.name) && NOME_DE_VAZIO.test(p.name.text)) return true;
  }
  return false;
}

function textoDoNo(n: ts.Node): string | null {
  if (ts.isJsxText(n)) return n.text;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) return n.text;
  return null;
}

type Achado = { linha: number; trecho: string };

/** Textos "nesta página" de estado vazio que a página 1 pode mostrar. */
export function vaziosPaginadosSemGuarda(fonte: string, arquivo = "x.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: Achado[] = [];
  const visita = (n: ts.Node) => {
    const texto = textoDoNo(n);
    if (texto !== null && TEXTO_DE_PAGINA.test(texto) && emEstadoVazio(n, sf) && !protegidoPelaPaginacao(n)) {
      achados.push({ linha: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, trecho: normaliza(texto) });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
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

describe("detector de vazio paginado (autoteste)", () => {
  const sem = (corpo: string) => vaziosPaginadosSemGuarda(`export function T({ xs, t, cursor, pagina, r, d, q, filtrando, antesVersao, depoisId, pendenciaCursor, proximoCursor, antes, busca, a }: any) { ${corpo} }`).map((x) => x.trecho);

  it("acusa texto fixo \"nesta página\" sem condição de paginação", () => {
    expect(sem("return <div>{!xs.length && <EstadoVazio>Nenhum pedido nesta página.</EstadoVazio>}</div>;")).toEqual(["Nenhum pedido nesta página."]);
    expect(sem("return <div>{xs.length ? <ul /> : <EstadoVazio bloco>Nenhum pedido nesta página.</EstadoVazio>}</div>;")).toEqual(["Nenhum pedido nesta página."]);
    expect(sem("return <table><tbody>{!xs.length && <EstadoVazioLinha colSpan={2}>Nenhum aluno nesta página.</EstadoVazioLinha>}</tbody></table>;")).toEqual(["Nenhum aluno nesta página."]);
    expect(sem("if (!xs.length) return <EstadoVazio>Nada nesta página.</EstadoVazio>; return <ul />;")).toEqual(["Nada nesta página."]);
    // String e template dentro do EstadoVazio; prop e variável de "vazio".
    expect(sem('return <EstadoVazio>{"Nada nesta página."}</EstadoVazio>;')).toEqual(["Nada nesta página."]);
    expect(sem("return <EstadoVazio>{`Nada de ${t} nesta página.`}</EstadoVazio>;")).toEqual(["nesta página."]);
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

  it("ignora o que não é estado vazio e o texto que não fala de página", () => {
    expect(sem("return <p>Corrija e reenvie nesta página.</p>;")).toEqual([]);
    expect(sem("return <h3>Turmas compatíveis nesta página</h3>;")).toEqual([]);
    expect(sem('return <select><option value="">Selecione uma turma nesta página</option></select>;')).toEqual([]);
    expect(sem("return <EstadoVazio acao={<a href=\"?pagina=1\">Ir para a primeira página</a>}>Nenhum pedido aguardando decisão.</EstadoVazio>;")).toEqual([]);
    expect(sem("return <EstadoVazio>Nenhuma reserva nesta consulta.</EstadoVazio>;")).toEqual([]);
  });
});

describe("estados vazios paginados nas telas", () => {
  it("nenhuma tela mostra \"nesta página\" na primeira página (ou é exceção ancorada: arquivo + trecho)", () => {
    const casadas = new Map<number, number>();
    const soltos: string[] = [];
    for (const { arquivo, fonte } of telas()) {
      for (const a of vaziosPaginadosSemGuarda(fonte, arquivo)) {
        const i = EXCECOES_VAZIO_PAGINADO.findIndex((e) => e.arquivo === arquivo && e.trecho === a.trecho);
        if (i >= 0) { casadas.set(i, (casadas.get(i) ?? 0) + 1); continue; }
        soltos.push(`${arquivo}:${a.linha} ${a.trecho}`);
      }
    }
    expect(soltos).toEqual([]);
    // Cada exceção casa com exatamente um caso: vencida (0) ou ampla demais (2+) falha.
    const fora = EXCECOES_VAZIO_PAGINADO.map((e, i) => ({ vezes: casadas.get(i) ?? 0, e })).filter((x) => x.vezes !== 1).map((x) => `${x.vezes}× ${x.e.arquivo} | ${x.e.trecho}`);
    expect(fora).toEqual([]);
  });
});
