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
// Alcance: TODO texto do código de produção (src: .ts, .tsx, .js, .jsx, .mjs, .cjs e .json) — não só o
// que está em <EstadoVazio>: um <p> à mão, uma constante noutro arquivo ou um .json importado também
// contam.
//
// Detecção que falha fechado (revisão R3 da #134, B1). Listar montagens ("a" + "b", `.join`, `.concat`…)
// sempre deixa uma de fora (lista em variável, `Array.of`, JSX partido, `<strong>`/`&nbsp;` no meio,
// `.replace`, helper, `.json`). Em vez disso, como na trava de enum (enums-rotulos.test.ts), a trava olha
// as PALAVRAS em cada pedaço de texto literal — string, template, texto e atributo de JSX — e no texto
// da posição onde ele aparece. O texto é o que a pessoa lê: entidades decodificadas (`&nbsp;`, `&#160;`),
// acento composto (NFC), sem caractere invisível, qualquer espaço como espaço, qualquer caixa e
// "pagina" sem acento também. Três sinais acusam o pedaço onde a palavra está:
//   1. "nesta página" no pedaço ou na posição;
//   2. "nesta" aberto: o pedaço termina em "nesta", ou na posição o que vem depois dele não se sabe
//      daqui (expressão não avaliável, componente) — a continuação vem de outro lugar;
//   3. "página" (minúscula) abrindo um texto avulso (argumento, constante, item de lista) ou logo depois
//      de algo que não se sabe — é continuação de frase (`"nesta X".replace("X", "página")`).
// A posição de um elemento JSX junta os filhos e tira as tags (`nesta <strong>página</strong>`); a de
// uma expressão junta literal, template, `+`, lista (`[…]`, `Array.of`), `.join`, `.concat` e constante
// local; o resto é "desconhecido" (…). O guarda é procurado a partir do pedaço acusado: o literal acusa
// onde nasce (uma constante fora do ramo protegido acusa mesmo que o uso esteja dentro dele).
//
// Por que rastrear até a posição e não um `EstadoVazioPaginado` único: a proibição de "nesta página"
// fora do componente precisaria do mesmo reconhecimento de texto partido (é isso que escapava), e
// trocaria ~45 telas já aprovadas. Aqui a mudança fica só na trava; o guarda continua conferido.
//
// Fora do alcance (declarado):
// - early return sem else (`if (!cursor) return <A/>; return <B/>` — o segundo return não é ramo
//   sintático do if; escreva como ternário);
// - palavra partida no meio (`"nes" + "ta"`) ou texto que não nasce de literal (String.fromCharCode,
//   dado vindo do servidor);
// - "Página" com maiúscula depois de algo desconhecido: abre texto próprio ("Página 2"), não continua frase.
//
// Manifesto (src/app/vazio-paginado-mapa.ts): cada "nesta página" protegido, com a CONDIÇÃO que o
// protege. Trocar o cursor de uma lista pelo da outra (`cursor` × `pendenciaCursor`) passa no nome,
// mas muda o mapa e falha.
//
// Exceções: arquivo + trecho exato (texto lido do pedaço acusado — ou da expressão que o junta) + motivo;
// cada uma tem de casar com exatamente um caso.

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
  // "página" em minúscula depois de algo desconhecido ou abrindo texto avulso (sinal 3): não continua "nesta".
  {
    arquivo: "src/components/VoltarPara.tsx",
    trecho: "página anterior",
    motivo: "nome genérico do destino do link de volta; entra depois de 'Voltar para' (aria-label) ou da seta, nunca depois de 'nesta'",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/contrato/aditivos/OriginaisPainel.tsx",
    trecho: "página(s)",
    motivo: "contagem de folhas do PDF do original ('{a.paginas} página(s)'); o desconhecido antes é número, não página de lista",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/contrato/previas/[previaId]/page.tsx",
    trecho: "página(s).",
    motivo: "contagem de folhas do PDF do original ('{a.paginas} página(s).'); o desconhecido antes é número, não página de lista",
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

// ---------------------------------------------------------------------------------------------------
// Texto: pedaços literais, posições e os três sinais (revisão R3 da #134, B1)
// ---------------------------------------------------------------------------------------------------

/** O que não dá para saber sem executar (chamada, ternário, campo). Marcadores na área de uso privado do Unicode: não são letra nem espaço. */
const DESCONHECIDO = "\uE000";
/** Filho JSX que é elemento ou componente: o texto dele é visto na própria posição, não daqui. */
const FRONTEIRA = "\uE001";

/** Pedaço do texto de uma posição; `no` é o literal de onde ele vem (null: espaço, desconhecido, fronteira). */
type Pedaco = { texto: string; no: ts.Node | null };
const desconhecido: Pedaco = { texto: DESCONHECIDO, no: null };
const fronteira: Pedaco = { texto: FRONTEIRA, no: null };
const espaco: Pedaco = { texto: " ", no: null };

const ENTIDADES: Record<string, string> = {
  nbsp: "\u00a0", ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009", shy: "\u00ad", zwj: "\u200d", zwnj: "\u200c",
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'",
};
/**
 * Texto como a pessoa lê (R3 da #134, B1/B2): entidade HTML decodificada (`&nbsp;`, `&#160;`, `&#xA0;`),
 * acento composto (NFC: "pa\u0301gina" é "página"), sem caractere invisível (`\u200b`, `&shy;`) e todo
 * espaço — inclusive o não separável — como " ". Não junta espaços (as posições dos pedaços se mantêm).
 */
export function textoLido(t: string): string {
  return t
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, c: string) => {
      if (c[0] !== "#") return ENTIDADES[c.toLowerCase()] ?? m;
      const n = c[1] === "x" || c[1] === "X" ? parseInt(c.slice(2), 16) : Number(c.slice(1));
      return n > 1 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    })
    .normalize("NFC")
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/\s/g, " ");
}

