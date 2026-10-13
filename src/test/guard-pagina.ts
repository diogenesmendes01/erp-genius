import { readFileSync } from "node:fs";
import ts from "typescript";

/**
 * Papéis do guard que SEGURA uma página, para as travas "a aba tem os mesmos papéis do guard" (abas
 * de /academico e /diario). Lê a AST do TypeScript (TSX), não o texto: comentário, string e texto de
 * JSX não contam (R1 da #143, B2).
 *
 * O guard aceito tem uma forma só — a de todas as páginas das abas (R2 da #143, B3 e B4):
 *
 *     import { Papel } from "@prisma/client";
 *     import { exigirSessaoPagina } from "@/server/_shared";
 *     export default async function Pagina(...) {
 *       await exigirSessaoPagina(Papel.X, Papel.Y);          // ou: const u = await exigirSessaoPagina(...)
 *       ...
 *
 * isto é, a PRIMEIRA instrução do corpo da função `export default`, aguardada. Falha alto — em vez
 * de devolver vazio, uma lista parcial ou os papéis de uma isca — quando:
 * - não há guard nessa posição (ausente, depois de outra instrução, dentro de `if`, ternário, `&&`,
 *   IIFE, outra função…);
 * - o identificador `exigirSessaoPagina` aparece em qualquer outro lugar além do import e desse
 *   guard (segunda chamada, função-isca nunca chamada, `obj.exigirSessaoPagina`, declaração local);
 * - o guard é importado com alias, por `import * as`/default de `@/server/_shared`, ou o módulo é
 *   carregado por `import()`/`require`/`import x = require(…)` — a chamada real ficaria com outro nome,
 *   até sem o identificador (`m["exigirSessaoPagina"](…)`). `import()`/`require` com especificador não
 *   literal também falha: não dá para saber qual módulo vem;
 * - a chamada não tem papéis, ou algum argumento não é `Papel.X` literal (`...PAPEIS`, constante);
 * - `Papel` não vem de `import { Papel } from "@prisma/client"` sem alias, ou há outra declaração
 *   chamada `Papel` no arquivo (um objeto local poderia remapear `Papel.SECRETARIA_ACADEMICA`).
 *
 * E o guard tem de ser a ÚNICA recusa da página (R2 da #143, B6): os papéis dele só valem como "quem
 * abre a página" se nada depois recusa uma parte deles. Também falha alto quando o arquivo:
 * - tem recusa dura em qualquer ponto: `throw`, `Promise.reject`, `redirect`/`permanentRedirect`/
 *   `notFound`/`forbidden`/`unauthorized`, `<AcessoNegado>`, `exigirPapel`/`exigirSessaoComPapel`/
 *   `exigirSessao`, qualquer carga de `next/navigation` (import estático, `import()`, `require` ou
 *   `import x = require(…)`), ou import de `@/server/_shared` além de `exigirSessaoPagina` e
 *   `temPapel`. Nenhuma das páginas das abas faz isso hoje; se uma precisar (ex.: notFound por
 *   registro inexistente), a trava ganha uma exceção ancorada e testada;
 * - tem recusa branda: `return` de um componente de topo (função declarada no topo do arquivo, ou
 *   arrow/function atribuída a uma const de topo) sob `if`/`switch`/`case`/`while`/`do`/`for` cuja
 *   condição lê papel, ou `return cond ? … : …` / `return cond && …` / `cond || …` / `cond ?? …`
 *   (também sob parênteses, `as`, `satisfies` ou `!`) com condição que lê papel. "Lê papel" = cita
 *   `papeis`, `temPapel` ou `Papel` (também como chave lida: `x["papeis"]`, `{ papeis: p } = x`), ou
 *   uma variável inicializada, atribuída ou desestruturada a partir disso (propagado até o ponto fixo;
 *   o próprio guard não contamina o usuário que ele devolve, só a chave `papeis` lida dele).
 * Ajuste de tela por papel continua livre: `{usuario.papeis.includes(Papel.X) && <Link/>}` no JSX,
 * `const secretaria = temPapel(…)` usado num texto, `return` condicionado dentro de um `.map(...)`.
 * Limite: uma recusa escondida numa função IMPORTADA de outro módulo não é vista.
 *
 * Autoteste em guard-pagina.test.ts.
 */

