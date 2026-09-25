import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstadoVazio, EstadoVazioLinha } from "@/components/EstadoVazio";

// Trava do estado vazio (docs/42-auditoria-frontend-ux.md, E1): havia mais de 200 textos de "nada
// aqui" em texto cru, cada um com uma cor. Agora, o que a tela mostra quando uma lista está vazia
// é <EstadoVazio> (ou <EstadoVazioLinha> numa tabela).
//
// "Lista vazia" é reconhecida pela condição, não pelo texto: `!x.length && …`, `x.length === 0 ? … : …`,
// `x.length ? … : …` (o ramo falso), `if (!x.length) return …`. Em cada ramo que a tela mostra
// para a lista vazia, toda folha JSX tem de ser EstadoVazio/EstadoVazioLinha e nenhuma folha pode
// ser texto solto. As exceções são nomeadas abaixo, com o motivo.
//
// Fora do alcance (declarado): vazio decidido por outra condição (`total === 0`, `!dados`), que a
// sintaxe não liga a uma lista.

const RAIZES = ["src/app", "src/components"];

// Ramo de "lista vazia" que não é estado vazio. Chave: arquivo; valor: trecho do ramo.
const NAO_SAO_ESTADO_VAZIO: Record<string, string[]> = {
  // Veredito positivo de uma conferência ("nada impede"), não lista sem itens.
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/PreviaAgenda.tsx": ["Nenhum impedimento encontrado"],
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/PreviaSubstituicao.tsx": ["Nenhum impedimento identificado"],
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/propostas/page.tsx": ["Conferência de origem sem pendências"],
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/Formulario.tsx": ["Não há pendência apontada"],
  "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/Formulario.tsx": ["Não há período não letivo afetado", "Não há professor elegível"],
  "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/page.tsx": ["Não há período não letivo afetado"],
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx": ["Não há período não letivo afetado"],
  "src/app/(app)/academico/calendario/novo/PrepararCalendario.tsx": ["A proposta não contém períodos não letivos"],
  "src/app/(app)/matriculas/[id]/preparacao/page.tsx": ["Conferências básicas atendidas"],
  "src/app/(app)/matriculas/[id]/desistencia/page.tsx": ["Nenhum avanço formal identificado"],
  "src/app/(app)/matriculas/[id]/compensacoes/[cobrancaId]/CompensacaoCobertura.tsx": ["Todos os dias confirmados"],
  "src/app/(app)/home/HomeVendedor.tsx": ["IconCircleCheck"],
  // Aviso de configuração (cor de alerta), não lista sem itens.
  "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx": ["Lista vazia = ninguém recebe"],
  // Painel do copiloto: paleta própria (ai-*), fora do visual das listas.
  "src/components/CopilotoSugestoes.tsx": ["Sem sugestões pendentes"],
  // Sem itens, a tela mostra o passo seguinte (confirmação/formulário), não uma mensagem.
  "src/app/(app)/leads/[id]/contratacao/AgendaParticularFormulario.tsx": ["<label"],
  "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx": ["<form"],
  "src/app/(app)/matriculas/[id]/contrato/aditivos/agenda/ConferenciaAgendaFormulario.tsx": ["<RegistrarFotografia"],
  // Dica curta dentro de uma linha de checkboxes do formulário.
  "src/app/(app)/configuracao/paises/PaisesPainel.tsx": ["Cadastre produtos no Catálogo"],
};

const COMPONENTES_DE_VAZIO = new Set(["EstadoVazio", "EstadoVazioLinha"]);
const SO_LAYOUT = /^-?m[trblxy]?-\S+$/;

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
  return e;
}

/** `.length` de uma lista (não de texto: `x.trim().length` fica fora). */
function ehTamanho(e: ts.Expression): boolean {
  e = desembrulha(e);
  if (!ts.isPropertyAccessExpression(e) || e.name.text !== "length") return false;
  const alvo = desembrulha(e.expression);
  return !(ts.isCallExpression(alvo) && ts.isPropertyAccessExpression(alvo.expression) && /^(trim|trimStart|trimEnd)$/.test(alvo.expression.name.text));
}

