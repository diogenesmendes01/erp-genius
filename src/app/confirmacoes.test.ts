import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ACOES_CONFIRMADAS, EXCECOES_CONFIRMACAO } from "./confirmacoes-mapa";

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
// - nenhum outro arquivo de src/app e src/components importa a action; nenhum window.confirm no app.
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
 * Verifica um fonte TSX contra as actions de um arquivo da lista (`acoes`: nome exportado → módulo).
 * Cada referência a uma action importada (por qualquer nome local) é "dentro" só quando o atributo JSX mais
 * próximo acima dela é `acao` de um elemento cuja tag é um nome importado de "@/components/ConfirmarAcao"
 * como ConfirmarAcao.
 */
export function verificarConfirmacoes(fonte: string, acoes: Record<string, string>): VerificacaoConfirmacao {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const problemas: string[] = [];
  const nomesConfirmar = new Set<string>();
  const local = new Map<string, string>(); // nome local → action
  const modulos = new Set(Object.values(acoes));
  const declaracoesDeImport = new Set<ts.Node>();

  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    const modulo = s.moduleSpecifier.text;
    const clausula = s.importClause;
    if (!clausula || clausula.isTypeOnly) continue;
    const ligacoes = clausula.namedBindings;
    if (ligacoes && ts.isNamespaceImport(ligacoes) && modulos.has(modulo)) problemas.push(`import do módulo inteiro de ${modulo} (${ligacoes.name.text}): chamadas não verificáveis`);
    if (!ligacoes || !ts.isNamedImports(ligacoes)) continue;
    for (const e of ligacoes.elements) {
      if (e.isTypeOnly) continue;
      const exportado = (e.propertyName ?? e.name).text;
      if (modulo === MODULO_DO_COMPONENTE && exportado === "ConfirmarAcao") nomesConfirmar.add(e.name.text);
      if (acoes[exportado] === modulo) {
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
  const naConfirmacao: Record<string, number> = Object.fromEntries(Object.keys(acoes).map((a) => [a, 0]));

  const visitar = (n: ts.Node) => {
    // require("...") e import("...") do módulo de uma action: a referência some do AST.
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]) && modulos.has(n.arguments[0].text)
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === "require"))) {
      problemas.push(`carga dinâmica de ${n.arguments[0].text}: chamadas não verificáveis`);
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
      const dentro = !!atributo && atributo.name.getText(sf) === "acao" && !!elemento && ehConfirmar(elemento.tagName);
      if (dentro) naConfirmacao[acao]++;
      else fora.push(trechoDaReferencia(n, sf));
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { fora, naConfirmacao, problemas };
}

/** Confere as referências fora da confirmação contra as exceções: cada exceção casa com exatamente uma. */
export function conferirExcecoesConfirmacao(fora: string[], trechos: string[]): { semExcecao: string[]; soltas: string[] } {
  const restantes = [...fora];
  const soltas: string[] = [];
  for (const t of trechos) {
    const casos = restantes.filter((f) => f === t).length;
    if (casos !== 1) { soltas.push(`${t} (casa com ${casos})`); continue; }
    restantes.splice(restantes.indexOf(t), 1);
  }
  return { semExcecao: restantes, soltas };
}

/**
 * window.confirm (e as formas que escondem o nome) num fonte: a confirmação do app é o <ConfirmarAcao>.
 * Falha fechada: todo identificador `confirm` acusa — chamada solta, referência guardada numa variável,
 * desestruturação, `window.confirm`/`globalThis.confirm`/`self.confirm` (também entre parênteses) —, menos
 * quando é só o nome de uma propriedade de outro objeto (`pagamento.confirm()`, `{ confirm: true }`).
 * Acesso por colchete a um global com a chave "confirm" ou com chave calculada também acusa.
 */
