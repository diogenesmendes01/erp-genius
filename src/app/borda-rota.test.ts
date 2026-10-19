import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ERROR_SEM_RESET, ROTAS_COM_ERROR, ROTAS_COM_LOADING, SUSPENSE_OBRIGATORIO } from "./borda-rota-mapa";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";

/** Há alguma page.tsx dentro da pasta (em qualquer nível)? */
function temPaginaNaSubarvore(rota: string): boolean {
  return readdirSync(rota, { recursive: true, encoding: "utf8" }).some((c) => basename(c) === "page.tsx");
}

// E10 — borda de rota (docs/43 §6 item 10; docs/42 §3 ganho rápido 2 e §5.3). Trava ESTÁTICA: os
// loading.tsx e error.tsx próprios existem onde a lista fechada diz (e só lá), todo loading.tsx anuncia
// a espera a quem usa leitor de tela, todo error.tsx deixa o erro técnico fora da tela e oferece "Tentar
// de novo", e as telas pesadas isolam a seção lenta num <Suspense> sem tirar o guard do primeiro lugar.
// O formato de cada esqueleto (título não duplicado sob o layout) é conferido pelo render, em
// borda-rota.render.test.ts.

const normaliza = (caminho: string) => caminho.split("\\").join("/");
const arquivosDoApp = (readdirSync("src/app", { recursive: true }) as string[]).map((f) => normaliza(join("src/app", f)));
const pastasCom = (nome: string) => arquivosDoApp.filter((f) => f.endsWith(`/${nome}`)).map((f) => f.slice(0, -nome.length - 1)).sort();
const ler = (arquivo: string) => readFileSync(arquivo, "utf-8");
const fonteTsx = (fonte: string) => ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/**
 * O loading.tsx anuncia a espera: tem `role="status"` ou `aria-busy="true"` num atributo JSX (comentário e
 * string não contam), ou renderiza um Esqueleto* importado pelo nome de @/components/Esqueleto — o anúncio
 * de cada esqueleto exportado é conferido em src/components/Esqueleto.test.ts. Import com alias, ou
 * importado e não renderizado, não conta.
 */
export function anunciaCarregamento(fonte: string): boolean {
  const sf = fonteTsx(fonte);
  const esqueletos = new Set<string>();
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || s.moduleSpecifier.text !== "@/components/Esqueleto") continue;
    const nomeados = s.importClause?.namedBindings;
    if (!nomeados || !ts.isNamedImports(nomeados)) continue;
    for (const e of nomeados.elements) if (!e.propertyName && e.name.text.startsWith("Esqueleto")) esqueletos.add(e.name.text);
  }
  let anuncia = false;
  const visitar = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const nome = n.name.getText(sf), valor = n.initializer.text;
      if ((nome === "role" && valor === "status") || (nome === "aria-busy" && valor === "true")) anuncia = true;
    }
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && esqueletos.has(n.tagName.getText(sf))) anuncia = true;
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return anuncia;
}

/** Rotas da lista sem a página (a rota não existe com esse caminho) ou sem o arquivo de borda. */
export function rotasIncompletas(rotas: readonly string[], arquivo: string, existe: (caminho: string) => boolean, temPaginaAbaixo: (rota: string) => boolean = () => false): string[] {
  // Segmento sem page/layout próprios (ex.: `alunos/`, só com `[id]/`) ainda é rota: o error.tsx dele envolve as
  // páginas filhas. Basta haver uma page.tsx na subárvore.
  return rotas.flatMap((rota) => [
    ...(existe(`${rota}/page.tsx`) || existe(`${rota}/layout.tsx`) || temPaginaAbaixo(rota) ? [] : [`${rota}: rota sem page.tsx nem layout.tsx`]),
    ...(existe(`${rota}/${arquivo}`) ? [] : [`${rota}: sem ${arquivo}`]),
  ]);
}

/**
 * O error.tsx: "use client" na primeira linha (o Next exige), export default function cujo 1º parâmetro é
 * desestruturado SEM `error` (a tela nunca lê message nem digest — achado N1 do relatório) e, salvo
 * exceção, COM `reset`, passado adiante (onClick ou prop `reset=`). Devolve os problemas.
 */