/** Sinal 1: "nesta página" (qualquer caixa, com ou sem acento), com espaço ou elemento JSX no meio. */
const FRASE = /(?<!\p{L})nesta[ \uE001]+p[aá]gina(?!\p{L})/giu;
/** Sinal 2: "nesta" aberto — o que vem depois é o fim do pedaço, um desconhecido ou um elemento. */
const NESTA_ABERTO = /(?<!\p{L})nesta[ \uE001]*(?=[\uE000\uE001]|$)/giu;
/** Sinal 3: "página" minúscula logo depois de um desconhecido ("pagina" sem acento só seguida de espaço ou
 * pontuação — a chave `pagina` da URL não é texto). */
const PAGINA_APOS_DESCONHECIDO = /\uE000[ \uE001]*(página|pagina(?=[ .,;:!?)]))(?!\p{L})/gu;
/** Sinal 3: "página" minúscula abrindo um texto avulso (argumento, constante, item de lista). */
const PAGINA_NO_INICIO = /^ *(página|pagina(?=[ .,;:!?)]))(?!\p{L})/gu;

type Regra = { re: RegExp; palavra: (m: RegExpMatchArray) => number };
/** Onde começa a palavra acusada: no início do casamento ("nesta") ou no grupo ("página"). */
const noInicio = (m: RegExpMatchArray) => m.index!;
const noGrupo = (m: RegExpMatchArray) => m.index! + m[0].length - m[1].length;
/** Pedaço sozinho: frase inteira ou "nesta" no fim. */
const REGRAS_PEDACO: Regra[] = [{ re: FRASE, palavra: noInicio }, { re: NESTA_ABERTO, palavra: noInicio }];
/** Posição de JSX: o início é o da posição de fora (o "nesta" de lá é visto lá). */
const REGRAS_JSX: Regra[] = [...REGRAS_PEDACO, { re: PAGINA_APOS_DESCONHECIDO, palavra: noGrupo }];
/** Texto avulso (expressão fora do filho de JSX): também não pode abrir com "página". */
const REGRAS_AVULSO: Regra[] = [...REGRAS_JSX, { re: PAGINA_NO_INICIO, palavra: noGrupo }];

