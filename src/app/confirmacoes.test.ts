import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ACOES_CONFIRMADAS, EXCECOES_CONFIRMACAO, IMPORTS_FORA_DO_SRC } from "./confirmacoes-mapa";

// Trava do ConfirmarAcao (docs/42-auditoria-frontend-ux.md, E1 e padrão 8; docs/43 §6 item 1). As ações
// irreversíveis ou de efeito externo da lista fechada (src/app/confirmacoes-mapa.ts) só disparam dentro da
// prop `acao` de um <ConfirmarAcao> — o diálogo que diz a consequência e exige a decisão. Pelo AST, falha
// fechada:
// - toda referência à action no arquivo (import com outro nome, chamada, referência solta, propriedade
//   abreviada, export) conta; só a que está na prop `acao` de um <ConfirmarAcao> IMPORTADO de
//   "@/components/ConfirmarAcao" (também com outro nome) passa. Função intermediária, outro componente com
//   prop `acao`, outra prop do próprio ConfirmarAcao ou um ConfirmarAcao declarado no arquivo não passam;
// - posição de tipo (`typeof acao`) não executa nada e fica de fora;
// - import do módulo inteiro (namespace), import dinâmico ou require do módulo da action, e spread num
//   <ConfirmarAcao>, não são verificáveis: acusam;
// - a exceção (o mesmo salvar sem efeito irreversível) é ancorada no trecho EXATO da chamada e casa com
//   exatamente uma; ao menos uma referência de cada action continua dentro de uma confirmação;
// - nenhum outro arquivo do src (telas, src/lib, src/test, src/server) importa ou reexporta a action — caminho
//   relativo e `@/` resolvidos para o mesmo módulo —, e no módulo da action ela só aparece na própria declaração
//   (sem wrapper nem alias); nenhum window.confirm no src, também por alias, cadeia do global ou reflexão
//   (R1 da #154, B1/B2);
// - a referência tem de estar no CORPO da função que é o valor da prop `acao` (nada roda no render; R2, B8);
// - a varredura lê todo código do src (.ts/.tsx/.js/…; só os `*.test.ts` ficam de fora), com o escopo léxico
//   para os nomes do global, e acusa o que ela não consegue ler: import que sai do src (fora da lista
//   fechada), eval/Function/constructor e timer com código em texto (R2, B1/B2/C6).
// As listas do mapa são comparadas a uma cópia literal aqui, e a verificação percorre a CÓPIA.