export function problemasDoErro(fonte: string, exigeReset: boolean): string[] {
  const sf = fonteTsx(fonte);
  const problemas: string[] = [];
  if (!/^\s*["']use client["']/.test(fonte)) problemas.push('sem "use client" no topo');
  const padrao = sf.statements.find(
    (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s)
      && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
  );
  if (!padrao) return [...problemas, "sem export default function"];
  const param = padrao.parameters[0];
  const elementos: readonly ts.BindingElement[] | null = !param ? [] : ts.isObjectBindingPattern(param.name) ? param.name.elements : null;
  if (elementos === null) problemas.push("props não desestruturadas — a tela poderia ler props.error");
  else {
    const nomes = elementos.map((e) => (e.propertyName ?? e.name).getText(sf));
    if (nomes.includes("error")) problemas.push("lê `error` — message e digest não vão para a tela");
    if (elementos.some((e) => e.dotDotDotToken)) problemas.push("rest nas props — o erro iria junto");
    if (exigeReset && !nomes.includes("reset")) problemas.push("sem `reset` — falta o \"Tentar de novo\"");
  }
  if (padrao.body && ts.forEachChild(padrao.body, function achaArguments(n): true | undefined {
    return (ts.isIdentifier(n) && n.text === "arguments") || ts.forEachChild(n, achaArguments) ? true : undefined;
  })) problemas.push("lê `arguments`");
  if (exigeReset) {
    let passaReset = false;
    const visitar = (n: ts.Node) => {
      if (ts.isJsxAttribute(n) && ["reset", "onClick"].includes(n.name.getText(sf)) && n.initializer && ts.isJsxExpression(n.initializer)
        && n.initializer.expression && ts.isIdentifier(n.initializer.expression) && n.initializer.expression.text === "reset") passaReset = true;
      if (ts.isPropertyAssignment(n) && n.name.getText(sf) === "onClick" && ts.isIdentifier(n.initializer) && n.initializer.text === "reset") passaReset = true;
      ts.forEachChild(n, visitar);
    };
    visitar(padrao);
    if (!passaReset) problemas.push("`reset` não chega a um onClick (direto ou por <ErroArea reset={reset}>)");
  }
  return problemas;
}

/**
 * A página isola `componente` num <Suspense fallback={…}> (Suspense importado de "react"), e `componente`
 * é uma função `async` de topo do mesmo arquivo — o Server Component que faz a consulta lenta.
 */
export function problemasDoSuspense(fonte: string, componente: string): string[] {
  const sf = fonteTsx(fonte);
  const problemas: string[] = [];
  const importaSuspense = sf.statements.some((s) => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === "react"
    && !!s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings)
    && s.importClause.namedBindings.elements.some((e) => !e.propertyName && e.name.text === "Suspense"));
  if (!importaSuspense) problemas.push('Suspense não vem de import { Suspense } from "react"');
  const declaracao = sf.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === componente);
  if (!declaracao) problemas.push(`${componente} não é uma função de topo do arquivo`);
  else if (!declaracao.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) problemas.push(`${componente} não é async — não há consulta a isolar`);
  let isolado = false;
  const visitar = (n: ts.Node) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "Suspense") {
      const fallback = n.openingElement.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "fallback") as ts.JsxAttribute | undefined;
      const temFallback = !!fallback?.initializer && ts.isJsxExpression(fallback.initializer) && !!fallback.initializer.expression;
      const filhos = n.children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces));
      const filhoDireto = filhos.length === 1 && ts.isJsxSelfClosingElement(filhos[0]) && filhos[0].tagName.getText(sf) === componente;
      if (temFallback && filhoDireto) isolado = true;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  if (!isolado) problemas.push(`<${componente} /> não está sozinho dentro de <Suspense fallback={…}>`);
  // Fora do Suspense, ninguém chama o componente lento: ele seguraria a página de novo.
  const usos: ts.Node[] = [];
  const contar = (n: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(sf) === componente) usos.push(n);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === componente) usos.push(n);
    ts.forEachChild(n, contar);
  };
  contar(sf);
  if (usos.length !== 1) problemas.push(`${componente} usado ${usos.length} vezes — só dentro do <Suspense>`);
  return problemas;
}