/** Aplica as regras ao texto lido dos pedaços e devolve os literais acusados (onde a palavra está). */
function acusados(lista: Pedaco[], regras: Regra[]): ts.Node[] {
  let texto = "";
  const inicios: number[] = [];
  for (const p of lista) { inicios.push(texto.length); texto += textoLido(p.texto); }
  const nos: ts.Node[] = [];
  for (const r of regras) {
    for (const m of texto.matchAll(r.re)) {
      const i = r.palavra(m);
      let k = inicios.length - 1;
      while (k > 0 && inicios[k] > i) k--;
      const no = lista[k]?.no;
      if (no) nos.push(no);
    }
  }
  return nos;
}

/** Literal de texto: string, template sem ou com substituição (cada parte), texto de JSX. Fora: o caminho de import/export. */
function ehPedacoLiteral(n: ts.Node): n is ts.LiteralLikeNode {
  if (ts.isJsxText(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) return true;
  return ts.isStringLiteral(n) && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent) && !ts.isExternalModuleReference(n.parent);
}

/** Filho direto de um elemento JSX (`<p>{x}</p>`): o texto dele é visto na posição do elemento. */
const ehFilhoJsx = (n: ts.Node) => ts.isJsxExpression(n.parent) && (ts.isJsxElement(n.parent.parent) || ts.isJsxFragment(n.parent.parent));

const ehArrayOf = (c: ts.CallExpression) =>
  ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === "of" && ts.isIdentifier(c.expression.expression) && c.expression.expression.text === "Array";
const METODOS_QUE_JUNTAM = new Set(["join", "concat"]);
/** `Array.of(…)`, `x.join(…)` ou `x.concat(…)`: os argumentos entram no texto. */
const juntaArgumentos = (c: ts.CallExpression) =>
  ehArrayOf(c) || (ts.isPropertyAccessExpression(c.expression) && METODOS_QUE_JUNTAM.has(c.expression.name.text));

/** O pai de `n` compõe o texto dele? Devolve o nó que junta (para continuar subindo) ou null. */
function compoe(n: ts.Node): ts.Node | null {
  const p = n.parent;
  if (!p) return null;
  if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p) || ts.isSatisfiesExpression(p)) return p;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken) return p;
  if (ts.isTemplateSpan(p)) return p.parent;
  // Item de lista só compõe quando a lista vira um texto (juntada, ou filha de JSX — o React junta os itens).
  if (ts.isArrayLiteralExpression(p)) return listaViraTexto(p) ? p : null;
  if (ts.isPropertyAccessExpression(p) && p.expression === n && METODOS_QUE_JUNTAM.has(p.name.text) && ts.isCallExpression(p.parent) && p.parent.expression === p) return p.parent;
  if (ts.isCallExpression(p) && p.arguments.some((a) => a === n) && juntaArgumentos(p)) return p;
  return null;
}

/** A lista (tirados parênteses e `as`) é filha de JSX ou é juntada/somada num texto? */
function listaViraTexto(lista: ts.Node): boolean {
  let n = lista;
  while (n.parent && (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent) || ts.isNonNullExpression(n.parent) || ts.isSatisfiesExpression(n.parent))) n = n.parent;
  return ehFilhoJsx(n) || compoe(n) !== null;
}

/** A expressão de texto inteira de que o literal faz parte (o template de uma parte, a soma, o `.join`…). */
function raiz(n: ts.Node): ts.Node {
  if (ts.isTemplateHead(n)) n = n.parent;
  else if (ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) n = n.parent.parent;
  for (let p = compoe(n); p; p = compoe(n)) n = p;
  return n;
}