/** Cópia literal da lista fechada (arquivo, módulo, ação, achado). */
const COPIA_ACOES: { arquivo: string; modulo: string; acao: string; achado: string }[] = [
  { arquivo: "src/app/(app)/financeiro/FilaCobranca.tsx", modulo: "@/server/whatsapp/acoes", acao: "enfileirarCobrancaWhatsApp", achado: "L2014" },
  { arquivo: "src/app/(app)/financeiro/FinanceiroPainel.tsx", modulo: "@/server/financeiro/acoes", acao: "fecharMesComissoes", achado: "L2016" },
  { arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx", modulo: "@/server/matricula/desistencia-acerto-aplicacao", acao: "aplicarAcertoDesistenciaContratual", achado: "L799" },
  { arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/ReconferenciaDeltaFormularios.tsx", modulo: "@/server/matricula/desistencia-reconferencia-delta", acao: "aplicarReconferenciaDeltaDesistencia", achado: "L799" },
  { arquivo: "src/app/(app)/matriculas/[id]/fechamentos-horas/EmitirFechamento.tsx", modulo: "@/server/matricula/fechamento-horas-emissao", acao: "emitirFechamentoHoras", achado: "L906" },
  { arquivo: "src/app/(app)/empresas/[id]/FichaEmpresa.tsx", modulo: "@/server/empresas/acoes", acao: "pagarFaturaB2B", achado: "L2281" },
  { arquivo: "src/app/(app)/empresas/[id]/FichaEmpresa.tsx", modulo: "@/server/empresas/acoes", acao: "cancelarFaturaB2B", achado: "L2281" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx", modulo: "@/server/whatsapp/acoes", acao: "acionarKillSwitchRegua", achado: "L2516" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx", modulo: "@/server/whatsapp/acoes", acao: "salvarPoliticaRegua", achado: "L2517" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx", modulo: "@/server/comercial/acoes", acao: "salvarConfigComercial", achado: "L2517" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx", modulo: "@/server/comercial/acoes", acao: "salvarReguaComercial", achado: "L2517" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx", modulo: "@/server/whatsapp/acoes", acao: "salvarTemplateWhatsApp", achado: "L2518" },
];

/** Cópia literal das exceções (arquivo, trecho exato). */
const COPIA_EXCECOES: { arquivo: string; trecho: string }[] = [
  { arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx", trecho: "salvarPoliticaRegua(dadosPolitica())" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/ComercialPainel.tsx", trecho: "salvarConfigComercial(dadosComerciais())" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx", trecho: "salvarReguaComercial(dadosRegua())" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx", trecho: "salvarTemplateWhatsApp(dados)" },
];

/** Cópia literal dos imports que saem do src (arquivo, especificador exato). */
const COPIA_IMPORTS_FORA_DO_SRC: { arquivo: string; especificador: string }[] = [
  { arquivo: "src/test/setup-integracao.ts", especificador: "../../vitest.integration.config" },
];

const MODULO_DO_COMPONENTE = "@/components/ConfirmarAcao";
const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

export type VerificacaoConfirmacao = {
  /** Trechos (espaços normalizados) de referências à action FORA da prop `acao` de um ConfirmarAcao. */
  fora: string[];
  /** Quantas referências de cada action estão dentro de uma confirmação. */
  naConfirmacao: Record<string, number>;
  /** O que não dá para verificar (falha fechada). */
  problemas: string[];
};

/** Nó em posição de tipo (`typeof x`, anotação): não executa nada. */
function emPosicaoDeTipo(n: ts.Node): boolean {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isTypeNode(p)) return true;
    if (ts.isStatement(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

/** Texto que localiza a referência: a chamada inteira quando ela é a função chamada; senão a referência solta. */
function trechoDaReferencia(id: ts.Identifier, sf: ts.SourceFile): string {
  const pai = id.parent;
  if (ts.isCallExpression(pai) && pai.expression === id) return normaliza(pai.getText(sf));
  return `${id.text} (referência sem chamada): ${normaliza(pai.getText(sf)).slice(0, 120)}`;
}

/**
 * Caminho do módulo a partir da raiz do repositório, sem extensão nem `/index`: `@/x` vira `src/x`; um caminho
 * relativo é resolvido contra o arquivo que importa (R1 da #154, B1: `../../../server/whatsapp/acoes` é o mesmo
 * módulo que `@/server/whatsapp/acoes`). Pacote fica como está.
 */
export function resolverModulo(arquivo: string, especificador: string): string {
  let caminho: string;
  if (especificador.startsWith("@/")) caminho = posix.normalize(`src/${especificador.slice(2)}`);
  else if (especificador.startsWith(".")) caminho = posix.normalize(posix.join(posix.dirname(arquivo), especificador));
  else return especificador;
  return caminho.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "").replace(/\/index$/, "");
}

/** `import("…")` ou `require("…")`: o especificador literal, ou null quando o caminho é calculado. */
function cargaDinamica(n: ts.Node): { especificador: string | null } | null {
  if (!ts.isCallExpression(n)) return null;
  const ehCarga = n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === "require");
  if (!ehCarga) return null;
  const arg = n.arguments[0];
  return { especificador: arg && ts.isStringLiteralLike(arg) ? arg.text : null };
}

/**
 * Verifica um fonte TSX contra as actions de um arquivo da lista (`acoes`: nome exportado → módulo).
 * Cada referência a uma action importada (por qualquer nome local, por caminho relativo ou com `@/`) é "dentro"
 * só quando o atributo JSX mais próximo acima dela é `acao` de um elemento cuja tag é um nome importado de
 * "@/components/ConfirmarAcao" como ConfirmarAcao. `arquivo` resolve os caminhos relativos.
 */
export function verificarConfirmacoes(fonte: string, acoes: Record<string, string>, arquivo = "src/app/(app)/x/T.tsx"): VerificacaoConfirmacao {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const problemas: string[] = [];
  const nomesConfirmar = new Set<string>();
  const local = new Map<string, string>(); // nome local → action
  // Map (não objeto): `toString`/`constructor` como nome importado não casam com o protótipo.
  const moduloDaAcao = new Map(Object.entries(acoes).map(([acao, modulo]): [string, string] => [acao, resolverModulo(arquivo, modulo)]));
  const modulos = new Set(moduloDaAcao.values());
  const componente = resolverModulo(arquivo, MODULO_DO_COMPONENTE);
  const declaracoesDeImport = new Set<ts.Node>();

  for (const s of sf.statements) {
    // export { acao } from "…" / export * from "…": a action sai do arquivo sem passar por referência local.
    if (ts.isExportDeclaration(s) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier) && !s.isTypeOnly
      && modulos.has(resolverModulo(arquivo, s.moduleSpecifier.text))) {
      const escrito = s.moduleSpecifier.text;
      if (!s.exportClause || ts.isNamespaceExport(s.exportClause)) problemas.push(`reexporta o módulo inteiro de ${escrito}: chamadas não verificáveis`);
      else for (const e of s.exportClause.elements) {
        const exportado = (e.propertyName ?? e.name).text;
        if (!e.isTypeOnly && moduloDaAcao.get(exportado) === resolverModulo(arquivo, escrito)) problemas.push(`reexporta "${exportado}" de ${escrito}`);
      }
      continue;
    }
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    const escrito = s.moduleSpecifier.text;
    const modulo = resolverModulo(arquivo, escrito);
    const clausula = s.importClause;
    if (!clausula || clausula.isTypeOnly) continue;
    const ligacoes = clausula.namedBindings;
    if (ligacoes && ts.isNamespaceImport(ligacoes) && modulos.has(modulo)) problemas.push(`import do módulo inteiro de ${escrito} (${ligacoes.name.text}): chamadas não verificáveis`);
    if (!ligacoes || !ts.isNamedImports(ligacoes)) continue;
    for (const e of ligacoes.elements) {
      if (e.isTypeOnly) continue;
      const exportado = (e.propertyName ?? e.name).text;
      if (modulo === componente && exportado === "ConfirmarAcao") nomesConfirmar.add(e.name.text);
      if (moduloDaAcao.get(exportado) === modulo) {
        local.set(e.name.text, exportado);
        declaracoesDeImport.add(e.name);
        if (e.propertyName) declaracoesDeImport.add(e.propertyName);
      }
    }
  }
  for (const acao of Object.keys(acoes)) {
    if (![...local.values()].includes(acao)) problemas.push(`a ação "${acao}" não é importada de ${acoes[acao]} (lista desatualizada?)`);
  }

  const ehConfirmar = (tag: ts.JsxTagNameExpression) => ts.isIdentifier(tag) && nomesConfirmar.has(tag.text);
  const fora: string[] = [];
  const naConfirmacao: Record<string, number> = Object.fromEntries(Object.keys(acoes).map((a: string): [string, number] => [a, 0]));

  const visitar = (n: ts.Node) => {
    // require("…") e import("…") do módulo de uma action (ou com caminho calculado): a referência some do AST.
    const carga = cargaDinamica(n);
    if (carga && (carga.especificador === null || modulos.has(resolverModulo(arquivo, carga.especificador)))) {
      problemas.push(`carga dinâmica de ${carga.especificador ?? "caminho calculado"}: chamadas não verificáveis`);
    }
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ehConfirmar(n.tagName) && n.attributes.properties.some(ts.isJsxSpreadAttribute)) {
      problemas.push(`<${n.tagName.getText(sf)}> com spread: props não verificáveis`);
    }
    if (ts.isIdentifier(n) && local.has(n.text) && !declaracoesDeImport.has(n) && !emPosicaoDeTipo(n)
      && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
      && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)
      && !(ts.isJsxAttribute(n.parent) && n.parent.name === n)) {
      const acao = local.get(n.text)!;
      let atributo: ts.JsxAttribute | undefined;
      for (let p: ts.Node | undefined = n.parent; p && !atributo; p = p.parent) if (ts.isJsxAttribute(p)) atributo = p;
      const elemento = atributo?.parent.parent;
      // A ação só pode rodar quando a confirmação chama `acao` (R2 da #154, B8): a referência tem de estar no
      // CORPO da função que é o próprio valor da prop. `acao={((p) => () => p)(acao(id))}`, um parâmetro com
      // valor padrão ou `acao={acao}` executariam (ou entregariam) a action no render, antes de confirmar.
      const valor = atributo?.initializer && ts.isJsxExpression(atributo.initializer) && atributo.initializer.expression
        ? semEmbrulho(atributo.initializer.expression) : undefined;
      const funcao = valor && (ts.isArrowFunction(valor) || ts.isFunctionExpression(valor)) ? valor : undefined;
      const dentro = !!atributo && atributo.name.getText(sf) === "acao" && !!elemento && ehConfirmar(elemento.tagName)
        && !!funcao && descendeDe(n, funcao.body);
      if (dentro) naConfirmacao[acao]++;
      else fora.push(trechoDaReferencia(n, sf));
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { fora, naConfirmacao, problemas };
}

/** `n` está dentro de `raiz` (ou é ela)? */
function descendeDe(n: ts.Node, raiz: ts.Node): boolean {
  for (let p: ts.Node | undefined = n; p; p = p.parent) if (p === raiz) return true;
  return false;
}

/** Confere as referências fora da confirmação contra as exceções: cada exceção casa com exatamente uma. */
export function conferirExcecoesConfirmacao(fora: string[], trechos: string[]): { semExcecao: string[]; soltas: string[] } {
  const restantes = [...fora];
  const soltas: string[] = [];
  for (const t of trechos) {
    const casos = restantes.filter((f: string) => f === t).length;
    if (casos !== 1) { soltas.push(`${t} (casa com ${casos})`); continue; }
    restantes.splice(restantes.indexOf(t), 1);
  }
  return { semExcecao: restantes, soltas };
}

/** Nomes ligados por um padrão de declaração (`a`, `{ a, b: c }`, `[d, ...e]`). */
function nomesDoPadrao(nome: ts.BindingName): string[] {
  if (ts.isIdentifier(nome)) return [nome.text];
  return (nome.elements as ts.NodeArray<ts.ArrayBindingElement>).flatMap((el: ts.ArrayBindingElement) => (ts.isOmittedExpression(el) ? [] : nomesDoPadrao(el.name)));
}

const GLOBAIS = new Set(["window", "globalThis", "self", "top", "parent", "frames"]);
/** Propriedades que devolvem uma janela a partir de QUALQUER objeto (`document.defaultView`, `iframe.contentWindow`). */
const JANELA_DE_QUALQUER = new Set(["defaultView", "opener", "contentWindow"]);
const COMPARACOES = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword]);
const ehEmbrulho = (n: ts.Node): n is ts.ParenthesizedExpression | ts.AsExpression | ts.NonNullExpression | ts.SatisfiesExpression | ts.TypeAssertion =>
  ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n);
const semEmbrulho = (e: ts.Expression): ts.Expression => (ehEmbrulho(e) ? semEmbrulho(e.expression) : e);

/**
 * A declaração de um nome pelo ESCOPO léxico (R2 da #154, B2/G3): sobe do uso até o bloco, a função
 * (parâmetros), o `catch`, o laço ou o arquivo que o declaram. Devolve a `VariableDeclaration` de um nome
 * simples (`const w = …`), "outra" para parâmetro, desestruturação, função, classe, enum ou import, e null
 * quando nada no arquivo declara o nome (aí ele é o global). Um parâmetro `window` numa função não muda o
 * `window` das outras.
 */