describe("borda de rota: listas fechadas (E10)", () => {
  it("a lista de loading.tsx próprios é esta — cópia literal (uma rota não sai num rebase distraído)", () => {
    expect([...ROTAS_COM_LOADING].sort()).toEqual([
      "src/app/(app)",
      "src/app/(app)/academico",
      "src/app/(app)/academico/segundas-chamadas/minhas",
      "src/app/(app)/alunos/(lista)",
      "src/app/(app)/aria",
      "src/app/(app)/carteira",
      "src/app/(app)/comissoes",
      "src/app/(app)/configuracao",
      "src/app/(app)/configuracao/whatsapp",
      "src/app/(app)/contatos",
      "src/app/(app)/diario",
      "src/app/(app)/financeiro/(painel)",
      "src/app/(app)/financeiro/continuidade",
      "src/app/(app)/funil",
      "src/app/(app)/inbox",
      "src/app/(app)/matriculas/[id]",
      "src/app/(app)/matriculas/nova",
      "src/app/(app)/relatorios",
      "src/app/(app)/secretaria",
      "src/app/(app)/tarefas",
      "src/app/certificado/[codigo]",
      "src/app/login",
      "src/app/pagar/[token]",
      "src/app/portal-aluno",
    ]);
  });

  it("a lista de error.tsx próprios é esta — cópia literal", () => {
    expect([...ROTAS_COM_ERROR].sort()).toEqual([
      "src/app/(app)",
      "src/app/(app)/academico",
      "src/app/(app)/alunos",
      "src/app/(app)/aria",
      "src/app/(app)/carteira",
      "src/app/(app)/comissoes",
      "src/app/(app)/configuracao",
      "src/app/(app)/contatos",
      "src/app/(app)/diario",
      "src/app/(app)/empresas",
      "src/app/(app)/financeiro",
      "src/app/(app)/funil",
      "src/app/(app)/inbox",
      "src/app/(app)/matriculas/[id]",
      "src/app/(app)/oportunidades",
      "src/app/(app)/relatorios",
      "src/app/(app)/secretaria",
      "src/app/(app)/tarefas",
      "src/app/certificado/[codigo]",
      "src/app/pagar/[token]",
      "src/app/portal-aluno",
    ]);
    expect(Object.keys(ERROR_SEM_RESET)).toEqual(["src/app/portal-aluno"]);
  });

  it("cada rota da lista existe com esse caminho e tem o seu loading.tsx — o teste falha se o arquivo sumir", () => {
    expect(rotasIncompletas(ROTAS_COM_LOADING, "loading.tsx", existsSync, temPaginaNaSubarvore)).toEqual([]);
  });

  it("cada rota da lista tem o seu error.tsx", () => {
    expect(rotasIncompletas(ROTAS_COM_ERROR, "error.tsx", existsSync, temPaginaNaSubarvore)).toEqual([]);
  });

  it("nenhum loading.tsx ou error.tsx fora da lista: arquivo novo de borda entra no mapa (e no render)", () => {
    expect(pastasCom("loading.tsx")).toEqual([...ROTAS_COM_LOADING].sort());
    expect(pastasCom("error.tsx")).toEqual([...ROTAS_COM_ERROR].sort());
  });

  it("a lista de telas com <Suspense> obrigatório é esta — cópia literal", () => {
    expect(SUSPENSE_OBRIGATORIO.map((s) => `${s.pagina} :: ${s.componente}`)).toEqual([
      "src/app/(app)/academico/reposicoes/page.tsx :: Conteudo",
      "src/app/(app)/matriculas/[id]/preparacao/page.tsx :: PendenciasPreparacao",
    ]);
  });
});