/** Itens de `[…]`, `Array.of(…)` ou de constante local com uma delas (null: não é lista conhecida). */
function itensDaLista(e: ts.Expression, profundidade: number): ts.Expression[] | null {
  e = desembrulha(e);
  if (ts.isArrayLiteralExpression(e)) return e.elements.filter((x) => !ts.isOmittedExpression(x));
  if (ts.isCallExpression(e) && ehArrayOf(e)) return [...e.arguments];
  if (ts.isIdentifier(e) && profundidade < 5) {
    const inits = declaracoes.get(e.text) ?? [];
    if (inits.length === 1) return itensDaLista(inits[0], profundidade + 1);
  }
  return null;
}

/**
 * Pedaços do texto que a expressão produz: literal, template, `+`, lista (o React junta os itens), `.join`
 * (de `[…]`, `Array.of` ou constante), `.concat` e constante local de um só valor. O resto (chamada,
 * ternário, campo, espalhamento) é desconhecido — os ramos de um ternário são textos próprios, com o seu guarda.
 */
function pedacos(e: ts.Expression, profundidade = 0): Pedaco[] {
  e = desembrulha(e);
  if (profundidade > 5) return [desconhecido];
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [{ texto: e.text, no: e }];
  if (ts.isTemplateExpression(e)) {
    return [{ texto: e.head.text, no: e.head }, ...e.templateSpans.flatMap((s) => [...pedacos(s.expression, profundidade + 1), { texto: s.literal.text, no: s.literal }])];
  }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) return [...pedacos(e.left, profundidade + 1), ...pedacos(e.right, profundidade + 1)];
  const itens = itensDaLista(e, profundidade);
  if (itens) return itens.flatMap((x) => pedacos(x, profundidade + 1));
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
    const alvo = e.expression.expression, metodo = e.expression.name.text;
    if (metodo === "join") {
      const lista = itensDaLista(alvo, profundidade);
      if (!lista) return [desconhecido];
      const sep: Pedaco[] = e.arguments[0] ? pedacos(e.arguments[0], profundidade + 1) : [{ texto: ",", no: null }];
      return lista.flatMap((x, i) => [...(i ? sep : []), ...pedacos(x, profundidade + 1)]);
    }
    if (metodo === "concat") return [...pedacos(alvo, profundidade + 1), ...e.arguments.flatMap((a) => pedacos(a, profundidade + 1))];
  }
  if (ts.isIdentifier(e)) {
    const inits = declaracoes.get(e.text) ?? [];
    if (inits.length === 1) return pedacos(inits[0], profundidade + 1);
  }
  return [desconhecido];
}

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

/** A expressão só rende elementos JSX (ou nada): `cond && <X/>`, `a ? <X/> : null`, `xs.map((x) => <li/>)`. */
function devolveJsx(e: ts.Expression): boolean {
  e = desembrulha(e);
  const K = ts.SyntaxKind;
  if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return true;
  if (e.kind === K.NullKeyword || e.kind === K.FalseKeyword || (ts.isIdentifier(e) && e.text === "undefined")) return true;
  if (ts.isConditionalExpression(e)) return devolveJsx(e.whenTrue) && devolveJsx(e.whenFalse);
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (op === K.AmpersandAmpersandToken) return devolveJsx(e.right);
    if (op === K.BarBarToken || op === K.QuestionQuestionToken) return devolveJsx(e.left) && devolveJsx(e.right);
  }
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && ["map", "flatMap"].includes(e.expression.name.text)) {
    const [fn] = e.arguments;
    if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
      const r = retornos(fn);
      return r.length > 0 && r.every(devolveJsx);
    }
  }
  return false;
}

/**
 * Pedaços do texto de um elemento JSX, como a pessoa lê: os filhos juntos, com as tags tiradas
 * (`nesta <strong>página</strong>` é "nesta página"). Expressão de texto entra avaliada; a que só rende
 * elementos e o componente sem filhos (`<Rotulo />`) são fronteira — o texto deles não se vê daqui.
 */
