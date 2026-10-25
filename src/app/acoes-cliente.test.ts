import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// E3 (docs/42-auditoria-frontend-ux.md): componente cliente que chama server action precisa tratar
// falha de transporte — senão o botão fica em "Salvando…" para sempre, ou a falha passa calada.
// O caminho padrão é useAcaoCliente/executarAcaoCliente (src/lib/acao-cliente.ts); um `catch` próprio
// também serve. O passivo herdado (54 arquivos) foi migrado nas PRs do E3 — agora a regra vale para todos.

const clientesComAction = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") }))
    .filter(({ conteudo }) => /^\s*["']use client["']/.test(conteudo))
    .filter(({ conteudo }) => importaAction(conteudo)),
);

/**
 * Importa de verdade uma server action: import de valor (não `import type`) de um módulo de
 * `@/server/` que começa com "use server". Utilitários puros de `@/server/` (schemas, formatação de
 * fuso) ficam de fora — não há chamada ao servidor a proteger.
 */
function importaAction(conteudo: string) {
  return [...conteudo.matchAll(/^import\s+(?!type\b)[^;]*from\s+["']@\/server\/([^"']+)["']/gm)].some((m) => {
    const base = join("src/server", m[1]);
    const arquivo = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((a) => existsSync(a));
    return arquivo !== undefined && /^\s*["']use server["']/.test(readFileSync(arquivo, "utf-8"));
  });
}

/**
 * Só código: strings e comentários saem (numa passada só, para `"https://…"` não virar comentário).
 * `// } catch {` ou `"useAcaoCliente("` num texto não contam como tratamento.
 */
const soCodigo = (fonte: string) =>
  fonte.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m[0] === "/" ? "" : '""'));

/**
 * `try { … } catch` que protege algo assíncrono: o bloco do try tem `await` ou `.then(`. Um catch em
 * volta de `localStorage` (ou de um JSON.parse) não conta — não é ele que segura a falha da action.
 */