const GUARD = "exigirSessaoPagina";
const MODULO_GUARD = "@/server/_shared";
const ehModuloGuard = (especificador: string) => especificador === MODULO_GUARD || especificador.startsWith(MODULO_GUARD + "/");

type Declaracao = ts.Node & { name?: ts.Node };
const DECLARACOES: ((no: ts.Node) => boolean)[] = [
  ts.isVariableDeclaration, ts.isParameter, ts.isBindingElement, ts.isFunctionDeclaration, ts.isFunctionExpression,
  ts.isClassDeclaration, ts.isClassExpression, ts.isEnumDeclaration, ts.isModuleDeclaration, ts.isImportSpecifier,
  ts.isImportClause, ts.isNamespaceImport, ts.isImportEqualsDeclaration, ts.isTypeAliasDeclaration, ts.isInterfaceDeclaration,
];
/** O identificador é o nome declarado por uma declaração (variável, parâmetro, import, função…). */
const ehNomeDeclarado = (id: ts.Identifier) => DECLARACOES.some((eh) => eh(id.parent)) && (id.parent as Declaracao).name === id;

/** `await exigirSessaoPagina(...)` — devolve a chamada, ou null. */
function chamadaAguardada(expr: ts.Expression | undefined): ts.CallExpression | null {
  if (!expr || !ts.isAwaitExpression(expr)) return null;
  const chamada = expr.expression;
  return ts.isCallExpression(chamada) && ts.isIdentifier(chamada.expression) && chamada.expression.text === GUARD ? chamada : null;
}

/** A primeira instrução é `await guard(...)` ou `const x = await guard(...)` (uma declaração só)? */
function guardDaInstrucao(instrucao: ts.Statement | undefined): ts.CallExpression | null {
  if (!instrucao) return null;
  if (ts.isExpressionStatement(instrucao)) return chamadaAguardada(instrucao.expression);
  if (ts.isVariableStatement(instrucao) && instrucao.declarationList.declarations.length === 1) {
    return chamadaAguardada(instrucao.declarationList.declarations[0].initializer);
  }
  return null;
}

const CHAMADAS_QUE_RECUSAM = new Set(["redirect", "permanentRedirect", "notFound", "forbidden", "unauthorized"]);
const IDENTIFICADORES_QUE_RECUSAM = new Set(["AcessoNegado", "exigirPapel", "exigirSessaoComPapel", "exigirSessao"]);
const IMPORTS_PERMITIDOS_DO_GUARD = new Set([GUARD, "temPapel"]);
const LEITURA_DE_PAPEL = ["papeis", "temPapel", "Papel"];
const OPERADORES_LOGICOS = new Set<ts.SyntaxKind>([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken]);
/** Os operadores da recusa branda em texto, para o autoteste comparar com a cópia literal dele (R3 da #143, B9). */
export const OPERADORES_LOGICOS_DA_RECUSA = Array.from(OPERADORES_LOGICOS, (operador) => ts.tokenToString(operador));