/** true: a condição vale quando a lista está vazia; false: quando não está; null: não é teste de tamanho. */
export function testeDeVazio(e: ts.Expression): boolean | null {
  e = desembrulha(e);
  const K = ts.SyntaxKind;
  if (ts.isPrefixUnaryExpression(e) && e.operator === K.ExclamationToken) {
    const r = testeDeVazio(e.operand);
    return r === null ? null : !r;
  }
  if (ehTamanho(e)) return false;
  if (ts.isBinaryExpression(e) && ehTamanho(e.left)) {
    const direita = desembrulha(e.right);
    if (!ts.isNumericLiteral(direita)) return null;
    const n = Number(direita.text), op = e.operatorToken.kind;
    if (n === 0 && [K.EqualsEqualsEqualsToken, K.EqualsEqualsToken, K.LessThanEqualsToken].includes(op)) return true;
    if (n === 1 && op === K.LessThanToken) return true;
    if (n === 0 && [K.GreaterThanToken, K.ExclamationEqualsEqualsToken, K.ExclamationEqualsToken].includes(op)) return false;
    if (n === 1 && op === K.GreaterThanEqualsToken) return false;
  }
  return null;
}

type Achado = { linha: number; ramo: string; problema: string };

/** As folhas que o ramo mostra: JSX e texto, atravessando &&, || e ternários. */
function folhas(e: ts.Expression): ts.Expression[] {
  e = desembrulha(e);
  if (ts.isConditionalExpression(e)) return [...folhas(e.whenTrue), ...folhas(e.whenFalse)];
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) {
    return e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? folhas(e.right) : [...folhas(e.left), ...folhas(e.right)];
  }
  return [e];
}

function textoVisivel(e: ts.Node): string {
  if (ts.isJsxText(e)) return e.text;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isJsxAttributes(e)) return "";
  let t = "";
  ts.forEachChild(e, (c) => { t += textoVisivel(c); });
  // Expressão não literal ({nome}) pode mostrar texto.
  if (ts.isJsxExpression(e) && e.expression && !ts.isStringLiteral(e.expression) && !ts.isConditionalExpression(e.expression)) t += "x";
  return t;
}

function nomeDaTag(e: ts.Expression, sf: ts.SourceFile): string | null {
  if (ts.isJsxElement(e)) return e.openingElement.tagName.getText(sf);
  if (ts.isJsxSelfClosingElement(e)) return e.tagName.getText(sf);
  return null;
}