describe("borda de rota: cada arquivo cumpre o padrão", () => {
  it("todo loading.tsx de src/app anuncia a espera (role=\"status\" / aria-busy, direto ou por um Esqueleto*)", () => {
    const mudos = arquivosDoApp.filter((f) => f.endsWith("/loading.tsx")).filter((f) => !anunciaCarregamento(ler(f)));
    expect(mudos).toEqual([]);
  });

  it("todo error.tsx: \"use client\", não lê error (message/digest fora da tela) e leva reset ao \"Tentar de novo\"", () => {
    const problemas = ROTAS_COM_ERROR.flatMap((rota) =>
      problemasDoErro(ler(`${rota}/error.tsx`), !(rota in ERROR_SEM_RESET)).map((p) => `${rota}/error.tsx: ${p}`));
    expect(problemas).toEqual([]);
  });

  it("as telas pesadas isolam a seção lenta num <Suspense>, e o guard da página continua sendo a primeira instrução", () => {
    for (const { pagina, componente } of SUSPENSE_OBRIGATORIO) {
      expect(problemasDoSuspense(ler(pagina), componente), pagina).toEqual([]);
      // exigirSessaoPagina(Papel.X…) como 1ª instrução da página e única recusa (src/test/guard-pagina.ts):
      // nada é buscado antes dele — o componente do <Suspense> só roda depois que a página devolve o JSX.
      expect(papeisDoGuardArquivo(pagina).length, pagina).toBeGreaterThan(0);
    }
  });
});