function pedacosJsx(el: ts.JsxElement | ts.JsxFragment): Pedaco[] {
  return el.children.flatMap((c): Pedaco[] => {
    if (ts.isJsxText(c)) return [{ texto: c.text, no: c }];
    if (ts.isJsxExpression(c)) return !c.expression ? [] : devolveJsx(c.expression) ? [fronteira] : pedacos(c.expression);
    if (ts.isJsxElement(c) || ts.isJsxFragment(c)) return [espaco, ...pedacosJsx(c), espaco];
    // <br />, <img />: espaço; <Componente />: rende texto que não se vê daqui.
    return [/^[a-z]/.test(c.tagName.getText()) ? espaco : fronteira];
  });
}

/** Trecho que identifica o acusado: o texto do JSX, ou a expressão inteira que junta o literal. */
function trechoDe(no: ts.Node): string {
  const bruto = ts.isJsxText(no) ? no.text : pedacos(raiz(no) as ts.Expression).map((p) => p.texto).join("");
  return normaliza(textoLido(bruto).split(DESCONHECIDO).join("…").split(FRONTEIRA).join(" "));
}

type Achado = { linha: number; trecho: string; guarda: string | null };

/** Árvore sintática; o tipo segue a extensão. .json vira `export default {…}` (as linhas não mudam). */
function arvore(fonte: string, arquivo: string): ts.SourceFile {
  const json = arquivo.endsWith(".json");
  const tipo = json || /\.[mc]?ts$/.test(arquivo) ? ts.ScriptKind.TS : arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
  return ts.createSourceFile(arquivo, json ? `export default ${fonte}` : fonte, ts.ScriptTarget.Latest, true, tipo);
}

/**
 * Todo texto "nesta página" do arquivo — inteiro, partido ou aberto (os três sinais) —, com a condição de
 * paginação que protege o pedaço acusado (null: a página 1 pode mostrá-lo). Não só o que está em
 * <EstadoVazio>: um <p> à mão, uma constante noutro arquivo ou um .json também contam (R1 da #134, B3;
 * R3 da #134, B1). Cada literal é acusado no máximo uma vez.
 */