/** Ramos de "lista vazia" cuja folha não é EstadoVazio. */
export function vaziosCrus(fonte: string, arquivo = "x.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: Achado[] = [];
  // Texto solto só conta quando o vazio aparece como elemento: `{xs.length ? <ul/> : "Nada."}` ou
  // `{!xs.length && "Nada."}`. Com os dois lados texto, é frase (`Campos: a, b` × `nenhum`).
  const confere = (ramo: ts.Expression, textoConta: boolean) => {
    for (const folha of folhas(ramo)) {
      const linha = sf.getLineAndCharacterOfPosition(folha.getStart(sf)).line + 1;
      const texto = folha.getText(sf).replace(/\s+/g, " ").slice(0, 120);
      if (ts.isJsxFragment(folha)) {
        // Fragmento: cada filho JSX conta como folha.
        for (const filho of folha.children) {
          if (ts.isJsxText(filho) && filho.getText(sf).trim()) achados.push({ linha, ramo: texto, problema: "texto solto no fragmento" });
          if ((ts.isJsxElement(filho) || ts.isJsxSelfClosingElement(filho)) && !COMPONENTES_DE_VAZIO.has(nomeDaTag(filho, sf)!)) achados.push({ linha, ramo: filho.getText(sf).replace(/\s+/g, " ").slice(0, 120), problema: `<${nomeDaTag(filho, sf)}>` });
          if (ts.isJsxExpression(filho) && filho.expression) confere(filho.expression, true);
        }
        continue;
      }
      const tag = nomeDaTag(folha, sf);
      if (tag !== null) {
        // Marcador sem letras (`<div>—</div>` num indicador) não é mensagem. Componente
        // (`<Resumo />`) pode mostrar texto: sempre conta.
        const marcador = /^[a-z]/.test(tag) && !/\p{L}/u.test(textoVisivel(folha));
        if (!COMPONENTES_DE_VAZIO.has(tag) && !marcador) achados.push({ linha, ramo: texto, problema: `<${tag}>` });
        continue;
      }
      if (textoConta && (ts.isStringLiteral(folha) || ts.isNoSubstitutionTemplateLiteral(folha) || ts.isTemplateExpression(folha)) && /\p{L}/u.test(folha.getText(sf))) {
        achados.push({ linha, ramo: texto, problema: "texto solto" });
      }
    }
  };
  const temJsx = (e: ts.Expression) => folhas(e).some((f) => ts.isJsxElement(f) || ts.isJsxSelfClosingElement(f) || ts.isJsxFragment(f));
  const pai = (n: ts.Node) => { let p = n.parent; while (p && (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) || ts.isBinaryExpression(p))) p = p.parent; return p; };
  // Ramo em JSX: só vale quando a expressão é filho JSX (o que a tela mostra), não um cálculo.
  const emJsx = (n: ts.Node) => {
    let p = n.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) || ts.isBinaryExpression(p))) p = p.parent;
    return !!p && (ts.isJsxExpression(p) || ts.isReturnStatement(p) || ts.isArrowFunction(p));
  };
  const visita = (n: ts.Node) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && testeDeVazio(n.left) === true && emJsx(n)) confere(n.right, ts.isJsxExpression(pai(n)!));
    if (ts.isConditionalExpression(n) && emJsx(n)) {
      const t = testeDeVazio(n.condition);
      const outroLadoJsx = t === true ? temJsx(n.whenFalse) : temJsx(n.whenTrue);
      if (t === true) confere(n.whenTrue, outroLadoJsx);
      if (t === false) confere(n.whenFalse, outroLadoJsx);
    }
    if (ts.isIfStatement(n) && testeDeVazio(n.expression) === true) {
      const corpo = n.thenStatement;
      const retorno = ts.isReturnStatement(corpo) ? corpo : ts.isBlock(corpo) ? corpo.statements.find(ts.isReturnStatement) : undefined;
      if (retorno?.expression && temJsx(retorno.expression)) confere(retorno.expression, true);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** className de <EstadoVazio> que não é só posição. */
export function aparenciaForaDoComponente(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const erros: string[] = [];
  const visita = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && COMPONENTES_DE_VAZIO.has(n.tagName.getText(sf))) {
      for (const a of n.attributes.properties) {
        if (ts.isJsxSpreadAttribute(a)) { erros.push(`spread em <${n.tagName.getText(sf)}>`); continue; }
        if (a.name.getText(sf) !== "className") continue;
        const ini = a.initializer;
        if (!ini || !ts.isStringLiteral(ini)) { erros.push(`className dinâmico: ${a.getText(sf)}`); continue; }
        const fora = ini.text.split(/\s+/).filter((c) => c && !SO_LAYOUT.test(c));
        if (fora.length) erros.push(`className fora de posição: ${fora.join(" ")}`);
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return erros;
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

describe("EstadoVazio — componente", () => {
  it("compacto por padrão; bloco tracejado e centralizado para a lista principal", () => {
    const compacto = renderToStaticMarkup(EstadoVazio({ children: "Nenhuma turma." }));
    expect(compacto).toBe('<div data-estado-vazio="" class="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500"><p>Nenhuma turma.</p></div>');
    const bloco = renderToStaticMarkup(EstadoVazio({ bloco: true, children: "Nenhuma turma." }));
    expect(bloco).toBe('<div data-estado-vazio="" class="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500"><p>Nenhuma turma.</p></div>');
  });

  it("a ação (próximo passo) vem depois da mensagem; margem de posição e role são repassados", () => {
    const html = renderToStaticMarkup(EstadoVazio({ bloco: true, className: "mt-4", role: "status", "aria-busy": true, acao: createElement("a", { href: "/novo" }, "Criar"), children: "Nada." }));
    expect(html).toBe('<div data-estado-vazio="" class="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 mt-4" role="status" aria-busy="true"><p>Nada.</p><div class="mt-3 flex flex-wrap justify-center gap-2"><a href="/novo">Criar</a></div></div>');
    expect(renderToStaticMarkup(EstadoVazio({ acao: createElement("a", { href: "/novo" }, "Criar"), children: "Nada." }))).toContain('<p>Nada.</p><div class="mt-2 flex flex-wrap gap-2"><a href="/novo">Criar</a></div>');
  });

  it("na tabela: uma linha que ocupa todas as colunas", () => {
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, EstadoVazioLinha({ colSpan: 5, children: "Nenhum aluno." }))));
    expect(html).toBe('<table><tbody><tr><td colSpan="5" data-estado-vazio="" class="px-4 py-8 text-center text-sm text-gray-500"><p>Nenhum aluno.</p></td></tr></tbody></table>');
  });
});