function declaracaoNoEscopo(id: ts.Identifier): ts.VariableDeclaration | "outra" | null {
  const nome = id.text;
  const daLista = (d: ts.VariableDeclaration): ts.VariableDeclaration | "outra" | null =>
    (nomesDoPadrao(d.name).includes(nome) ? (ts.isIdentifier(d.name) ? d : "outra") : null);
  for (let p: ts.Node | undefined = id.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p)) {
      if (p.parameters.some((par: ts.ParameterDeclaration) => nomesDoPadrao(par.name).includes(nome))) return "outra";
      if ((ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) && p.name?.text === nome) return "outra";
    }
    if (ts.isCatchClause(p) && p.variableDeclaration && nomesDoPadrao(p.variableDeclaration.name).includes(nome)) return "outra";
    if ((ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)) && p.initializer && ts.isVariableDeclarationList(p.initializer)) {
      for (const d of p.initializer.declarations) { const r = daLista(d); if (r) return r; }
    }
    const instrucoes = ts.isSourceFile(p) || ts.isBlock(p) || ts.isModuleBlock(p) || ts.isCaseClause(p) || ts.isDefaultClause(p) ? p.statements : undefined;
    if (!instrucoes) continue;
    for (const s of instrucoes) {
      if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) { const r = daLista(d); if (r) return r; }
      if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isEnumDeclaration(s)) && s.name?.text === nome) return "outra";
      if (ts.isImportDeclaration(s) && s.importClause) {
        const c = s.importClause, b = c.namedBindings;
        if (c.name?.text === nome) return "outra";
        if (b && ts.isNamespaceImport(b) && b.name.text === nome) return "outra";
        if (b && ts.isNamedImports(b) && b.elements.some((e: ts.ImportSpecifier) => e.name.text === nome)) return "outra";
      }
    }
  }
  return null;
}

/**
 * window.confirm (e as formas que escondem o nome) num fonte: a confirmação do app é o <ConfirmarAcao>.
 * Falha fechada (R1/R2 da #154, B2):
 * - todo identificador `confirm` acusa — chamada solta, `qualquer.confirm` (de QUALQUER objeto), referência
 *   guardada, desestruturação —, menos o nome de uma chave declarada (`{ confirm: true }`, membro de tipo ou de
 *   classe, atributo JSX);
 * - todo texto literal "confirm" acusa (`window["confirm"]`, `Reflect.get(window, "confirm")`);
 * - a janela — o global (`window`, `globalThis`, `self`, `top`, `parent`, `frames`, quando o ESCOPO não os declara),
 *   as cadeias (`window.window`), `x.defaultView`/`x.opener`/`x.contentWindow` de qualquer objeto, o resultado de
 *   `window.open(…)` e os aliases de qualquer um deles (pelo escopo) — só aparece como dono de propriedade nomeada
 *   ou de chave literal, em `typeof`, comparação, `in`, condição (`if`, ternário, `!`), instrução solta, `void`, ou
 *   como valor de um alias; qualquer outro uso (argumento, chave calculada, espalhamento, desestruturação) acusa.
 */
export function confirmacoesNativas(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const aliases = new Set<ts.VariableDeclaration>();
  const ehJanela = (e: ts.Expression): boolean => {
    const x = semEmbrulho(e);
    if (ts.isIdentifier(x)) {
      const d = declaracaoNoEscopo(x);
      return d === null ? GLOBAIS.has(x.text) : d !== "outra" && aliases.has(d);
    }
    if (ts.isPropertyAccessExpression(x)) return JANELA_DE_QUALQUER.has(x.name.text) || (GLOBAIS.has(x.name.text) && ehJanela(x.expression));
    if (ts.isCallExpression(x)) {
      const f = semEmbrulho(x.expression);
      return ts.isPropertyAccessExpression(f) && f.name.text === "open" && ehJanela(f.expression);
    }
    return false;
  };
  // Aliases em ponto fixo: `const w = window`, `const v = w.self`, `const p = window.open(…)`.
  for (let mudou = true; mudou;) {
    mudou = false;
    const procurar = (n: ts.Node) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !aliases.has(n) && ehJanela(n.initializer)) { aliases.add(n); mudou = true; }
      ts.forEachChild(n, procurar);
    };
    procurar(sf);
  }
  /** Uso permitido de uma expressão que É a janela. */
  const usoPermitido = (e: ts.Expression): boolean => {
    let filho: ts.Node = e;
    let p: ts.Node = e.parent;
    while (ehEmbrulho(p)) { filho = p; p = p.parent; }
    if (ts.isPropertyAccessExpression(p) && p.expression === filho) return true; // `.nome`: o `.confirm` acusa pelo nome
    if (ts.isElementAccessExpression(p) && p.expression === filho) return ts.isStringLiteralLike(p.argumentExpression); // "confirm" acusa pelo texto
    if (ts.isTypeOfExpression(p) || ts.isVoidExpression(p) || ts.isExpressionStatement(p)) return true;
    if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) return true;
    if ((ts.isConditionalExpression(p) || ts.isIfStatement(p)) && (ts.isIfStatement(p) ? p.expression : p.condition) === filho) return true;
    if (ts.isBinaryExpression(p) && COMPARACOES.has(p.operatorToken.kind)) return true;
    return ts.isVariableDeclaration(p) && p.initializer === filho && ts.isIdentifier(p.name); // alias, seguido acima
  };
  const candidato = (n: ts.Node): n is ts.Expression =>
    (ts.isIdentifier(n) && ehReferencia(n))
    || (ts.isPropertyAccessExpression(n) && (GLOBAIS.has(n.name.text) || JANELA_DE_QUALQUER.has(n.name.text)))
    || ts.isCallExpression(n);
  const achados: string[] = [];
  const registrar = (n: ts.Node) => achados.push(normaliza(n.getText(sf)).slice(0, 80));
  const visitar = (n: ts.Node) => {
    if (ts.isIdentifier(n) && n.text === "confirm") {
      const p = n.parent;
      const nomeDeChave =
        ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodSignature(p) || ts.isPropertyDeclaration(p)) && p.name === n)
        || (ts.isJsxAttribute(p) && p.name === n);
      if (!nomeDeChave) registrar(p);
    }
    if (ts.isStringLiteralLike(n) && n.text === "confirm") registrar(n.parent);
    // A janela como valor: só a expressão inteira conta (o `window` de `window.window` é dono de propriedade).
    if (!emPosicaoDeTipo(n) && candidato(n) && ehJanela(n) && !usoPermitido(n)) registrar(n.parent);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Identificador em posição de valor (não nome de propriedade, de chave, de declaração nem de atributo). */
function ehReferencia(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isMethodSignature(p)) && p.name === id) return false;
  if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p)) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if (ts.isJsxAttribute(p) || ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return false;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return false;
  return true;
}

/**
 * Importações de uma action da lista neste fonte (por nome, com outro nome, o módulo inteiro, reexportação ou
 * carga dinâmica), com os caminhos resolvidos contra `arquivo` (relativo e `@/` são o mesmo módulo). Carga
 * dinâmica com caminho calculado também acusa: não dá para saber o que carrega.
 */