export function confirmacoesNativas(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const GLOBAIS = new Set(["window", "globalThis", "self", "top", "parent", "frames"]);
  const semParenteses = (e: ts.Expression): ts.Expression =>
    ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) ? semParenteses(e.expression) : e;
  const ehGlobal = (e: ts.Expression) => { const x = semParenteses(e); return ts.isIdentifier(x) && GLOBAIS.has(x.text); };
  const achados: string[] = [];
  const registrar = (n: ts.Node) => achados.push(normaliza(n.getText(sf)).slice(0, 80));
  const visitar = (n: ts.Node) => {
    if (ts.isIdentifier(n) && n.text === "confirm") {
      const p = n.parent;
      const soNomeDePropriedade =
        (ts.isPropertyAccessExpression(p) && p.name === n && !ehGlobal(p.expression))
        || ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodSignature(p) || ts.isPropertyDeclaration(p)) && p.name === n)
        || (ts.isJsxAttribute(p) && p.name === n);
      if (!soNomeDePropriedade) registrar(p);
    }
    if (ts.isElementAccessExpression(n) && ehGlobal(n.expression)) {
      const chave = n.argumentExpression;
      if (!ts.isStringLiteralLike(chave) || chave.text === "confirm") registrar(n);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Arquivos fora da lista que importam uma action dela (por nome, ou o módulo inteiro dela). */
export function importacoesForaDaLista(fonte: string, acoes: { modulo: string; acao: string }[]): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const modulos = new Set(acoes.map((a) => a.modulo));
  const visitar = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.importClause && !n.importClause.isTypeOnly) {
      const modulo = n.moduleSpecifier.text;
      const ligacoes = n.importClause.namedBindings;
      if (ligacoes && ts.isNamespaceImport(ligacoes) && modulos.has(modulo)) achados.push(`* as ${ligacoes.name.text} from ${modulo}`);
      if (ligacoes && ts.isNamedImports(ligacoes)) {
        for (const e of ligacoes.elements) {
          const exportado = (e.propertyName ?? e.name).text;
          if (!e.isTypeOnly && acoes.some((a) => a.modulo === modulo && a.acao === exportado)) achados.push(`${exportado} from ${modulo}`);
        }
      }
    }
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]) && modulos.has(n.arguments[0].text)
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === "require"))) {
      achados.push(`carga dinâmica de ${n.arguments[0].text}`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

const FONTES = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

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
      const { fora, naConfirmacao, problemas } = verificarConfirmacoes(readFileSync(arquivo, "utf-8"), acoes);
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

  it("nenhum outro arquivo de src/app ou src/components importa uma ação da lista (nem o módulo inteiro dela)", () => {
    const ofensas = FONTES.flatMap(({ arquivo, conteudo }) => {
      const daqui = COPIA_ACOES.filter((a) => a.arquivo !== arquivo);
      const permitidas = new Set(COPIA_ACOES.filter((a) => a.arquivo === arquivo).map((a) => `${a.acao} from ${a.modulo}`));
      return importacoesForaDaLista(conteudo, daqui).filter((i) => !permitidas.has(i)).map((i) => `${arquivo}: ${i}`);
    });
    expect(ofensas).toEqual([]);
  });

  it("nenhum window.confirm no app: a confirmação é o <ConfirmarAcao>", () => {
    const ofensas = FONTES.flatMap(({ arquivo, conteudo }) => confirmacoesNativas(conteudo).map((c) => `${arquivo}: ${c}`));
    expect(ofensas).toEqual([]);
  });

  it("a varredura acha as telas e o componente (o glob não ficou vazio)", () => {
    const arquivos = FONTES.map((f) => f.arquivo);
    expect(arquivos).toEqual(expect.arrayContaining(["src/components/ConfirmarAcao.tsx", ...COPIA_ACOES.map((a) => a.arquivo)]));
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

  it("E1 — chamada direta no clique acusa", () => {
    expect(v(`return <button onClick={() => enviar(id)}>Cobrar</button>;`).fora).toEqual(["enviar(id)"]);
  });

  it("E2 — import com outro nome continua sendo a ação", () => {
    const r = v(`return <button onClick={() => mandar(id)}>Cobrar</button>;`, `import { enviar as mandar } from "${M}";\n`);
    expect(r.fora).toEqual(["mandar(id)"]);
    expect(r.naConfirmacao).toEqual({ enviar: 0 });
  });

  it("E3 — referência solta (sem chamada), passada como valor ou em propriedade abreviada, acusa", () => {
    expect(v(`return <button onClick={enviar}>Cobrar</button>;`).fora).toHaveLength(1);
    expect(v(`const f = enviar; return null;`).fora).toHaveLength(1);
    expect(v(`const o = { enviar }; return null;`).fora).toHaveLength(1);
    expect(v(`return null; } export { enviar }; function Z() {`).fora).toHaveLength(1);
  });

  it("E4 — prop `acao` de OUTRO componente não é confirmação", () => {
    expect(v(`return <Outro acao={() => enviar(id)} />;`).fora).toEqual(["enviar(id)"]);
  });

  it("E5 — outra prop do próprio ConfirmarAcao (aoConcluir, children) não é a confirmação", () => {
    expect(v(`return <ConfirmarAcao acao={async () => ({ ok: true })} aoConcluir={() => enviar(id)} />;`).fora).toEqual(["enviar(id)"]);
    expect(v(`return <ConfirmarAcao acao={async () => ({ ok: true })}>{ok && enviar(id)}</ConfirmarAcao>;`).fora).toEqual(["enviar(id)"]);
  });

  it("E6 — ConfirmarAcao declarado no arquivo (não importado do componente) não vale", () => {
    const cab = `import { enviar } from "${M}";\nconst ConfirmarAcao = (p: { acao: () => unknown }) => { p.acao(); return null; };\n`;
    expect(v(`return <ConfirmarAcao acao={() => enviar(id)} />;`, cab).fora).toEqual(["enviar(id)"]);
    const deOutroModulo = `import { ConfirmarAcao } from "@/components/Outro";\nimport { enviar } from "${M}";\n`;
    expect(v(`return <ConfirmarAcao acao={() => enviar(id)} />;`, deOutroModulo).fora).toEqual(["enviar(id)"]);
  });

  it("E7 — ConfirmarAcao importado com outro nome é seguido (e só ele)", () => {
    const cab = `import { ConfirmarAcao as Confirmar } from "@/components/ConfirmarAcao";\nimport { enviar } from "${M}";\n`;
    expect(v(`return <Confirmar acao={() => enviar(id)} />;`, cab)).toEqual({ fora: [], naConfirmacao: { enviar: 1 }, problemas: [] });
    expect(v(`return <ConfirmarAcao acao={() => enviar(id)} />;`, cab).fora).toEqual(["enviar(id)"]);
  });

  it("E8 — função intermediária: a chamada fora da prop acusa, mesmo que a função vá para a prop", () => {
    expect(v(`const disparar = () => enviar(id); return <ConfirmarAcao acao={disparar} />;`).fora).toEqual(["enviar(id)"]);
  });

  it("E9 — atributo JSX mais próximo decide: elemento dentro da prop `acao` com a chamada noutra prop acusa", () => {
    expect(v(`return <ConfirmarAcao acao={() => <Outro onClick={() => enviar(id)} />} />;`).fora).toEqual(["enviar(id)"]);
  });

  it("E10 — import do módulo inteiro, import dinâmico e require não são verificáveis", () => {
    expect(v(`return null;`, `import * as acoes from "${M}";\nimport { enviar } from "${M}";\n`).problemas).toEqual([`import do módulo inteiro de ${M} (acoes): chamadas não verificáveis`]);
    expect(v(`void import("${M}"); return null;`).problemas).toEqual([`carga dinâmica de ${M}: chamadas não verificáveis`]);
    expect(v(`require("${M}"); return null;`).problemas).toEqual([`carga dinâmica de ${M}: chamadas não verificáveis`]);
  });

  it("E11 — spread num ConfirmarAcao não é verificável", () => {
    expect(v(`const p = {}; return <ConfirmarAcao {...p} acao={() => enviar(id)} />;`).problemas).toEqual(["<ConfirmarAcao> com spread: props não verificáveis"]);
  });

  it("E12 — ação da lista que o arquivo não importa (removida ou renomeada) acusa", () => {
    expect(v(`return null;`, `import { ConfirmarAcao } from "@/components/ConfirmarAcao";\n`).problemas).toEqual([`a ação "enviar" não é importada de ${M} (lista desatualizada?)`]);
    // Mesmo nome, outro módulo: não é a ação da lista.
    expect(v(`return null;`, `import { enviar } from "@/server/outro";\n`).problemas).toHaveLength(1);
  });

  it("E13 — nome com escape unicode no fonte é o mesmo identificador", () => {
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

  it("sem nenhuma referência na confirmação, a contagem fica 0 (a trava exige ≥ 1)", () => {
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
    expect(confirmacoesNativas(`const { confirm: c } = window; c("x");`)).toHaveLength(1);
    expect(confirmacoesNativas(`\\u0063onfirm("x");`)).toHaveLength(1); // escape unicode no nome
  });

  it("nome de propriedade de outro objeto não é o nativo", () => {
    expect(confirmacoesNativas(`pagamento.confirm(); const o = { confirm: true }; const confirmar = () => 1; window.location.reload();`)).toEqual([]);
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
});