describe("detector de lista vazia (autoteste)", () => {
  const cru = (corpo: string) => vaziosCrus(`export function T({ xs, ys, t }: any) { ${corpo} }`).map((a) => a.problema);

  it("acusa texto cru em cada forma de condição de lista vazia", () => {
    expect(cru("return <div>{!xs.length && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length === 0 && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length < 1 ? <p>Nada.</p> : null}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length ? <ul /> : <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length > 0 ? <ul /> : <div>Nada.</div>}</div>;")).toEqual(["<div>"]);
    expect(cru("return <div>{!!xs.length ? <ul /> : <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs?.length ? <ul /> : <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <table><tbody>{xs.length === 0 ? <tr><td>Nada.</td></tr> : null}</tbody></table>;")).toEqual(["<tr>"]);
    expect(cru("if (!xs.length) return <p>Nada.</p>; return <ul />;")).toEqual(["<p>"]);
    expect(cru("if (xs.length === 0) { return (<section><p>Nada.</p></section>); } return <ul />;")).toEqual(["<section>"]);
  });

  it("atravessa condições aninhadas, fragmentos e texto solto", () => {
    expect(cru("return <div>{xs.length ? <ul /> : t && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length ? <ul /> : t ? <EstadoVazio>A</EstadoVazio> : <p>B</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{!xs.length && <><EstadoVazio>A</EstadoVazio><p>B</p></>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{!xs.length && <>Nada.</>}</div>;")).toEqual(["texto solto no fragmento"]);
    expect(cru('return <p>{xs.length ? <ul /> : "Nada."}</p>;')).toEqual(["texto solto"]);
    expect(cru("return <p>{xs.length ? <ul /> : `Nada de ${t}.`}</p>;")).toEqual(["texto solto"]);
    expect(cru('return <div>{!xs.length && "Nada."}</div>;')).toEqual(["texto solto"]);
    expect(cru("return <div>{!xs.length && <p>{t}</p>}</div>;")).toEqual(["<p>"]);
  });

  it("frase com os dois lados em texto, função que devolve texto e marcador sem letras não são estado vazio", () => {
    expect(cru('return <p>Informes: {xs.length ? xs.join(", ") : "nenhum"}.</p>;')).toEqual([]);
    expect(cru('return xs.length ? xs.join(" · ") : "Resumo limpo";')).toEqual([]);
    expect(cru('return <div>{xs.length === 0 ? <div className="text-2xl">—</div> : <b>{xs.length}</b>}</div>;')).toEqual([]);
    // Componente sem filhos pode mostrar texto: conta.
    expect(cru("return <div>{!xs.length && <Aviso tipo={t} />}</div>;")).toEqual(["<Aviso>"]);
  });

  it("aceita EstadoVazio/EstadoVazioLinha, nulo e marcadores sem letras; ignora texto e cálculo", () => {
    expect(cru("return <div>{!xs.length && <EstadoVazio>Nada.</EstadoVazio>}</div>;")).toEqual([]);
    expect(cru("return <div>{xs.length ? <ul /> : <EstadoVazio bloco>Nada.</EstadoVazio>}</div>;")).toEqual([]);
    expect(cru("return <table><tbody>{!xs.length && <EstadoVazioLinha colSpan={3}>Nada.</EstadoVazioLinha>}</tbody></table>;")).toEqual([]);
    expect(cru("if (!xs.length) return <EstadoVazio>Nada.</EstadoVazio>; return <ul />;")).toEqual([]);
    expect(cru('return <td>{xs.length ? xs.join(", ") : "—"}</td>;')).toEqual([]);
    expect(cru("return <div>{xs.length ? <ul /> : null}</div>;")).toEqual([]);
    expect(cru("if (!xs.length) return null; return <ul />;")).toEqual([]);
    // Texto digitado não é lista; conta calculada não é tela.
    expect(cru("return <div>{t.trim().length === 0 && <p>Escreva algo.</p>}</div>;")).toEqual([]);
    expect(cru("const r = xs.length ? 1 : 2; return <p>{r}</p>;")).toEqual([]);
    // Ramo verdadeiro de uma lista com itens não é o vazio.
    expect(cru("return <div>{xs.length > 0 && <ul><li>a</li></ul>}</div>;")).toEqual([]);
  });

  it("className de EstadoVazio: só posição", () => {
    expect(aparenciaForaDoComponente('<EstadoVazio className="mt-4">A</EstadoVazio>')).toEqual([]);
    expect(aparenciaForaDoComponente('<EstadoVazio className="mt-4 text-gray-400">A</EstadoVazio>')).toEqual(["className fora de posição: text-gray-400"]);
    expect(aparenciaForaDoComponente("<EstadoVazio className={c}>A</EstadoVazio>")).toHaveLength(1);
    expect(aparenciaForaDoComponente("<EstadoVazio {...p}>A</EstadoVazio>")).toHaveLength(1);
  });
});