export function textosDePagina(fonte: string, arquivo = "x.tsx"): Achado[] {
  const sf = arvore(fonte, arquivo);
  declaracoes = coletarDeclaracoes(sf);
  const marcados = new Set<ts.Node>(), vistas = new Set<ts.Node>();
  const marca = (nos: ts.Node[]) => { for (const no of nos) marcados.add(no); };
  const visita = (n: ts.Node) => {
    if (ehPedacoLiteral(n)) {
      // O pedaço sozinho.
      marca(acusados([{ texto: n.text, no: n }], REGRAS_PEDACO));
      // A expressão de texto inteira de que ele faz parte (a de filho de JSX é vista na posição do elemento).
      if (!ts.isJsxText(n)) {
        const r = raiz(n);
        if (!vistas.has(r) && !ehFilhoJsx(r)) { vistas.add(r); marca(acusados(pedacos(r as ts.Expression), REGRAS_AVULSO)); }
      }
    }
    // A posição de um elemento JSX que não está dentro de outro (o de dentro entra no texto do de fora).
    if ((ts.isJsxElement(n) || ts.isJsxFragment(n)) && !ts.isJsxElement(n.parent) && !ts.isJsxFragment(n.parent)) marca(acusados(pedacosJsx(n), REGRAS_JSX));
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return [...marcados]
    .sort((a, b) => a.getStart(sf) - b.getStart(sf))
    .map((no) => ({ linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, trecho: trechoDe(no), guarda: guardaDaPaginacao(no, sf) }));
}

/** Textos "nesta página" que a página 1 pode mostrar. */
export const vaziosPaginadosSemGuarda = (fonte: string, arquivo = "x.tsx") => textosDePagina(fonte, arquivo).filter((a) => a.guarda === null);

/** Fonte de produção: código e dados de src (.ts, .tsx, .js, .jsx, .mjs, .cjs, .json), sem testes e sem os
 * manifestos das travas. Um .json ou .js importado por uma tela também é texto dela (R3 da #134, B1). */
function fontes(): { arquivo: string; fonte: string }[] {
  const saida: { arquivo: string; fonte: string }[] = [];
  for (const f of readdirSync("src", { recursive: true }) as string[]) {
    const arquivo = join("src", f).split("\\").join("/");
    // Manifestos das travas (dados de teste que citam os textos das telas) ficam de fora pelo caminho
    // EXATO — um arquivo de produção *-mapa.ts continua varrido (R2 da #134, B1).
    if (!/\.([mc]?[jt]sx?|json)$/.test(arquivo) || /\.test\.|\.d\.[mc]?ts$/.test(arquivo) || ["src/app/vazio-paginado-mapa.ts", "src/app/estados-vazios-mapa.ts", "src/app/botoes-mapa.ts"].includes(arquivo)) continue;
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
    // O literal acusa onde nasce: o trecho é o da constante (R3 da #134 — o pedaço acusado é o literal).
    expect(sem('const pedaco = "nesta"; return <EstadoVazio>{`Nenhuma turma ${pedaco} página.`}</EstadoVazio>;')).toEqual(["nesta"]);
    // `.join` de lista literal e `.concat` (R2 da #134, B1).
    expect(sem('return <p>{["Nenhuma turma nesta", "página."].join(" ")}</p>;')).toEqual(["Nenhuma turma nesta página."]);
    expect(sem('return <p>{"Nenhuma turma nesta ".concat("página.")}</p>;')).toEqual(["Nenhuma turma nesta página."]);
    expect(sem('return <div>{cursor ? <p>{["Nada nesta", "página."].join(" ")}</p> : null}</div>;')).toEqual([]);
    // Constante noutro arquivo (.ts): o literal já acusa onde nasce.
    expect(vaziosPaginadosSemGuarda('export const VAZIO = "Nenhuma turma nesta página.";', "textos.ts").map((x) => x.trecho)).toEqual(["Nenhuma turma nesta página."]);
  });

  // Revisão R3 da #134, B1: a forma paralela `{!d.planos[0] && <p role="status">…</p>}` (como em
  // academico/recuperacoes/planos/page.tsx) montada de cada jeito que escapava.
  describe("B1 (R3 da #134): montagens que escapavam falham fechado (XV1–XV10, R3/R4)", () => {
    const planos = (texto: string, antes = "") => sem(`${antes} return <div>{!d.planos[0] && <p role="status">${texto}</p>}</div>;`);
    const arquivo = (fonte: string, nome: string) => vaziosPaginadosSemGuarda(fonte, nome).map((x) => x.trecho);

    it("XV1: lista em variável + .join — o literal com \"nesta\" no fim acusa onde nasce", () => {
      expect(planos('{PARTES.join(" ")}', 'const PARTES = ["Nenhuma proposta nesta", "página."];')).toEqual(["Nenhuma proposta nesta", "página."]);
      // Constante de módulo (fora de função) também.
      expect(vaziosPaginadosSemGuarda('const PARTES = ["Nenhuma proposta nesta", "página."];\nexport function T({ d }: any) { return <div>{!d.planos[0] && <p>{PARTES.join(" ")}</p>}</div>; }').map((x) => x.trecho))
        .toEqual(["Nenhuma proposta nesta", "página."]);
    });

    it("XV2: texto partido no JSX (`nesta {\"página.\"}`)", () => {
      expect(planos('Nenhuma proposta nesta {"página."}')).toEqual(["Nenhuma proposta nesta"]);
      expect(planos('{"Nenhuma proposta nesta"} página.')).toEqual(["Nenhuma proposta nesta"]);
    });

    it("XV3 / R3: tag no meio (`nesta <strong>página</strong>`)", () => {
      expect(planos("Nenhuma proposta nesta <strong>página</strong>.")).toEqual(["Nenhuma proposta nesta"]);
      expect(sem("return <div>{!r.registros[0] && <p>Nenhuma turma nesta <strong>página</strong>.</p>}</div>;")).toEqual(["Nenhuma turma nesta"]);
      expect(planos("<strong>Nenhuma proposta nesta</strong> página.")).toEqual(["Nenhuma proposta nesta"]);
    });

    it("XV4 / R4: espaço não separável (`&nbsp;`, `&#160;`, `&#xA0;`, \\u00a0)", () => {
      expect(planos("Nenhuma proposta nesta&nbsp;página.")).toEqual(["Nenhuma proposta nesta página."]);
      expect(sem("return <div>{!r.registros[0] && <p>Nenhuma turma nesta&nbsp;página.</p>}</div>;")).toEqual(["Nenhuma turma nesta página."]);
      expect(planos("Nenhuma proposta nesta&#160;página.")).toEqual(["Nenhuma proposta nesta página."]);
      expect(planos("Nenhuma proposta nesta&#xA0;página.")).toEqual(["Nenhuma proposta nesta página."]);
      expect(planos('{"Nenhuma proposta nesta\\u00a0página."}')).toEqual(["Nenhuma proposta nesta página."]);
    });

    it("XV5: `.replace` / `.replaceAll` — \"página\" minúscula abrindo texto avulso ou depois de desconhecido", () => {
      expect(planos('{"Nenhuma proposta nesta X.".replace("X", "página")}')).toEqual(["página"]);
      expect(planos('{"Nenhuma proposta nesta consulta.".replaceAll("consulta", "página")}')).toEqual(["página"]);
      expect(planos('{"Nenhuma proposta nesta X.".replace("X", PAG)}', 'const PAG = "página";')).toEqual(["página"]);
      expect(planos('{"Nenhuma proposta nesta X".replace(" X", "")} página.')).toEqual(["página."]);
    });

    it("XV6: `Array.of(…).join`", () => {
      expect(planos('{Array.of("Nenhuma proposta nesta", "página.").join(" ")}')).toEqual(["Nenhuma proposta nesta página."]);
    });

    it("XV7: helper com template", () => {
      expect(planos("{vazio(\"proposta\")}", "const vazio = (o: string) => `Nenhuma ${o} nesta página.`;")).toEqual(["Nenhuma … nesta página."]);
      expect(planos('{frase("Nenhuma proposta nesta", "página.")}', "const frase = (a: string, b: string) => `${a} ${b}`;")).toEqual(["Nenhuma proposta nesta", "página."]);
    });

    it("XV8 / XV9: texto em .json ou .js importado (a varredura inclui esses arquivos)", () => {
      expect(arquivo('{ "vazio": "Nenhuma proposta nesta página." }', "src/app/textos.json")).toEqual(["Nenhuma proposta nesta página."]);
      expect(arquivo('{ "partes": ["Nenhuma proposta nesta", "página."] }', "src/app/textos.json")).toEqual(["Nenhuma proposta nesta", "página."]);
      expect(arquivo('export const VAZIO = "Nenhuma proposta nesta página.";', "src/app/textos.js")).toEqual(["Nenhuma proposta nesta página."]);
      expect(arquivo('export default { vazio: "Nenhuma proposta nesta página." };', "src/app/textos.mjs")).toEqual(["Nenhuma proposta nesta página."]);
      expect(arquivo('export const Vazio = () => <p>Nenhuma proposta nesta <b>página</b>.</p>;', "src/app/Vazio.jsx")).toEqual(["Nenhuma proposta nesta"]);
    });

    it("XV10: `[\"…\"].concat()` de literal inteiro", () => {
      expect(planos('{["Nenhuma proposta nesta página."].concat()}')).toEqual(["Nenhuma proposta nesta página."]);
      expect(planos('{["Nenhuma proposta"].concat(" nesta", " página.")}')).toEqual(["Nenhuma proposta nesta página."]);
    });

    it("falha fechado: \"nesta\" seguido do que não se sabe daqui, caixa, acento, invisível", () => {
      // Expressão ou componente depois de "nesta": a continuação vem de outro lugar.
      expect(planos("Nenhuma proposta nesta {rotulo}.")).toEqual(["Nenhuma proposta nesta"]);
      expect(planos("Nenhuma proposta nesta <Rotulo />.")).toEqual(["Nenhuma proposta nesta"]);
      expect(planos("Nenhuma proposta nesta {cursor ? <b>página</b> : null} hoje.")).toEqual(["Nenhuma proposta nesta"]);
      expect(planos('{`Nenhuma proposta nesta ${rotulo}.`}')).toEqual(["Nenhuma proposta nesta …."]);
      // Caixa, sem acento, acento decomposto, caractere invisível.
      expect(planos("NENHUMA PROPOSTA NESTA PÁGINA.")).toEqual(["NENHUMA PROPOSTA NESTA PÁGINA."]);
      expect(planos("Nenhuma proposta nesta pagina.")).toEqual(["Nenhuma proposta nesta pagina."]);
      expect(planos('{"Nenhuma proposta nesta pa\\u0301gina."}')).toEqual(["Nenhuma proposta nesta página."]);
      expect(planos('{"Nenhuma proposta nes\\u200bta página."}')).toEqual(["Nenhuma proposta nesta página."]);
      // Número desconhecido antes de "página" também acusa (por isso a contagem de folhas é exceção ancorada).
      expect(sem("return <p>{a.paginas} página(s)</p>;")).toEqual(["página(s)"]);
    });

    it("protegido pelo guarda, o texto partido passa — e o guarda é o do pedaço acusado", () => {
      expect(sem("return <div>{cursor ? <p>Nada nesta <strong>página</strong>.</p> : null}</div>;")).toEqual([]);
      expect(sem("return <div>{r.pagina > 1 && <p>Nada nesta&nbsp;página.</p>}</div>;")).toEqual([]);
      expect(sem('return <div>{cursor ? <p>{"Nada nesta X.".replace("X", "página")}</p> : null}</div>;')).toEqual([]);
      expect(textosDePagina("export function T({ cursor }: any) { return <div>{cursor ? <p>Nada nesta <strong>página</strong>.</p> : null}</div>; }").map((x) => `${x.guarda} | ${x.trecho}`))
        .toEqual(["cursor | Nada nesta"]);
      // A constante fora do ramo acusa onde nasce, mesmo usada dentro dele.
      expect(sem('const PARTES = ["Nada nesta", "página."]; return <div>{cursor ? <p>{PARTES.join(" ")}</p> : null}</div>;')).toEqual(["Nada nesta", "página."]);
    });

    it("não acusa o que não monta \"nesta página\"", () => {
      expect(sem([
        "return <div>",
        "<p>Nenhuma reserva nesta matrícula.</p><p>Nesta conversa, nada.</p>",
        '<nav>{pagina > 1 && <a href="?">Anterior</a>}<span>Página {pagina}</span></nav>',
        '<nav>{pagina > 1 && link(pagina - 1, "← Anterior")}<span>Página {pagina}</span></nav>',
        '<a href={`?pagina=${pagina}`}>Ir para a primeira página</a>',
        "<p>{a.paginas} páginas</p>",
        "</div>;",
      ].join(""))).toEqual([]);
      expect(sem('const p = sp.get("pagina"); if (!p) throw new Erro("Página indisponível."); return <p>{["pagina", "busca"].join(",")}</p>;')).toEqual([]);
    });
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