/** Tira parênteses e envoltórios de tipo (`as`, `satisfies`, `!`), que não mudam o valor. (`<T>x` não existe em TSX.) */
const semEnvoltorio = (expr: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isNonNullExpression(expr)
    ? semEnvoltorio(expr.expression) : expr;
const nomesDoBinding = (nome: ts.BindingName): string[] =>
  ts.isIdentifier(nome) ? [nome.text]
    : (nome.elements as readonly ts.ArrayBindingElement[]).flatMap((e) => (ts.isOmittedExpression(e) ? [] : nomesDoBinding(e.name)));
/** Texto da chave (`papeis`, `"papeis"`, `["papeis"]`); undefined quando é calculada (`[k]`). */
const textoDaChave = (chave: ts.PropertyName): string | undefined =>
  ts.isComputedPropertyName(chave) ? (ts.isStringLiteralLike(chave.expression) ? chave.expression.text : undefined) : chave.text;
const ehAtribuicao = (tipo: ts.SyntaxKind) => tipo >= ts.SyntaxKind.FirstAssignment && tipo <= ts.SyntaxKind.LastAssignment;

/** Destino de uma atribuição: cada nome atribuído, e a chave que o preenche na desestruturação (`({ papeis: p } = x)`). */
type Destino = { nome: string; chave?: ts.PropertyName };
function destinosDaAtribuicao(alvo: ts.Expression): Destino[] {
  const expr = semEnvoltorio(alvo);
  if (ts.isIdentifier(expr)) return [{ nome: expr.text }];
  // Valor padrão na desestruturação: `[p = []] = x`.
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) return destinosDaAtribuicao(expr.left);
  if (ts.isArrayLiteralExpression(expr)) return expr.elements.flatMap((e): Destino[] => destinosDaAtribuicao(ts.isSpreadElement(e) ? e.expression : e));
  if (ts.isObjectLiteralExpression(expr)) {
    return expr.properties.flatMap((p): Destino[] => {
      if (ts.isShorthandPropertyAssignment(p)) return [{ nome: p.name.text }];
      if (ts.isSpreadAssignment(p)) return destinosDaAtribuicao(p.expression);
      if (!ts.isPropertyAssignment(p)) return [];
      const chave = p.name;
      const destinos = destinosDaAtribuicao(p.initializer);
      return [...destinos, ...destinos.map((d): Destino => ({ nome: d.nome, chave }))];
    });
  }
  return [];
}

/**
 * Carga de módulo fora do `import` estático: `import("m")`, `require("m")` ou `import x = require("m")`.
 * Devolve o especificador; null quando ele não é literal; undefined quando o nó não carrega módulo.
 */
function moduloCarregado(no: ts.Node): string | null | undefined {
  let especificador: ts.Expression | undefined;
  if (ts.isExternalModuleReference(no)) especificador = no.expression;
  else if (ts.isCallExpression(no)) {
    const alvo = semEnvoltorio(no.expression);
    if (alvo.kind !== ts.SyntaxKind.ImportKeyword && !(ts.isIdentifier(alvo) && alvo.text === "require")) return undefined;
    especificador = no.arguments[0];
  } else return undefined;
  return especificador && ts.isStringLiteralLike(especificador) ? especificador.text : null;
}

/** Componente de topo: função declarada no topo do arquivo, ou arrow/function atribuída a uma const de topo. */
function ehComponenteDeTopo(fn: ts.Node, sf: ts.SourceFile): boolean {
  if (ts.isFunctionDeclaration(fn)) return fn.parent === sf;
  if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return false;
  const declaracao = fn.parent;
  return ts.isVariableDeclaration(declaracao) && declaracao.initializer === fn
    && ts.isVariableDeclarationList(declaracao.parent) && ts.isVariableStatement(declaracao.parent.parent) && declaracao.parent.parent.parent === sf;
}