function temTryAssincronoComCatch(codigo: string) {
  for (const m of codigo.matchAll(/\btry\s*\{/g)) {
    let nivel = 0, i = m.index! + m[0].length - 1;
    for (; i < codigo.length; i++) {
      if (codigo[i] === "{") nivel++;
      else if (codigo[i] === "}" && --nivel === 0) break;
    }
    const bloco = codigo.slice(m.index!, i + 1);
    if (/^\s*catch\b/.test(codigo.slice(i + 1)) && /\bawait\b|\.then\(/.test(bloco)) return true;
  }
  return false;
}

/** Delegação fechada: só o import nomeado real e chamadas diretas na prop acao canônica. */
function delegaConfirmacaoCanonica(conteudo: string, arquivo: string): boolean {
  const sf = ts.createSourceFile(arquivo, conteudo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const componentes = new Set<string>(), actions = new Set<string>(), imports = new Map<string, number>();
  let valido = true;
  const registrarImport = (nome: string) => imports.set(nome, (imports.get(nome) ?? 0) + 1);
  const moduloServer = (modulo: string): boolean | null => {
    const base = modulo.startsWith("@/") ? join("src", modulo.slice(2)) : modulo.startsWith(".") ? join(dirname(arquivo), modulo) : null;
    if (!base) return false; // pacote externo não é um arquivo use-server do projeto
    const candidatos = /\.[cm]?[jt]sx?$/.test(base) ? [base] : [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
    const caminho = candidatos.find(a => existsSync(a));
    if (!caminho) return null; // módulo local não resolvido: fallback não concede tratamento
    const moduloSf = ts.createSourceFile(caminho, readFileSync(caminho, "utf-8"), ts.ScriptTarget.Latest, false);
    for (const st of moduloSf.statements) {
      if (!ts.isExpressionStatement(st) || !ts.isStringLiteral(st.expression)) break;
      if (st.expression.text === "use server") return true;
    }
    return false;
  };
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const c = st.importClause;
    if (c?.isTypeOnly) continue;
    if (c?.name) registrarImport(c.name.text);
    if (c?.namedBindings && ts.isNamespaceImport(c.namedBindings)) registrarImport(c.namedBindings.name.text);
    if (c?.namedBindings && ts.isNamedImports(c.namedBindings)) for (const e of c.namedBindings.elements) if (!e.isTypeOnly) registrarImport(e.name.text);
    const modulo = st.moduleSpecifier.text;
    if (modulo === "@/components/ConfirmarAcao") {
      if (!c || c.name || !c.namedBindings || !ts.isNamedImports(c.namedBindings)) { valido = false; continue; }
      for (const e of c.namedBindings.elements) {
        if (e.isTypeOnly) continue;
        if ((e.propertyName ?? e.name).text !== "ConfirmarAcao") valido = false;
        else componentes.add(e.name.text);
      }
      continue;
    }
    const servidor = moduloServer(modulo);
    if (servidor === null) { valido = false; continue; }
    if (!servidor) continue;
    if (!c || c.name || !c.namedBindings || !ts.isNamedImports(c.namedBindings)) { valido = false; continue; }
    for (const e of c.namedBindings.elements) if (!e.isTypeOnly) actions.add(e.name.text);
  }
  const protegidos = new Set([...componentes, ...actions]);
  if (!valido || !componentes.size || !actions.size || [...protegidos].some(n => imports.get(n) !== 1)) return false;
  const conta = new Map([...actions].map(a => [a, 0]));
  const nomeProtegido = (n: ts.BindingName | ts.Identifier | ts.StringLiteral | undefined): boolean => {
    if (!n || ts.isStringLiteral(n)) return false;
    if (ts.isIdentifier(n)) return protegidos.has(n.text);
    return n.elements.some(e => !ts.isOmittedExpression(e) && nomeProtegido(e.name));
  };
  const emTipo = (n: ts.Node) => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) if (ts.isTypeNode(p)) return true;
    return false;
  };
  const chamadaDelegada = (n: ts.Identifier): boolean => {
    const call = n.parent;
    if (!ts.isCallExpression(call) || call.expression !== n || call.questionDotToken) return false;
    const arrow = call.parent;
    if (!ts.isArrowFunction(arrow) || arrow.body !== call || arrow.parameters.length) return false;
    const expr = arrow.parent;
    if (!ts.isJsxExpression(expr) || expr.expression !== arrow) return false;
    const attr = expr.parent;
    if (!ts.isJsxAttribute(attr) || attr.name.getText(sf) !== "acao" || attr.initializer !== expr) return false;
    const el = attr.parent.parent;
    return (ts.isJsxOpeningElement(el) || ts.isJsxSelfClosingElement(el)) && ts.isIdentifier(el.tagName) && componentes.has(el.tagName.text);
  };
  const visitar = (n: ts.Node) => {
    if (ts.isImportDeclaration(n)) return;
    // O fallback não resolve loaders/reexports: valores não admitidos ficam fechados.
    if (ts.isImportEqualsDeclaration(n)) { if (!n.isTypeOnly) valido = false; return; }
    if (ts.isExportDeclaration(n)) {
      const soTipo = n.isTypeOnly || (n.exportClause && ts.isNamedExports(n.exportClause) && n.exportClause.elements.every(e => e.isTypeOnly));
      if (!soTipo) valido = false;
      return;
    }
    if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === "require"))) valido = false;
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) ||
         ts.isClassDeclaration(n) || ts.isClassExpression(n) || ts.isEnumDeclaration(n) || ts.isModuleDeclaration(n) || ts.isImportEqualsDeclaration(n)) && nomeProtegido(n.name)) valido = false;
    if (ts.isIdentifier(n) && protegidos.has(n.text) && !emTipo(n)) {
      // Nome de atributo não é referência ao binding importado.
      if (ts.isJsxAttribute(n.parent) && n.parent.name === n) return;
      if (actions.has(n.text)) {
        if (!chamadaDelegada(n)) valido = false;
        else conta.set(n.text, conta.get(n.text)! + 1);
      } else {
        const p = n.parent;
        if (!((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === n)) valido = false;
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return valido && [...conta.values()].every(n => n > 0);
}
/** Tratamento de verdade: try assíncrono com catch, `.catch(` numa promessa, ou a chamada dos helpers do E3. */
const trataFalha = (conteudo: string, arquivo = "src/app/(app)/x/T.tsx") => {
  const codigo = soCodigo(conteudo);
  return /\.catch\(|\buseAcaoCliente\(|\bexecutarAcaoCliente\(/.test(codigo) || temTryAssincronoComCatch(codigo) || delegaConfirmacaoCanonica(conteudo, arquivo);
};

describe("ações no cliente tratam falha de transporte", () => {
  it("todo componente cliente que chama server action trata a falha (catch ou useAcaoCliente)", () => {
    const semTratamento = clientesComAction.filter(({ conteudo, arquivo }) => !trataFalha(conteudo, arquivo)).map((c) => c.arquivo);
    expect(semTratamento).toEqual([]);
  });

  it("a varredura encontra os componentes (não passa vazia por erro de caminho)", () => {
    expect(clientesComAction.length).toBeGreaterThan(150);
  });
});

describe("delegação canônica para ConfirmarAcao — sem marcador lexical artificial", () => {
  const modulo = "@/server/whatsapp/acoes";
  const action = `import { vincularContatoWhatsApp as vincular } from "${modulo}";`;
  const canonico = 'import { ConfirmarAcao } from "@/components/ConfirmarAcao";';
  const render = (corpo: string, componentes = canonico, imports = action) => `"use client";${componentes}${imports}export function T(){return ${corpo};}`;
  const chamada = '<ConfirmarAcao acao={() => vincular()} />';
  it("reconhece import real e chamada direta na expressão-body acao", () => { expect(trataFalha(render(chamada))).toBe(true); });
  it("aceita alias nomeado do componente real e mantém o binding da action", () => {
    expect(trataFalha(render('<C acao={() => vincular()} />', 'import { ConfirmarAcao as C } from "@/components/ConfirmarAcao";'))).toBe(true);
  });
  it("todas as actions importadas ficam delegadas; utilitário puro e nomes em tipo não viram actions", () => {
    const imports = action + 'import { desvincularContatoWhatsApp as desfazer } from "@/server/whatsapp/desvincular-contato";import { capacidadesCrm } from "@/server/crm/permissoes";import type { UsuarioSessao } from "@/server/_shared/sessao";type Vinculo = typeof vincular;const capacidades=capacidadesCrm([]);';
    expect(trataFalha(render('<><ConfirmarAcao acao={() => vincular()} /><ConfirmarAcao acao={() => desfazer()} /></>', canonico, imports))).toBe(true);
  });
  it.each([
    ['um caller solto além do delegado', '<><ConfirmarAcao acao={() => vincular()} /><button onClick={() => vincular()}>Outro</button></>'],
    ['outra prop', '<ConfirmarAcao onClick={() => vincular()} />'],
    ['outro componente', '<Outro acao={() => vincular()} />'],
    ['referência em vez de chamada', '<ConfirmarAcao acao={vincular} />'],
    ['block-body não suportado', '<ConfirmarAcao acao={() => { return vincular(); }} />'],
    ['wrapper de promessa', '<ConfirmarAcao acao={() => Promise.resolve(vincular())} />'],
    ['chamada opcional não suportada', '<ConfirmarAcao acao={() => vincular?.()} />'],
    ['callback diferido', '<ConfirmarAcao acao={() => () => vincular()} />'],
    ['referência escapada', '<><ConfirmarAcao acao={() => vincular()} />{vincular}</>'],
  ])("recusa %s", (_nome, jsx) => { expect(trataFalha(render(jsx))).toBe(false); });
  it("não aceita action de valor importada mas sem chamada delegada", () => {
    expect(trataFalha(render(chamada, canonico, action + 'import { desvincularContatoWhatsApp } from "@/server/whatsapp/desvincular-contato";'))).toBe(false);
  });
  it("alias nomeado do componente também fica protegido contra shadowing", () => {
    const componente = 'import { ConfirmarAcao as C } from "@/components/ConfirmarAcao";function inutil(C: unknown){}';
    expect(trataFalha(render('<C acao={() => vincular()} />', componente))).toBe(false);
  });
  it("recusa uma action delegada e outra sem tratamento, inclusive import relativo use-server", () => {
    const imports = action + 'import { desvincularContatoWhatsApp as desfazer } from "../../../server/whatsapp/desvincular-contato";';
    expect(trataFalha(render('<><ConfirmarAcao acao={() => vincular()} /><button onClick={() => desfazer()}>Outro</button></>', canonico, imports))).toBe(false);
  });
  it.each([
    ['módulo não canônico', 'import { ConfirmarAcao } from "@/components/Botao";'],
    ['default não suportado', 'import ConfirmarAcao from "@/components/ConfirmarAcao";'],
    ['namespace não suportado', 'import * as ConfirmarAcao from "@/components/ConfirmarAcao";'],
    ['nome exportado diferente', 'import { Outro as ConfirmarAcao } from "@/components/ConfirmarAcao";'],
    ['import type não é valor', 'import type { ConfirmarAcao } from "@/components/ConfirmarAcao";'],
    ['homônimo local', 'function ConfirmarAcao(){return null;}'],
    ['reexport não cria binding canônico', 'export { ConfirmarAcao } from "@/components/ConfirmarAcao";'],
  ])("recusa componente %s", (_nome, componente) => { expect(trataFalha(render(chamada, componente))).toBe(false); });
  it.each([
    'function inutil(ConfirmarAcao: unknown){}',
    'function inutil({ConfirmarAcao}: {ConfirmarAcao: unknown}){}',
    'function inutil(){ const ConfirmarAcao = Outro; }',
    'function inutil(vincular: unknown){}',
    'function inutil(){ const vincular = Outro; }',
    'const alias = vincular;',
    'const Alias = ConfirmarAcao;',
    `export { vincular };`,
  ])("recusa shadowing/escape mesmo em código não chamado: %s", trecho => {
    expect(trataFalha(render(chamada) + trecho)).toBe(false);
  });
  it("recusa JSX só em texto/comentário, sem uma chamada real delegada", () => {
    expect(trataFalha(`"use client";${canonico}${action}const texto='<ConfirmarAcao acao={() => vincular()} />';/* <ConfirmarAcao acao={() => vincular()} /> */`)).toBe(false);
  });
  it("recusa aliases de action por default/namespace use-server e JSX não canônico", () => {
    expect(trataFalha(render('<ConfirmarAcao acao={() => a.vincularContatoWhatsApp()} />', canonico, `import * as a from "${modulo}";`))).toBe(false);
    expect(trataFalha(render(chamada, canonico, `import vincular from "${modulo}";`))).toBe(false);
  });
  it.each([
    'import a = require("@/server/whatsapp/desvincular-contato");',
    'const modulo = import("@/server/whatsapp/desvincular-contato");',
    'const modulo = require("@/server/whatsapp/desvincular-contato");',
    'export { desvincularContatoWhatsApp } from "@/server/whatsapp/desvincular-contato";',
    'export * from "@/server/whatsapp/desvincular-contato";',
    'const modulo = import(caminhoDinamico);',
  ])("recusa outro carregamento/reexport use-server não delegado: %s", trecho => {
    expect(trataFalha(render(chamada) + trecho)).toBe(false);
  });
  it("loader dinâmico não suportado fica fechado mesmo para utilitário puro", () => {
    expect(trataFalha(render(chamada) + 'const utilitario = import("@/server/crm/permissoes");')).toBe(false);
  });
  it("mantém as heurísticas anteriores e comentários/textos não as fabricam", () => {
    expect(trataFalha('const x=useAcaoCliente({idempotente:false});')).toBe(true);
    expect(trataFalha('executarAcaoCliente(acao);')).toBe(true);
    expect(trataFalha('acao().catch(erro);')).toBe(true);
    expect(trataFalha('try { await acao(); } catch {}')).toBe(true);
    expect(trataFalha('const texto="useAcaoCliente("; // acao().catch(erro)')).toBe(false);
  });
});