describe("estados vazios nas telas", () => {
  const todas = telas();

  it("todo ramo de lista vazia mostra EstadoVazio (ou está nas exceções nomeadas)", () => {
    const usadas = new Set<string>();
    const crus: string[] = [];
    for (const { arquivo, fonte } of todas) {
      for (const a of vaziosCrus(fonte, arquivo)) {
        const excecao = (NAO_SAO_ESTADO_VAZIO[arquivo] ?? []).find((trecho) => a.ramo.includes(trecho));
        if (excecao) { usadas.add(`${arquivo}|${excecao}`); continue; }
        crus.push(`${arquivo}:${a.linha} ${a.problema} ${a.ramo}`);
      }
    }
    expect(crus).toEqual([]);
    // Exceção que não casa com nada é exceção vencida.
    const vencidas = Object.entries(NAO_SAO_ESTADO_VAZIO).flatMap(([arquivo, trechos]) => trechos.filter((t) => !usadas.has(`${arquivo}|${t}`)).map((t) => `${arquivo}|${t}`));
    expect(vencidas).toEqual([]);
  });

  it("EstadoVazio não recebe aparência de fora (className só de posição)", () => {
    const erros = todas.flatMap(({ arquivo, fonte }) => aparenciaForaDoComponente(fonte).map((e) => `${arquivo}: ${e}`));
    expect(erros).toEqual([]);
  });

  it("o componente está em uso (a migração não foi desfeita)", () => {
    const usos = todas.reduce((n, { fonte }) => n + (fonte.match(/<EstadoVazio(Linha)?[\s>]/g) ?? []).length, 0);
    expect(usos).toBeGreaterThanOrEqual(200);
  });
});