/** B6: depois do guard, nada recusa — nem duro (throw, redirect…) nem brando (return sob condição de papel). */
function verificarRecusas(sf: ts.SourceFile, instrucaoGuard: ts.Statement, falha: (motivo: string) => never) {
  const linha = (no: ts.Node) => sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1;

  // Imports que recusam ou trazem ferramenta de recusa.
  for (const instrucao of sf.statements) {
    if (!ts.isImportDeclaration(instrucao) || !ts.isStringLiteral(instrucao.moduleSpecifier)) continue;
    const modulo = instrucao.moduleSpecifier.text;
    if (modulo === "next/navigation") falha(`import de next/navigation (linha ${linha(instrucao)}) — a página das abas não recusa por conta própria; o guard decide`);
    const nomeados = instrucao.importClause?.namedBindings;
    if (ehModuloGuard(modulo) && nomeados && ts.isNamedImports(nomeados)) {
      for (const e of nomeados.elements) {
        const importado = (e.propertyName ?? e.name).text;
        if (!IMPORTS_PERMITIDOS_DO_GUARD.has(importado)) falha(`${importado} importado de ${modulo} — só ${GUARD} e temPapel`);
      }
    }
  }

  // Nomes que leem papel (ponto fixo): variáveis inicializadas, atribuídas ou desestruturadas a partir de
  // papel e as props/chaves que recebem papel (`<Conteudo podeVer={u.papeis…} />` contamina o parâmetro
  // `podeVer` do componente, pelo nome). O guard não contamina o usuário que ele devolve; a chave `papeis`
  // lida dele, sim (`const { papeis: p } = sessao`, R3 da #143, E15).
  const lePapel = new Set(LEITURA_DE_PAPEL);
  // Chave de objeto (`{ papeis: { has: … } }` num filtro do Prisma) e nome de atributo JSX não leem papel.
  const ehChave = (id: ts.Identifier) => (ts.isPropertyAssignment(id.parent) || ts.isJsxAttribute(id.parent)) && id.parent.name === id;
  // Acesso por string (`sessao["papeis"]`) lê a chave como `sessao.papeis`.
  const ehChaveDeAcesso = (texto: ts.StringLiteralLike) => ts.isElementAccessExpression(texto.parent) && texto.parent.argumentExpression === texto;
  const citaPapel = (no: ts.Node): boolean =>
    (ts.isIdentifier(no) && lePapel.has(no.text) && !ehChave(no))
    || (ts.isStringLiteralLike(no) && lePapel.has(no.text) && ehChaveDeAcesso(no))
    || !!ts.forEachChild(no, (filho) => citaPapel(filho) || undefined);
  const fontes: { nomes: string[]; le: () => boolean }[] = [];
  const porValor = (nomes: string[], valor: ts.Node) => { fontes.push({ nomes, le: () => citaPapel(valor) }); };
  // Desestruturação: `p` em `{ papeis: p }` lê o que a chave lê. Chave calculada (`{ [k]: p }`) lê papel, por cautela.
  const porChave = (nomes: string[], chave: ts.PropertyName) => {
    const texto = textoDaChave(chave);
    fontes.push({ nomes, le: () => texto === undefined || lePapel.has(texto) });
  };
  const coletar = (no: ts.Node) => {
    if (ts.isVariableDeclaration(no) && no.initializer && !(ts.isVariableStatement(instrucaoGuard) && no.parent.parent === instrucaoGuard)) {
      porValor(nomesDoBinding(no.name), no.initializer);
    }
    if (ts.isBindingElement(no) && no.propertyName) porChave(nomesDoBinding(no.name), no.propertyName);
    if (ts.isBinaryExpression(no) && ehAtribuicao(no.operatorToken.kind)) {
      for (const destino of destinosDaAtribuicao(no.left)) {
        porValor([destino.nome], no.right);
        if (destino.chave) porChave([destino.nome], destino.chave);
      }
    }
    if (ts.isJsxAttribute(no) && ts.isIdentifier(no.name) && no.initializer && ts.isJsxExpression(no.initializer) && no.initializer.expression) {
      porValor([no.name.text], no.initializer.expression);
    }
    if (ts.isPropertyAssignment(no) && ts.isIdentifier(no.name)) porValor([no.name.text], no.initializer);
    ts.forEachChild(no, coletar);
  };
  coletar(sf);
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const { nomes, le } of fontes) {
      if (!le()) continue;
      for (const nome of nomes) if (!lePapel.has(nome)) { lePapel.add(nome); mudou = true; }
    }
  }

  const visitar = (no: ts.Node) => {
    // Recusa dura, em qualquer ponto do arquivo.
    if (ts.isThrowStatement(no)) falha(`throw na linha ${linha(no)} — a página das abas não recusa depois do guard`);
    if (moduloCarregado(no) === "next/navigation") {
      falha(`next/navigation carregado dinamicamente (linha ${linha(no)}) — a página das abas não recusa por conta própria; o guard decide`);
    }
    if (ts.isCallExpression(no)) {
      const alvo = semEnvoltorio(no.expression);
      if (ts.isIdentifier(alvo) && CHAMADAS_QUE_RECUSAM.has(alvo.text)) falha(`${alvo.text}(...) na linha ${linha(no)} — a página das abas não recusa depois do guard`);
      if (ts.isPropertyAccessExpression(alvo) && alvo.name.text === "reject" && ts.isIdentifier(alvo.expression) && alvo.expression.text === "Promise") {
        falha(`Promise.reject na linha ${linha(no)} — a página das abas não recusa depois do guard`);
      }
    }
    if (ts.isIdentifier(no) && IDENTIFICADORES_QUE_RECUSAM.has(no.text)) falha(`${no.text} na linha ${linha(no)} — a página das abas não recusa depois do guard`);

    // Recusa branda: return de componente de topo sob condição que lê papel.
    if (ts.isReturnStatement(no)) {
      let fn: ts.Node = no.parent;
      while (!ts.isFunctionLike(fn) && !ts.isSourceFile(fn)) fn = fn.parent;
      if (ehComponenteDeTopo(fn, sf)) {
        const expr = no.expression && semEnvoltorio(no.expression);
        const condicaoDoRetorno = expr && (ts.isConditionalExpression(expr) ? expr.condition
          : ts.isBinaryExpression(expr) && OPERADORES_LOGICOS.has(expr.operatorToken.kind) ? expr.left
            : undefined);
        if (condicaoDoRetorno && citaPapel(condicaoDoRetorno)) falha(`return condicionado a papel na linha ${linha(no)} — recusa branda depois do guard`);
        for (let filho: ts.Node = no, pai = no.parent; pai !== fn; filho = pai, pai = pai.parent) {
          const condicao = ts.isIfStatement(pai) && filho !== pai.expression ? pai.expression
            : ts.isSwitchStatement(pai) && filho !== pai.expression ? pai.expression
              : ts.isCaseClause(pai) && filho !== pai.expression ? pai.expression
                : (ts.isWhileStatement(pai) || ts.isDoStatement(pai)) && filho !== pai.expression ? pai.expression
                  : ts.isForStatement(pai) && filho === pai.statement ? pai.condition
                    : (ts.isForInStatement(pai) || ts.isForOfStatement(pai)) && filho === pai.statement ? pai.expression
                      : undefined;
          if (condicao && citaPapel(condicao)) falha(`return sob condição de papel na linha ${linha(no)} — recusa branda depois do guard`);
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);
}

export function papeisDoGuardFonte(fonte: string, origem: string): string[] {
  const sf = ts.createSourceFile("pagina.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const falha = (motivo: string): never => { throw new Error(`${origem}: ${motivo}`); };

  // 1. Imports: o guard sem alias, só por import nomeado; Papel sem alias, de @prisma/client.
  let importsDoGuard = 0;
  let importsDePapel = 0;
  for (const instrucao of sf.statements) {
    if (!ts.isImportDeclaration(instrucao) || !ts.isStringLiteral(instrucao.moduleSpecifier)) continue;
    const modulo = instrucao.moduleSpecifier.text;
    const clausula = instrucao.importClause;
    if (ehModuloGuard(modulo) && clausula && (clausula.name || (clausula.namedBindings && ts.isNamespaceImport(clausula.namedBindings)))) {
      falha(`import default ou "* as" de ${modulo} — importe { ${GUARD} } pelo nome`);
    }
    if (!clausula?.namedBindings || !ts.isNamedImports(clausula.namedBindings)) continue;
    for (const especificador of clausula.namedBindings.elements) {
      const importado = (especificador.propertyName ?? especificador.name).text;
      if (importado === GUARD) {
        if (especificador.propertyName) falha(`${GUARD} importado com alias (${especificador.name.text})`);
        if (ehModuloGuard(modulo)) importsDoGuard++;
      }
      if (importado === "Papel" && modulo === "@prisma/client") {
        if (especificador.propertyName) falha(`Papel importado com alias (${especificador.name.text}) — use import { Papel } from "@prisma/client"`);
        if (clausula.isTypeOnly || especificador.isTypeOnly) falha("Papel importado só como tipo");
        importsDePapel++;
      }
    }
  }
  if (importsDePapel !== 1) falha(`Papel precisa vir de um único import { Papel } from "@prisma/client" (achados: ${importsDePapel})`);

  // 2. O guard: primeira instrução do corpo da função export default.
  const padrao = sf.statements.find(
    (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && !!s.body
      && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
  );
  if (!padrao?.body) falha("sem export default function com corpo");
  const guard = guardDaInstrucao(padrao!.body!.statements[0]);

  // 3. Nenhuma outra ocorrência: do guard (fora do import e do guard) nem de declaração chamada Papel.
  //    Carregar o módulo do guard por import()/require também falha — a chamada viria com outro nome, ou
  //    sem nome nenhum (`m["exigirSessaoPagina"](…)`, R3 da #143, B7); e import()/require sem literal, sempre.
  const visitar = (no: ts.Node) => {
    if (ts.isIdentifier(no) && no.text === GUARD) {
      const doImport = ts.isImportSpecifier(no.parent) && no.parent.name === no && !no.parent.propertyName;
      const doGuard = guard !== null && no === guard.expression;
      if (!doImport && !doGuard) {
        const { line } = sf.getLineAndCharacterOfPosition(no.getStart(sf));
        falha(guard
          ? `${GUARD} fora do guard da página (linha ${line + 1}) — só uma chamada, a primeira instrução da função export default`
          : `sem guard de topo: "await ${GUARD}(...)" precisa ser a primeira instrução da função export default (achado na linha ${line + 1})`);
      }
    }
    if (ts.isIdentifier(no) && no.text === "Papel" && ehNomeDeclarado(no)) {
      const canonico = ts.isImportSpecifier(no.parent) && !no.parent.propertyName
        && ts.isStringLiteral(no.parent.parent.parent.parent.moduleSpecifier)
        && no.parent.parent.parent.parent.moduleSpecifier.text === "@prisma/client";
      if (!canonico) falha("declaração local chamada Papel — ela sombrearia o enum de @prisma/client");
    }
    const carregado = moduloCarregado(no);
    if (carregado === null) {
      const { line } = sf.getLineAndCharacterOfPosition(no.getStart(sf));
      falha(`import()/require com especificador não literal (linha ${line + 1}) — não dá para saber qual módulo vem`);
    }
    if (carregado !== undefined && ehModuloGuard(carregado)) falha(`${MODULO_GUARD} carregado dinamicamente — importe { ${GUARD} } pelo nome`);
    ts.forEachChild(no, visitar);
  };
  visitar(sf);

  if (importsDoGuard !== 1) falha(`${GUARD} precisa vir de um único import nomeado de ${MODULO_GUARD} (achados: ${importsDoGuard})`);
  if (!guard) falha(`sem exigirSessaoPagina(...) como primeira instrução da função export default`);

  // 4. O guard é a única recusa (B6).
  verificarRecusas(sf, padrao!.body!.statements[0], falha);

  // 5. Papéis: só Papel.X literais.
  if (guard!.arguments.length === 0) falha("exigirSessaoPagina() sem papéis — use Papel.X");
  const papeis = guard!.arguments.map((arg) => {
    if (ts.isPropertyAccessExpression(arg) && !arg.questionDotToken && ts.isIdentifier(arg.expression) && arg.expression.text === "Papel" && ts.isIdentifier(arg.name)) {
      return arg.name.text;
    }
    return falha(`exigirSessaoPagina com papéis não literais (${arg.getText(sf)}) — use Papel.X`);
  });
  return papeis.sort();
}

export const papeisDoGuardArquivo = (arquivo: string) => papeisDoGuardFonte(readFileSync(arquivo, "utf-8"), arquivo);