export function importacoesForaDaLista(fonte: string, acoes: { modulo: string; acao: string }[], arquivo = "src/app/(app)/x/T.tsx"): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const resolvidas = acoes.map((a: { modulo: string; acao: string }) => ({ acao: a.acao, modulo: resolverModulo(arquivo, a.modulo) }));
  const modulos = new Set(resolvidas.map((a: { modulo: string; acao: string }) => a.modulo));
  const daLista = (modulo: string, exportado: string) => resolvidas.some((a: { modulo: string; acao: string }) => a.modulo === modulo && a.acao === exportado);
  const visitar = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.importClause && !n.importClause.isTypeOnly) {
      const escrito = n.moduleSpecifier.text;
      const modulo = resolverModulo(arquivo, escrito);
      const ligacoes = n.importClause.namedBindings;
      if (ligacoes && ts.isNamespaceImport(ligacoes) && modulos.has(modulo)) achados.push(`* as ${ligacoes.name.text} from ${escrito}`);
      if (ligacoes && ts.isNamedImports(ligacoes)) {
        for (const e of ligacoes.elements) {
          const exportado = (e.propertyName ?? e.name).text;
          if (!e.isTypeOnly && daLista(modulo, exportado)) achados.push(`${exportado} from ${escrito}`);
        }
      }
    }
    if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) {
      const escrito = n.moduleSpecifier.text;
      const modulo = resolverModulo(arquivo, escrito);
      if (modulos.has(modulo) && (!n.exportClause || ts.isNamespaceExport(n.exportClause))) achados.push(`export * from ${escrito}`);
      if (n.exportClause && ts.isNamedExports(n.exportClause)) {
        for (const e of n.exportClause.elements) {
          const exportado = (e.propertyName ?? e.name).text;
          if (!e.isTypeOnly && daLista(modulo, exportado)) achados.push(`export { ${exportado} } from ${escrito}`);
        }
      }
    }
    const carga = cargaDinamica(n);
    if (carga && carga.especificador === null) achados.push("carga dinâmica de caminho calculado");
    else if (carga && carga.especificador !== null && modulos.has(resolverModulo(arquivo, carga.especificador))) achados.push(`carga dinâmica de ${carga.especificador}`);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/**
 * Referências à action DENTRO do próprio módulo dela, fora da declaração `export async function acao(…)`: um
 * wrapper no mesmo arquivo (`export async function cobrarJa(id) { return acao(id); }`), um alias exportado ou um
 * `export { acao as outra }` levariam a mesma ação a uma tela sem passar pela trava de importação.
 */
export function referenciasNoModulo(fonte: string, acao: string): string[] {
  const sf = ts.createSourceFile("x.ts", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const achados: string[] = [];
  let declarada = 0;
  const visitar = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === acao) declarada++;
    if (ts.isIdentifier(n) && n.text === acao && !emPosicaoDeTipo(n)
      && !(ts.isFunctionDeclaration(n.parent) && n.parent.name === n)
      && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)
      && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
      && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) achados.push(trechoDaReferencia(n, sf));
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  if (declarada !== 1) achados.push(`"${acao}" declarada ${declarada} vez(es) como função no módulo`);
  return achados;
}

/**
 * Arquivo que a varredura lê: todo código do src (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts` —
 * o tsconfig tem `allowJs`), menos os testes que o vitest roda (os `*.test.ts` do src, vitest.config). Um
 * `cobranca.test.apoio.ts` ou um `.js` não é teste e entra (R2 da #154, B1/F3–F4, B2/G4–G5).
 */
export function ehFonteVarrida(caminho: string): boolean {
  return /\.(m|c)?[jt]sx?$/.test(caminho) && !/\.test\.ts$/.test(caminho);
}

/**
 * Código que a trava não consegue ler (R2 da #154, C6), para não depender de outra trava:
 * - import, reexportação ou carga dinâmica de um caminho que sai do src (relativo, ou `@/` com `..`);
 * - `eval`/`Function` (como valor, chamada ou `new`, quando o escopo não os declara), qualquer `.eval`,
 *   `.Function` ou `.constructor` (`(() => {}).constructor("…")`) e as mesmas chaves em texto;
 * - `setTimeout`/`setInterval` com código em texto.
 */