describe("borda de rota: autoteste dos detectores (fonte virtual)", () => {
  const IMPORTA = 'import { EsqueletoLista } from "@/components/Esqueleto";\n';

  it("loading sem anúncio é pego, inclusive quando o anúncio está só em comentário, string ou import sem uso", () => {
    expect(anunciaCarregamento('export default function L() { return <div className="h-7" />; }')).toBe(false);
    expect(anunciaCarregamento('// role="status"\nexport default function L() { return <div />; }')).toBe(false);
    expect(anunciaCarregamento('const r = \'role="status"\';\nexport default function L() { return <div>{r}</div>; }')).toBe(false);
    expect(anunciaCarregamento(`${IMPORTA}export default function L() { return <div />; }`)).toBe(false);
    expect(anunciaCarregamento('import { EsqueletoLista as X } from "@/components/Esqueleto";\nexport default function L() { return <X rotulo="x" />; }')).toBe(false);
    expect(anunciaCarregamento('import { EsqueletoLista } from "./outro";\nexport default function L() { return <EsqueletoLista rotulo="x" />; }')).toBe(false);
    expect(anunciaCarregamento('export default function L() { return <div role="alert" aria-busy="false" />; }')).toBe(false);
    expect(anunciaCarregamento('export default function L() { return <p role={"status"}>Carregando</p>; }')).toBe(false);
  });

  it("loading com anúncio passa: role=\"status\", aria-busy=\"true\" ou um Esqueleto* renderizado", () => {
    expect(anunciaCarregamento('export default function L() { return <p role="status">Carregando…</p>; }')).toBe(true);
    expect(anunciaCarregamento('export default function L() { return <div aria-busy="true" />; }')).toBe(true);
    expect(anunciaCarregamento(`${IMPORTA}export default function L() { return <EsqueletoLista rotulo="alunos" />; }`)).toBe(true);
  });

  it("rota da lista sem o arquivo de borda, ou que não existe com esse caminho, é pega", () => {
    const disco = new Set(["src/app/a/page.tsx", "src/app/a/loading.tsx", "src/app/b/page.tsx", "src/app/c/layout.tsx", "src/app/c/loading.tsx"]);
    const existe = (c: string) => disco.has(c);
    expect(rotasIncompletas(["src/app/a", "src/app/c"], "loading.tsx", existe)).toEqual([]);
    expect(rotasIncompletas(["src/app/b"], "loading.tsx", existe)).toEqual(["src/app/b: sem loading.tsx"]);
    expect(rotasIncompletas(["src/app/zz"], "loading.tsx", existe)).toEqual(["src/app/zz: rota sem page.tsx nem layout.tsx", "src/app/zz: sem loading.tsx"]);
    // Segmento só com subpastas (ex.: `alunos/` com `[id]/page.tsx`) conta como rota; pasta sem página abaixo, não.
    const comFilha = (r: string) => r === "src/app/d";
    expect(rotasIncompletas(["src/app/d"], "loading.tsx", existe, comFilha)).toEqual(["src/app/d: sem loading.tsx"]);
    expect(rotasIncompletas(["src/app/zz"], "loading.tsx", existe, comFilha)).toEqual(["src/app/zz: rota sem page.tsx nem layout.tsx", "src/app/zz: sem loading.tsx"]);
  });

  it("error.tsx que lê o erro, sem reset, sem \"use client\" ou que não liga o reset é pego", () => {
    const ok = '"use client";\nexport default function E({ reset }: { reset: () => void }) { return <ErroArea reset={reset} />; }';
    expect(problemasDoErro(ok, true)).toEqual([]);
    expect(problemasDoErro('"use client";\nexport default function E({ reset }: any) { return <button onClick={reset}>Tentar de novo</button>; }', true)).toEqual([]);
    expect(problemasDoErro('"use client";\nexport default function E({ reset }: any) { return <EstadoRota acao={{ onClick: reset, rotulo: "Tentar de novo" }} />; }', true)).toEqual([]);
    expect(problemasDoErro(ok.replace('"use client";\n', ""), true)).toEqual(['sem "use client" no topo']);
    expect(problemasDoErro('"use client";\nexport default function E({ error, reset }: any) { return <p onClick={reset}>{error.message}</p>; }', true))
      .toEqual(["lê `error` — message e digest não vão para a tela"]);
    expect(problemasDoErro('"use client";\nexport default function E(props: any) { return <p onClick={props.reset}>{props.error.digest}</p>; }', true))
      .toContain("props não desestruturadas — a tela poderia ler props.error");
    expect(problemasDoErro('"use client";\nexport default function E({ reset }: any) { return <p>{arguments[0].error.message}</p>; }', true))
      .toEqual(["lê `arguments`", "`reset` não chega a um onClick (direto ou por <ErroArea reset={reset}>)"]);
    expect(problemasDoErro('"use client";\nexport default function E({ reset, ...resto }: any) { return <p onClick={reset}>{resto.error.message}</p>; }', true))
      .toEqual(["rest nas props — o erro iria junto"]);
    expect(problemasDoErro('"use client";\nexport default function E() { return <p>Erro</p>; }', true))
      .toEqual(["sem `reset` — falta o \"Tentar de novo\"", "`reset` não chega a um onClick (direto ou por <ErroArea reset={reset}>)"]);
    expect(problemasDoErro('"use client";\nexport default function E() { return <a href="/entrar">Entrar de novo</a>; }', false)).toEqual([]);
  });

  it("Suspense ausente, componente fora dele, componente síncrono ou chamado também fora é pego", () => {
    const base = (corpo: string, lento = "async function Lento() { return null; }") =>
      `import { Suspense } from "react";\nexport default async function P() { await g(); return <div>${corpo}</div>; }\n${lento}`;
    expect(problemasDoSuspense(base("<Suspense fallback={<p role=\"status\">…</p>}><Lento /></Suspense>"), "Lento")).toEqual([]);
    expect(problemasDoSuspense(base("<Lento />"), "Lento")).toEqual(["<Lento /> não está sozinho dentro de <Suspense fallback={…}>"]);
    expect(problemasDoSuspense(base("<Suspense><Lento /></Suspense>"), "Lento")).toEqual(["<Lento /> não está sozinho dentro de <Suspense fallback={…}>"]);
    expect(problemasDoSuspense(base("<Suspense fallback={null}><Lento /></Suspense>", "function Lento() { return null; }"), "Lento"))
      .toEqual(["Lento não é async — não há consulta a isolar"]);
    expect(problemasDoSuspense(base("<Suspense fallback={null}><Lento /></Suspense><Lento />"), "Lento"))
      .toEqual(["Lento usado 2 vezes — só dentro do <Suspense>"]);
    expect(problemasDoSuspense(base("<Suspense fallback={null}><Lento /></Suspense>").replace('import { Suspense } from "react";\n', "const Suspense = (p: any) => p.children;\n"), "Lento"))
      .toEqual(['Suspense não vem de import { Suspense } from "react"']);
  });
});