export function codigoOpaco(fonte: string, arquivo = "src/app/(app)/x/T.tsx"): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const OPACOS = new Set(["eval", "Function"]);
  const achados: string[] = [];
  const foraDoSrc = (especificador: string) =>
    (especificador.startsWith(".") || especificador.startsWith("@/")) && !resolverModulo(arquivo, especificador).startsWith("src/");
  const visitar = (n: ts.Node) => {
    const especificador = (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)
      ? n.moduleSpecifier.text : cargaDinamica(n)?.especificador ?? null;
    if (especificador !== null && foraDoSrc(especificador)) achados.push(`import de fora do src: ${especificador}`);
    if (ts.isIdentifier(n) && OPACOS.has(n.text) && ehReferencia(n) && !emPosicaoDeTipo(n) && declaracaoNoEscopo(n) === null) {
      achados.push(`${n.text} (código montado em texto): ${normaliza(n.parent.getText(sf)).slice(0, 60)}`);
    }
    if (ts.isPropertyAccessExpression(n) && (OPACOS.has(n.name.text) || n.name.text === "constructor")) {
      achados.push(`.${n.name.text} (código montado em texto): ${normaliza(n.getText(sf)).slice(0, 60)}`);
    }
    if (ts.isStringLiteralLike(n) && (OPACOS.has(n.text) || n.text === "constructor") && ts.isElementAccessExpression(n.parent)) {
      achados.push(`["${n.text}"] (código montado em texto): ${normaliza(n.parent.getText(sf)).slice(0, 60)}`);
    }
    if (ts.isCallExpression(n)) {
      const f = semEmbrulho(n.expression);
      const nome = ts.isIdentifier(f) ? f.text : ts.isPropertyAccessExpression(f) ? f.name.text : null;
      const primeiro = n.arguments[0];
      if ((nome === "setTimeout" || nome === "setInterval") && primeiro && (ts.isStringLiteralLike(primeiro) || ts.isTemplateExpression(primeiro))) {
        achados.push(`${nome} com código em texto: ${normaliza(n.getText(sf)).slice(0, 60)}`);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Todo o src (telas, src/components, src/lib, src/test e src/server), sem os testes. */
const FONTES = (readdirSync("src", { recursive: true }) as string[])
  .filter((f: string) => ehFonteVarrida(f.split("\\").join("/")))
  .map((f: string) => ({ arquivo: join("src", f).split("\\").join("/"), conteudo: readFileSync(join("src", f), "utf-8") }));

/** As ações da cópia, agrupadas por arquivo (nome → módulo). */
const PorArquivo = () => {
  const mapa = new Map<string, Record<string, string>>();
  for (const a of COPIA_ACOES) mapa.set(a.arquivo, { ...(mapa.get(a.arquivo) ?? {}), [a.acao]: a.modulo });
  return mapa;
};

describe("ações irreversíveis passam pelo ConfirmarAcao", () => {
  it("a lista do mapa é exatamente a cópia literal (ação e exceção não saem num rebase distraído)", () => {
    expect(ACOES_CONFIRMADAS.map(({ arquivo, modulo, acao, achado }) => ({ arquivo, modulo, acao, achado }))).toEqual(COPIA_ACOES);
    expect(EXCECOES_CONFIRMACAO.map(({ arquivo, trecho }) => ({ arquivo, trecho }))).toEqual(COPIA_EXCECOES);
    for (const a of ACOES_CONFIRMADAS) expect(a.efeito.trim().length, a.acao).toBeGreaterThan(20);
    for (const e of EXCECOES_CONFIRMACAO) expect(e.motivo.trim().length, e.trecho).toBeGreaterThan(20);
    expect(new Set(COPIA_ACOES.map((a) => `${a.arquivo}|${a.acao}`)).size).toBe(COPIA_ACOES.length);
  });

  it("cada ação da lista só dispara na prop `acao` de um <ConfirmarAcao>; fora dele, só as exceções ancoradas", () => {
    const ofensas: string[] = [];
    for (const [arquivo, acoes] of PorArquivo()) {
      expect(existsSync(arquivo), arquivo).toBe(true);
      const { fora, naConfirmacao, problemas } = verificarConfirmacoes(readFileSync(arquivo, "utf-8"), acoes, arquivo);
      ofensas.push(...problemas.map((p) => `${arquivo}: ${p}`));
      for (const [acao, n] of Object.entries(naConfirmacao)) if (n === 0) ofensas.push(`${arquivo}: "${acao}" não passa por nenhum ConfirmarAcao`);
      const trechos = COPIA_EXCECOES.filter((e) => e.arquivo === arquivo).map((e) => e.trecho);
      const { semExcecao, soltas } = conferirExcecoesConfirmacao(fora, trechos);
      ofensas.push(...semExcecao.map((t) => `${arquivo}: fora da confirmação: ${t}`), ...soltas.map((t) => `${arquivo}: exceção solta: ${t}`));
    }
    expect(ofensas).toEqual([]);
  });

  it("toda exceção é de um arquivo da lista", () => {
    const arquivos = new Set(COPIA_ACOES.map((a) => a.arquivo));
    expect(COPIA_EXCECOES.filter((e) => !arquivos.has(e.arquivo))).toEqual([]);
  });

  it("nenhum outro arquivo do src (telas, src/lib, src/test, src/server) importa ou reexporta uma ação da lista", () => {
    const ofensas = FONTES.flatMap(({ arquivo, conteudo }) =>
      importacoesForaDaLista(conteudo, COPIA_ACOES.filter((a) => a.arquivo !== arquivo), arquivo).map((i) => `${arquivo}: ${i}`));
    expect(ofensas).toEqual([]);
  });

  it("no módulo de cada ação, ela só aparece na própria declaração (sem wrapper, alias ou reexportação)", () => {
    const ofensas = COPIA_ACOES.flatMap(({ modulo, acao }) => {
      const caminho = `${resolverModulo("src/x.ts", modulo)}.ts`;
      expect(existsSync(caminho), caminho).toBe(true);
      return referenciasNoModulo(readFileSync(caminho, "utf-8"), acao).map((r) => `${caminho}: ${r}`);
    });
    expect(ofensas).toEqual([]);
  });

  it("a lista de imports que saem do src é exatamente a cópia literal", () => {
    expect(IMPORTS_FORA_DO_SRC.map(({ arquivo, especificador }) => ({ arquivo, especificador }))).toEqual(COPIA_IMPORTS_FORA_DO_SRC);
    for (const i of IMPORTS_FORA_DO_SRC) expect(i.motivo.trim().length, i.especificador).toBeGreaterThan(20);
  });

  it("nenhum código que a trava não lê: import de fora do src (só os da lista), eval/Function/constructor, timer com texto", () => {
    const achados = FONTES.flatMap(({ arquivo, conteudo }) => codigoOpaco(conteudo, arquivo).map((a: string) => `${arquivo}: ${a}`));
    const permitidos = COPIA_IMPORTS_FORA_DO_SRC.map((i: { arquivo: string; especificador: string }) => `${i.arquivo}: import de fora do src: ${i.especificador}`);
    const { semExcecao, soltas } = conferirExcecoesConfirmacao(achados, permitidos);
    expect({ semExcecao, soltas }).toEqual({ semExcecao: [], soltas: [] });
  });

  it("nenhum window.confirm no src: a confirmação é o <ConfirmarAcao>", () => {
    const ofensas = FONTES.flatMap(({ arquivo, conteudo }) => confirmacoesNativas(conteudo).map((c) => `${arquivo}: ${c}`));
    expect(ofensas).toEqual([]);
  });

  it("a varredura acha as telas, o componente, src/lib, src/test e src/server, e nenhum teste", () => {
    const arquivos = FONTES.map((f) => f.arquivo);
    expect(arquivos).toEqual(expect.arrayContaining([
      "src/components/ConfirmarAcao.tsx", "src/lib/acao-cliente.ts", "src/lib/prisma.ts", "src/server/whatsapp/acoes.ts", "src/test/tela-sem-dom.ts",
      ...COPIA_ACOES.map((a) => a.arquivo),
    ]));
    expect(arquivos.some((a) => /\.test\./.test(a))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------
// Autoteste em fonte virtual: cada evasão acusa; o uso correto passa.
// ---------------------------------------------------------------------------------------------------

const M = "@/server/whatsapp/acoes";
const ACOES = { enviar: M };
const CABECALHO = `import { ConfirmarAcao } from "@/components/ConfirmarAcao";\nimport { enviar } from "${M}";\n`;
const v = (corpo: string, cabecalho = CABECALHO) => verificarConfirmacoes(`${cabecalho}export function T({ id, ok }: { id: string; ok: boolean }) { ${corpo} }`, ACOES);

describe("verificarConfirmacoes (autoteste)", () => {
  it("uso correto: a chamada está na prop `acao` de um ConfirmarAcao importado", () => {
    const r = v(`return <ConfirmarAcao titulo="t" confirmacao="envio" idempotente={false} acao={() => enviar(id)} aoConcluir={() => {}} aoCancelar={() => {}}>x</ConfirmarAcao>;`);
    expect(r).toEqual({ fora: [], naConfirmacao: { enviar: 1 }, problemas: [] });
  });

  it("E1 \u2014 chamada direta no clique acusa", () => {
    expect(v(`return <button onClick={() => enviar(id)}>Cobrar</button>;`).fora).toEqual(["enviar(id)"]);
  });

  it("E2 \u2014 import com outro nome continua sendo a ação", () => {
    const r = v(`return <button onClick={() => mandar(id)}>Cobrar</button>;`, `import { enviar as mandar } from "${M}";\n`);
    expect(r.fora).toEqual(["mandar(id)"]);
    expect(r.naConfirmacao).toEqual({ enviar: 0 });
  });

  it("E3 \u2014 referência solta (sem chamada), passada como valor ou em propriedade abreviada, acusa", () => {
    expect(v(`return <button onClick={enviar}>Cobrar</button>;`).fora).toHaveLength(1);
    expect(v(`const f = enviar; return null;`).fora).toHaveLength(1);
    expect(v(`const o = { enviar }; return null;`).fora).toHaveLength(1);
    expect(v(`return null; } export { enviar }; function Z() {`).fora).toHaveLength(1);
  });

  it("E4 \u2014 prop `acao` de OUTRO componente não é confirmação", () => {
    expect(v(`return <Outro acao={() => enviar(id)} />;`).fora).toEqual(["enviar(id)"]);
  });

  it("E5 \u2014 outra prop do próprio ConfirmarAcao (aoConcluir, children) não é a confirmação", () => {
    expect(v(`return <ConfirmarAcao acao={async () => ({ ok: true })} aoConcluir={() => enviar(id)} />;`).fora).toEqual(["enviar(id)"]);
    expect(v(`return <ConfirmarAcao acao={async () => ({ ok: true })}>{ok && enviar(id)}</ConfirmarAcao>;`).fora).toEqual(["enviar(id)"]);
  });

  it("E6 \u2014 ConfirmarAcao declarado no arquivo (não importado do componente) não vale", () => {
    const cab = `import { enviar } from "${M}";\nconst ConfirmarAcao = (p: { acao: () => unknown }) => { p.acao(); return null; };\n`;
    expect(v(`return <ConfirmarAcao acao={() => enviar(id)} />;`, cab).fora).toEqual(["enviar(id)"]);
    const deOutroModulo = `import { ConfirmarAcao } from "@/components/Outro";\nimport { enviar } from "${M}";\n`;
    expect(v(`return <ConfirmarAcao acao={() => enviar(id)} />;`, deOutroModulo).fora).toEqual(["enviar(id)"]);
  });

  it("E7 \u2014 ConfirmarAcao importado com outro nome é seguido (e só ele)", () => {
    const cab = `import { ConfirmarAcao as Confirmar } from "@/components/ConfirmarAcao";\nimport { enviar } from "${M}";\n`;
    expect(v(`return <Confirmar acao={() => enviar(id)} />;`, cab)).toEqual({ fora: [], naConfirmacao: { enviar: 1 }, problemas: [] });
    expect(v(`return <ConfirmarAcao acao={() => enviar(id)} />;`, cab).fora).toEqual(["enviar(id)"]);
  });

  it("E8 \u2014 função intermediária: a chamada fora da prop acusa, mesmo que a função vá para a prop", () => {
    expect(v(`const disparar = () => enviar(id); return <ConfirmarAcao acao={disparar} />;`).fora).toEqual(["enviar(id)"]);
  });

  it("E9 \u2014 atributo JSX mais próximo decide: elemento dentro da prop `acao` com a chamada noutra prop acusa", () => {
    expect(v(`return <ConfirmarAcao acao={() => <Outro onClick={() => enviar(id)} />} />;`).fora).toEqual(["enviar(id)"]);
  });

  it("E10 \u2014 import do módulo inteiro, import dinâmico e require não são verificáveis", () => {
    expect(v(`return null;`, `import * as acoes from "${M}";\nimport { enviar } from "${M}";\n`).problemas).toEqual([`import do módulo inteiro de ${M} (acoes): chamadas não verificáveis`]);
    expect(v(`const p = import("${M}"); return p;`).problemas).toEqual([`carga dinâmica de ${M}: chamadas não verificáveis`]);
    expect(v(`require("${M}"); return null;`).problemas).toEqual([`carga dinâmica de ${M}: chamadas não verificáveis`]);
  });

  it("E11 \u2014 spread num ConfirmarAcao não é verificável", () => {
    expect(v(`const p = {}; return <ConfirmarAcao {...p} acao={() => enviar(id)} />;`).problemas).toEqual(["<ConfirmarAcao> com spread: props não verificáveis"]);
  });

  it("E12 \u2014 ação da lista que o arquivo não importa (removida ou renomeada) acusa", () => {
    expect(v(`return null;`, `import { ConfirmarAcao } from "@/components/ConfirmarAcao";\n`).problemas).toEqual([`a ação "enviar" não é importada de ${M} (lista desatualizada?)`]);
    // Mesmo nome, outro módulo: não é a ação da lista.
    expect(v(`return null;`, `import { enviar } from "@/server/outro";\n`).problemas).toHaveLength(1);
  });

  it("E13 \u2014 nome com escape unicode no fonte é o mesmo identificador", () => {
    expect(v(`return <button onClick={() => \\u0065nviar(id)}>Cobrar</button>;`).fora).toHaveLength(1);
  });

  it("posição de tipo, texto e comentário não executam: não contam", () => {
    const r = v(`type R = ReturnType<typeof enviar>; const t = "enviar(id)"; /* enviar(id) */ const x = null as unknown as R; return <ConfirmarAcao acao={() => enviar(id)}>{t}{String(x)}</ConfirmarAcao>;`);
    expect(r).toEqual({ fora: [], naConfirmacao: { enviar: 1 }, problemas: [] });
  });

  it("import só de tipo não liga a ação (e a lista acusa a ausência)", () => {
    expect(v(`return null;`, `import type { enviar } from "${M}";\n`).problemas).toHaveLength(1);
    expect(v(`return null;`, `import { type enviar } from "${M}";\n`).problemas).toHaveLength(1);
  });

  it("sem nenhuma referência na confirmação, a contagem fica 0 (a trava exige \u2265 1)", () => {
    expect(v(`return <button onClick={() => enviar(id)}>x</button>;`).naConfirmacao).toEqual({ enviar: 0 });
  });
});

describe("conferirExcecoesConfirmacao (autoteste)", () => {
  it("exceção casa com exatamente uma chamada; solta (0) e ambígua (2) acusam; o resto fica sem exceção", () => {
    expect(conferirExcecoesConfirmacao(["salvar(dados)"], ["salvar(dados)"])).toEqual({ semExcecao: [], soltas: [] });
    expect(conferirExcecoesConfirmacao(["salvar(dados)"], [])).toEqual({ semExcecao: ["salvar(dados)"], soltas: [] });
    expect(conferirExcecoesConfirmacao([], ["salvar(dados)"])).toEqual({ semExcecao: [], soltas: ["salvar(dados) (casa com 0)"] });
    expect(conferirExcecoesConfirmacao(["salvar(dados)", "salvar(dados)"], ["salvar(dados)"])).toEqual({ semExcecao: ["salvar(dados)", "salvar(dados)"], soltas: ["salvar(dados) (casa com 2)"] });
    // Texto exato: outro argumento não é a mesma chamada.
    expect(conferirExcecoesConfirmacao(["salvar(form)"], ["salvar(dados)"])).toEqual({ semExcecao: ["salvar(form)"], soltas: ["salvar(dados) (casa com 0)"] });
  });
});

describe("confirmacoesNativas (autoteste)", () => {
  it("window.confirm em qualquer forma acusa", () => {
    expect(confirmacoesNativas(`if (!window.confirm("x")) return;`)).toHaveLength(1);
    expect(confirmacoesNativas(`confirm("x");`)).toHaveLength(1);
    expect(confirmacoesNativas(`globalThis.confirm("x"); self.confirm("y");`)).toHaveLength(2);
    expect(confirmacoesNativas(`(window).confirm("x");`)).toHaveLength(1);
    expect(confirmacoesNativas(`window?.confirm("x");`)).toHaveLength(1);
    expect(confirmacoesNativas(`window["confirm"]("x");`)).toHaveLength(1);
    expect(confirmacoesNativas(`window["con" + "firm"]("x");`)).toHaveLength(1); // chave calculada: não verificável
    expect(confirmacoesNativas(`const c = window.confirm; c("x");`)).toHaveLength(1);
    // Desestruturação: o nome "confirm" e o global desestruturado acusam, cada um.
    expect(confirmacoesNativas(`const { confirm: c } = window; c("x");`)).toHaveLength(2);
    expect(confirmacoesNativas(`\\u0063onfirm("x");`)).toHaveLength(1); // escape unicode no nome
  });

  it("R1 da #154, B2 \u2014 E7b: alias do global (também com `as`) acusa pelo `.confirm`", () => {
    expect(confirmacoesNativas(`const w = window; w.confirm("Go-live?");`)).toEqual(['w.confirm']);
    expect(confirmacoesNativas(`const g = globalThis as unknown as Window; const h = g; h.confirm("x");`)).toEqual(['h.confirm']);
  });

  it("R1 da #154, B2 \u2014 E8b: cadeia do global (window.window, globalThis.self) acusa", () => {
    expect(confirmacoesNativas(`window.window.confirm("Go-live?");`)).toEqual(['window.window.confirm']);
    expect(confirmacoesNativas(`globalThis.self.confirm("x");`)).toEqual(['globalThis.self.confirm']);
    expect(confirmacoesNativas(`const w = window.window; w["con" + "firm"]("x");`)).toEqual(['w["con" + "firm"]']);
  });

  it("R1 da #154, B2 \u2014 E9b: reflexão (Reflect.get, getOwnPropertyDescriptor) acusa pelo texto e pelo global como argumento", () => {
    expect(confirmacoesNativas(`(Reflect.get(window, "confirm") as (m: string) => boolean)("Go-live?");`)).toEqual(['Reflect.get(window, "confirm")', 'Reflect.get(window, "confirm")']);
    expect(confirmacoesNativas(`Object.getOwnPropertyDescriptor(window, "con" + "firm");`)).toEqual(['Object.getOwnPropertyDescriptor(window, "con" + "firm")']);
    expect(confirmacoesNativas(`const k = "conf" + "irm"; Reflect.get(globalThis, k);`)).toEqual(['Reflect.get(globalThis, k)']);
  });

  it("R1 da #154, B2 \u2014 o global como valor (espalhado, passado adiante, em propriedade abreviada) acusa", () => {
    expect(confirmacoesNativas(`const o = { ...window };`)).toHaveLength(1);
    expect(confirmacoesNativas(`usar(self);`)).toHaveLength(1);
    expect(confirmacoesNativas(`const o = { top };`)).toHaveLength(1);
  });

  it("método `confirm` de QUALQUER objeto acusa (falha fechada: não dá para provar que não é o global)", () => {
    expect(confirmacoesNativas(`pagamento.confirm();`)).toEqual(["pagamento.confirm"]);
  });

  it("o que não é o nativo passa: chave declarada, outro nome, propriedade nomeada do global, typeof, comparação, `in`, alias e nome local", () => {
    expect(confirmacoesNativas([
      `const o = { confirm: true }; type T = { confirm(): void }; const confirmar = () => 1;`,
      `window.location.reload(); window.dispatchEvent(new Event("x")); window["localStorage"].clear();`,
      `if (typeof window !== "undefined" && "matchMedia" in window && window !== undefined) {}`,
      `const g = globalThis as unknown as { prisma?: number }; g.prisma = 1;`,
      `function f(parent: { top: number }) { const top = parent.top; return top; }`,
    ].join("\n"))).toEqual([]);
  });
});

describe("resolverModulo (autoteste)", () => {
  it("`@/` vira src/; relativo resolve contra o arquivo; extensão e /index saem; pacote fica", () => {
    expect(resolverModulo("src/app/(app)/x/T.tsx", "@/server/whatsapp/acoes")).toBe("src/server/whatsapp/acoes");
    expect(resolverModulo("src/app/(app)/financeiro/cobrar.ts", "../../../server/whatsapp/acoes")).toBe("src/server/whatsapp/acoes");
    expect(resolverModulo("src/lib/x.ts", "../server/whatsapp/acoes.ts")).toBe("src/server/whatsapp/acoes");
    expect(resolverModulo("src/lib/x.ts", "./y/index")).toBe("src/lib/y");
    expect(resolverModulo("src/lib/x.ts", "next/navigation")).toBe("next/navigation");
  });
});

describe("verificarConfirmacoes com caminho relativo e reexportação (R1 da #154, B1)", () => {
  const ARQ = "src/app/(app)/financeiro/T.tsx";
  const corpo = (cab: string, c: string) => verificarConfirmacoes(`${cab}export function T({ id }: { id: string }) { ${c} }`, ACOES, ARQ);

  it("E1b \u2014 a ação importada por caminho relativo (com outro nome) é a mesma: fora da confirmação acusa", () => {
    const cab = `import { ConfirmarAcao } from "../../../components/ConfirmarAcao";\nimport { enviar as e } from "../../../server/whatsapp/acoes";\n`;
    expect(corpo(cab, `return <button onClick={() => e(id)}>x</button>;`)).toEqual({ fora: ["e(id)"], naConfirmacao: { enviar: 0 }, problemas: [] });
    // E o ConfirmarAcao importado por caminho relativo também é reconhecido.
    expect(corpo(cab, `return <ConfirmarAcao acao={() => e(id)} />;`)).toEqual({ fora: [], naConfirmacao: { enviar: 1 }, problemas: [] });
  });

  it("E2b \u2014 reexportar a ação (por nome ou o módulo inteiro) a partir do arquivo da lista acusa", () => {
    expect(corpo(`${CABECALHO}export { enviar as fechar } from "${M}";\n`, `return null;`).problemas).toEqual([`reexporta "enviar" de ${M}`]);
    expect(corpo(`${CABECALHO}export * from "../../../server/whatsapp/acoes";\n`, `return null;`).problemas).toEqual(["reexporta o módulo inteiro de ../../../server/whatsapp/acoes: chamadas não verificáveis"]);
    expect(corpo(`${CABECALHO}export * as tudo from "${M}";\n`, `return null;`).problemas).toEqual([`reexporta o módulo inteiro de ${M}: chamadas não verificáveis`]);
  });

  it("carga dinâmica com caminho calculado não é verificável", () => {
    expect(corpo(CABECALHO, `const c = "@/server/" + "whatsapp/acoes"; const p = import(c); return p;`).problemas).toEqual(["carga dinâmica de caminho calculado: chamadas não verificáveis"]);
  });
});

describe("importacoesForaDaLista (autoteste)", () => {
  const lista = [{ modulo: M, acao: "enviar" }];
  it("import por nome (inclusive com outro nome), do módulo inteiro ou dinâmico acusa; tipo e outra ação não", () => {
    expect(importacoesForaDaLista(`import { enviar } from "${M}";`, lista)).toEqual([`enviar from ${M}`]);
    expect(importacoesForaDaLista(`import { enviar as e } from "${M}";`, lista)).toEqual([`enviar from ${M}`]);
    expect(importacoesForaDaLista(`import * as a from "${M}";`, lista)).toEqual([`* as a from ${M}`]);
    expect(importacoesForaDaLista(`const a = await import("${M}");`, lista)).toEqual([`carga dinâmica de ${M}`]);
    expect(importacoesForaDaLista(`import type { enviar } from "${M}"; import { outra } from "${M}";`, lista)).toEqual([]);
  });

  it("R1 da #154, B1 \u2014 E1b: import relativo do mesmo módulo acusa", () => {
    const fonte = `import { enviar } from "../../../server/whatsapp/acoes"; export const cobrarAgora = (id: string) => enviar(id);`;
    expect(importacoesForaDaLista(fonte, lista, "src/app/(app)/financeiro/cobrar-agora.ts")).toEqual(["enviar from ../../../server/whatsapp/acoes"]);
  });

  it("R1 da #154, B1 \u2014 E2b: reexportação (nomeada, com outro nome, tudo, tudo com nome) acusa", () => {
    expect(importacoesForaDaLista(`export { enviar as fechar } from "${M}";`, lista)).toEqual([`export { enviar } from ${M}`]);
    expect(importacoesForaDaLista(`export * from "${M}";`, lista)).toEqual([`export * from ${M}`]);
    expect(importacoesForaDaLista(`export * as tudo from "${M}";`, lista)).toEqual([`export * from ${M}`]);
    expect(importacoesForaDaLista(`export { outra } from "${M}"; export type { enviar } from "${M}";`, lista)).toEqual([]);
  });

  it("R1 da #154, B1 \u2014 E3b: wrapper em src/lib (caminho relativo ou `@/`) acusa; o arquivo que usa o wrapper não importa a ação", () => {
    expect(importacoesForaDaLista(`import { enviar } from "../server/whatsapp/acoes"; export const ja = (id: string) => enviar(id);`, lista, "src/lib/cobranca-direta.ts"))
      .toEqual(["enviar from ../server/whatsapp/acoes"]);
    expect(importacoesForaDaLista(`import { enviar } from "@/server/whatsapp/acoes.ts";`, lista, "src/lib/cobranca-direta.ts")).toEqual(["enviar from @/server/whatsapp/acoes.ts"]);
  });

  it("carga dinâmica com caminho calculado acusa; módulo homônimo noutra pasta não é o da ação", () => {
    expect(importacoesForaDaLista(`const c = "x"; await import(c);`, lista)).toEqual(["carga dinâmica de caminho calculado"]);
    expect(importacoesForaDaLista(`import { enviar } from "./acoes";`, lista, "src/app/(app)/whatsapp/T.tsx")).toEqual([]);
  });
});

describe("referenciasNoModulo (autoteste)", () => {
  const declaracao = `export async function enviar(id: string) { return { ok: true, id }; }\n`;
  it("só a declaração: nada a acusar", () => {
    expect(referenciasNoModulo(declaracao, "enviar")).toEqual([]);
    expect(referenciasNoModulo(`${declaracao}type R = ReturnType<typeof enviar>;`, "enviar")).toEqual([]);
  });

  it("wrapper, alias exportado e reexportação com outro nome no próprio módulo acusam", () => {
    expect(referenciasNoModulo(`${declaracao}export async function cobrarJa(id: string) { return enviar(id); }`, "enviar")).toEqual(["enviar(id)"]);
    expect(referenciasNoModulo(`${declaracao}export const cobrar = enviar;`, "enviar")).toHaveLength(1);
    expect(referenciasNoModulo(`${declaracao}export { enviar as cobrar };`, "enviar")).toHaveLength(1);
  });

  it("ação que não é declarada como função no módulo (renomeada, virou const) acusa", () => {
    expect(referenciasNoModulo(`export const enviar = async (id: string) => id;`, "enviar")).toEqual(['"enviar" declarada 0 vez(es) como função no módulo']);
  });
});

describe("R2 da #154, B8 \u2014 a ação só pode rodar quando a confirmação chama `acao`", () => {
  it("F7: executar no render (IIFE no valor da prop) acusa", () => {
    expect(v(`return <ConfirmarAcao acao={((p: unknown) => () => p)(enviar(id))} />;`).fora).toEqual(["enviar(id)"]);
  });
  it("valor padrão de parâmetro roda ao chamar? não: roda antes do corpo \u2014 e fica fora do corpo: acusa", () => {
    expect(v(`return <ConfirmarAcao acao={(r = enviar(id)) => r} />;`).fora).toEqual(["enviar(id)"]);
  });
  it("a própria action como valor (sem função em volta) acusa: o corpo dela não é o da confirmação", () => {
    expect(v(`return <ConfirmarAcao acao={enviar} />;`).fora).toHaveLength(1);
  });
  it("arrow com corpo em bloco, `async` e `function` passam", () => {
    expect(v(`return <ConfirmarAcao acao={async () => { const r = await enviar(id); return r; }} />;`).naConfirmacao).toEqual({ enviar: 1 });
    expect(v(`return <ConfirmarAcao acao={function () { return enviar(id); }} />;`).naConfirmacao).toEqual({ enviar: 1 });
    expect(v(`return <ConfirmarAcao acao={(() => enviar(id))} />;`).naConfirmacao).toEqual({ enviar: 1 });
  });
});

describe("R2 da #154, B1 \u2014 caminhos `@/` com `..`/`.` e varredura de .js e de nomes com `.test.`", () => {
  const lista = [{ modulo: "@/server/empresas/acoes", acao: "cancelarFaturaB2B" }];
  it("F1/F2: `@/` com `..` ou `.` é o mesmo módulo", () => {
    expect(resolverModulo("src/lib/x.ts", "@/server/empresas/../empresas/acoes")).toBe("src/server/empresas/acoes");
    expect(resolverModulo("src/lib/x.ts", "@/server/./empresas/acoes")).toBe("src/server/empresas/acoes");
    expect(importacoesForaDaLista(`import { cancelarFaturaB2B } from "@/server/empresas/../empresas/acoes"; export const cancelarJa = (id: string) => cancelarFaturaB2B(id);`, lista, "src/lib/cobranca-direta.ts"))
      .toEqual(["cancelarFaturaB2B from @/server/empresas/../empresas/acoes"]);
    expect(importacoesForaDaLista(`import { cancelarFaturaB2B } from "@/server/./empresas/acoes";`, lista, "src/lib/cobranca-direta.ts"))
      .toEqual(["cancelarFaturaB2B from @/server/./empresas/acoes"]);
  });
  it("F3/F4 (e G4/G5): .js, .jsx, .mjs, .cjs e nome com `.test.` que não é teste entram; só os `.test.ts` ficam de fora", () => {
    for (const f of ["lib/cobranca-direta.js", "components/perguntar.jsx", "lib/a.mjs", "lib/a.cjs", "lib/a.mts", "lib/cobranca.test.apoio.ts", "components/perguntar.test.apoio.ts", "components/A.test.tsx", "types/x.d.ts"]) {
      expect(ehFonteVarrida(f), f).toBe(true);
    }
    for (const f of ["app/confirmacoes.test.ts", "server/x.int.test.ts"]) expect(ehFonteVarrida(f), f).toBe(false);
    expect(ehFonteVarrida("lib/leiame.md")).toBe(false);
  });
  it("um .js é lido: o import do wrapper acusa mesmo sem tipos", () => {
    expect(importacoesForaDaLista(`import { cancelarFaturaB2B } from "@/server/empresas/acoes";\nexport const cancelarJa = (id) => cancelarFaturaB2B(id);`, lista, "src/lib/cobranca-direta.js"))
      .toEqual(["cancelarFaturaB2B from @/server/empresas/acoes"]);
  });
});

describe("R2 da #154, B2 \u2014 window.confirm por defaultView, parâmetro homônimo noutra função e window.open", () => {
  it("G1: `document.defaultView` (e opener, contentWindow) é a janela", () => {
    expect(confirmacoesNativas(`const v = document.defaultView as unknown as Record<string, (m: string) => boolean>; v["con" + "firm"]("Go-live?");`)).toEqual(['v["con" + "firm"]']);
    expect(confirmacoesNativas(`window.opener["con" + "firm"]("x");`)).toEqual(['window.opener["con" + "firm"]']);
    expect(confirmacoesNativas(`usar(iframe.contentWindow);`)).toEqual(["usar(iframe.contentWindow)"]);
  });
  it("G3: um parâmetro `window` numa função não desliga o global nas outras (escopo, não o arquivo)", () => {
    const fonte = [
      `export function largura(window: { innerWidth: number }) { return window.innerWidth; }`,
      `export function perguntar() { const w = window as unknown as Record<string, (m: string) => boolean>; return w["con" + "firm"]("Go-live?"); }`,
    ].join("\n");
    expect(confirmacoesNativas(fonte)).toEqual(['w["con" + "firm"]']);
    // O parâmetro em si, dentro da função dele, não é o global.
    expect(confirmacoesNativas(`export function f(window: Record<string, number>, k: string) { return window[k]; }`)).toEqual([]);
  });
  it("o resultado de window.open é uma janela: chave calculada e passagem adiante acusam; condição e alias passam", () => {
    expect(confirmacoesNativas(`const p = window.open("x"); p["con" + "firm"]("y");`)).toEqual(['p["con" + "firm"]']);
    expect(confirmacoesNativas(`usar(window.open("x"));`)).toEqual(['usar(window.open("x"))']);
    expect(confirmacoesNativas(`const popup = window.open(u, "_blank"); setNota(popup ? "a" : "b"); if (!popup) parar(); window.open(u);`)).toEqual([]);
  });
});

describe("R2 da #154, C6 \u2014 codigoOpaco (autoteste)", () => {
  it("import, reexportação e carga dinâmica que saem do src acusam; dentro do src e pacote não", () => {
    expect(codigoOpaco(`import { x } from "../../../../scripts/atalho";`, "src/app/(app)/x/T.tsx")).toEqual(["import de fora do src: ../../../../scripts/atalho"]);
    expect(codigoOpaco(`import { x } from "@/../scripts/atalho";`)).toEqual(["import de fora do src: @/../scripts/atalho"]);
    expect(codigoOpaco(`export * from "../../scripts/atalho";`, "src/lib/x.ts")).toEqual(["import de fora do src: ../../scripts/atalho"]);
    expect(codigoOpaco(`const m = await import("../../scripts/atalho");`, "src/lib/x.ts")).toEqual(["import de fora do src: ../../scripts/atalho"]);
    expect(codigoOpaco(`import { x } from "../y"; import { z } from "@/lib/z"; import { useRouter } from "next/navigation";`, "src/lib/a/b.ts")).toEqual([]);
  });
  it("G2 e afins: eval, Function (chamada, new, alias, propriedade de outro objeto), .constructor e timer com texto acusam", () => {
    expect(codigoOpaco(`eval("1");`)).toHaveLength(1);
    expect(codigoOpaco(`Function("return this")();`)).toHaveLength(1);
    expect(codigoOpaco(`new Function("return this");`)).toHaveLength(1);
    expect(codigoOpaco(`const F = Function; F("x");`)).toHaveLength(1);
    expect(codigoOpaco(`globalThis.Function("x");`)).toHaveLength(1);
    expect(codigoOpaco(`(() => 1).constructor("return this")();`)).toHaveLength(1);
    expect(codigoOpaco(`(() => 1)["constructor"]("return this")();`)).toHaveLength(1);
    expect(codigoOpaco(`setTimeout("perguntar()", 0); window.setInterval(\`x\`, 1);`)).toHaveLength(2);
  });
  it("o que não é código opaco passa: tipo Function, função local chamada eval, timer com função", () => {
    expect(codigoOpaco(`type F = Function; function eval2() {} const t = setTimeout(() => 1, 0); function g(eval: number) { return eval; }`)).toEqual([]);
  });
});
