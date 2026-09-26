import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MAPA_BOTOES } from "./botoes-mapa";

// E1 (docs/42-auditoria-frontend-ux.md): o botão tem uma fonte só (botaoClasses / <Botao>, em
// src/components/Botao.tsx). A migração é por ÁREA; nas áreas desta lista (que só cresce):
// - nenhum literal de classe (string, template, concatenação) desenha um botão primário à mão;
// - nenhum <button> com padding e borda/fundo escreve as classes à mão em vez de botaoClasses;
// - a variante e o tamanho decididos para cada botão na migração ficam travados (botoes-mapa.ts).
// A análise é pelo AST do TypeScript (qualquer forma de className), não por regex de atributo.
const AREAS_MIGRADAS = ["src/app/(app)/configuracao", "src/app/(app)/diario", "src/app/(app)/academico", "src/app/(app)/alunos", "src/app/(app)/financeiro", "src/app/(app)/matriculas", "src/app/(app)/secretaria", "src/app/(app)/leads", "src/app/(app)/empresas", "src/app/(app)/inbox", "src/app/(app)/pipeline", "src/app/(app)/home", "src/app/(app)/carteiras", "src/app/(app)/comissoes", "src/app/(app)/preferencias", "src/app/(app)/acesso-negado"];

/** Exceções contadas por arquivo: não são botões de ação (chips de seleção, item de lista). */
const NAO_SAO_BOTOES_DE_ACAO: Record<string, number> = {
  "src/app/(app)/configuracao/turmas/TurmaFormulario.tsx": 2, // chip de dia da semana (selecionado = marca)
  "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx": 2, // chip de dia da semana (selecionado = marca)
  "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx": 1, // item de lista suspensa
  "src/app/(app)/alunos/[id]/financeiro/FichaFinanceira.tsx": 1, // selo "regularização integral" (link em pílula)
  "src/app/(app)/financeiro/BarraAbasFinanceiro.tsx": 2, // aba ativa da barra de seções (marca = selecionada): o <Link> e o literal
  "src/app/(app)/financeiro/FilaCobranca.tsx": 1, // cartão-indicador que filtra a fila (dashboard da régua)
  "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx": 1, // bolinha numerada da etapa do assistente (ativa = marca)
  "src/app/(app)/matriculas/[id]/page.tsx": 1, // seções do registro da matrícula (card de grade)
  // Inbox (chat): item da lista de conversas, contador de não lidas, barra "Conversas" do celular,
  // pílula de link, 2 botões só de ícone (anexar, gravar), fichas de temperatura, lista de nomes,
  // abas do filtro de canal (Todas / Linha comercial / Institucional — SPEC-ERP-005).
  "src/app/(app)/inbox/InboxCliente.tsx": 9,
  "src/app/(app)/pipeline/KanbanBoard.tsx": 2, // alça "⠿ arrastar" do cartão e seletor de tipo (segmentado)
  "src/app/(app)/leads/[id]/FichaLead.tsx": 1, // etapa atual do funil (indicador, marca = atual)
  "src/app/(app)/home/page.tsx": 1, // atalhos da home em blocos (card de grade)
  "src/app/(app)/layout.tsx": 1, // link "pular para o conteúdo" (acessibilidade, visível só no foco)
};

/**
 * <button> que não passam por botaoClasses porque não são ação (o Botao não tem papel para eles):
 * botão só de ícone, ficha/chip de seleção, card ou item de lista, aba segmentada, alça de arrastar.
 * Listados por nome (texto, aria-label/title ou key) — qualquer outro <button> do painel precisa de botaoClasses.
 */
const CONTROLES_QUE_NAO_SAO_BOTAO: Record<string, string[]> = {
  "src/app/(app)/configuracao/paises/PaisFormulario.tsx": ["Remover documento"], // ícone de lixeira
  "src/app/(app)/configuracao/turmas/TurmaFormulario.tsx": ["key d.n"], // chip de dia da semana
  "src/app/(app)/configuracao/whatsapp/NumerosPainel.tsx": ["Fechar"], // ícone de fechar
  "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx": ["key d"], // chip de dia da semana
  "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx": ["×", "(sem nome)"], // × de remover do piloto, item da lista suspensa
  "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx": ["Fechar"], // ícone de fechar
  "src/app/(app)/financeiro/FilaCobranca.tsx": ["key d.label", "(sem nome)", "✕"], // cartão-indicador, linha da fila, ✕ do detalhe
  // Inbox: item de conversa, anexar, gravar, fechar busca de vínculo, fichas de temperatura, item de nome.
  "src/app/(app)/inbox/InboxCliente.tsx": ["— · sem lead · opt-out", "Anexar arquivo", 'gravando ? "Parar e enviar" : "Gravar áudio"', "Fechar", 't === temperatura ? "Temperatura atual" : `Marcar como ${TEM', "key i.id"],
  "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx": ["✓"], // etapa do assistente
  "src/app/(app)/pipeline/KanbanBoard.tsx": ["⠿ arrastar", "pf · Pessoa Física · Empresa (B2B)"], // alça de arrastar, seletor de tipo
};

/** Classes que podem acompanhar botaoClasses num className: só layout (margem, alinhamento, largura). */
const SO_LAYOUT = /^(-?m[trblxy]?-\S+|self-\S+|justify-self-\S+|w-fit|w-full|shrink-0|ml-auto|flex-1)$/;

/**
 * Nome de um elemento para localizá-lo: texto visível; senão aria-label/title (botão de ícone);
 * senão a expressão do `key` (item gerado por map, texto dinâmico); senão null.
 */
function nomeDoElemento(n: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile): string | null {
  const texto = ts.isJsxOpeningElement(n) ? textosVisiveis(n.parent, sf) : "";
  if (texto) return texto;
  for (const nome of ["aria-label", "title", "key"]) {
    const a = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === nome) as ts.JsxAttribute | undefined;
    const ini = a?.initializer;
    if (ini && ts.isStringLiteral(ini)) return ini.text;
    if (ini && ts.isJsxExpression(ini) && ini.expression) return `${nome === "key" ? "key " : ""}${ini.expression.getText(sf).replace(/\s+/g, " ").slice(0, 60)}`;
  }
  return null;
}

/**
 * Rótulo de cada <button> do fonte cujo className não é, em todos os estados, botaoClasses (direto
 * ou por constante montada com ele) mais, no máximo, classes de layout. Avalia as folhas: ternário e
 * `||`/`??` — os dois lados; `&&` — o lado direito; template e `+` — ao menos uma parte é botão e o
 * resto é só layout (`${botaoClasses()} underline px-0` não passa).
 */
export function botoesForaDoDesign(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const chama = (n: ts.Node): boolean =>
    (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "botaoClasses") || (ts.forEachChild(n, chama) ?? false);
  const deBotao = new Set<string>();
  const coletar = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && chama(n.initializer)) deBotao.add(n.name.text);
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  const soLayout = (t: string) => t.split(/\s+/).filter(Boolean).every((c) => SO_LAYOUT.test(c));
  const literal = (e: ts.Node) => (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : null);
  const partesDaSoma = (e: ts.Expression): ts.Expression[] =>
    ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken ? [...partesDaSoma(e.left), ...partesDaSoma(e.right)] : ts.isParenthesizedExpression(e) ? partesDaSoma(e.expression) : [e];
  const passa = (e: ts.Node): boolean => {
    if (ts.isJsxExpression(e)) return !!e.expression && passa(e.expression);
    if (ts.isParenthesizedExpression(e)) return passa(e.expression);
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "botaoClasses") return true;
    if (ts.isIdentifier(e)) return deBotao.has(e.text);
    if (ts.isConditionalExpression(e)) return passa(e.whenTrue) && passa(e.whenFalse);
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return passa(e.left) && passa(e.right);
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return passa(e.right);
      if (op === ts.SyntaxKind.PlusToken) {
        const partes = partesDaSoma(e);
        return partes.some(passa) && partes.every((p) => passa(p) || (literal(p) !== null && soLayout(literal(p)!)));
      }
    }
    if (ts.isTemplateExpression(e)) {
      const exprs = e.templateSpans.map((s) => s.expression);
      const textos = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)];
      return exprs.some(passa) && exprs.every((x) => passa(x) || (literal(x) !== null && soLayout(literal(x)!))) && textos.every(soLayout);
    }
    return false;
  };
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === "button") {
      const attr = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "className") as ts.JsxAttribute | undefined;
      if (!attr?.initializer || !passa(attr.initializer)) achados.push(nomeDoElemento(n, sf) ?? "(sem nome)");
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

const PRIMARIO = /\bbg-(brand-solid|brand-600|brand-700|black|danger)\b/;

/** Ofensas num fonte TSX: literais de botão primário e <button>/<Link>/<a> com classes de botão à mão. */
export function botoesCrus(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  // A classe pode vir de constantes do arquivo, em qualquer forma (className={campo},
  // `${campo} self-end`, btnSec + " mt-3", ternário). Constante string é expandida; constante
  // montada com botaoClasses(...) conta como botão do design system — pelo valor, não pelo nome.
  const constantes = new Map<string, string>();
  const constantesDeBotao = new Set<string>();
  const chamaBotaoClasses = (n: ts.Node): boolean =>
    (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "botaoClasses") || (ts.forEachChild(n, chamaBotaoClasses) ?? false);
  const coletar = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer)) constantes.set(n.name.text, n.initializer.text);
      else if (chamaBotaoClasses(n.initializer)) constantesDeBotao.add(n.name.text);
    }
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  /** Classes de uma expressão de className: literais e constantes expandidas; se passa por botaoClasses. */
  const classesDe = (raiz: ts.Node) => {
    const partes: string[] = [];
    let usaBotao = false;
    const andar = (n: ts.Node) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) partes.push(n.text);
      else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "botaoClasses") { usaBotao = true; return; }
      else if (ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) {
        if (constantes.has(n.text)) partes.push(constantes.get(n.text)!);
        if (constantesDeBotao.has(n.text)) usaBotao = true;
      }
      ts.forEachChild(n, andar);
    };
    andar(raiz);
    return { texto: partes.join(" ").trim(), usaBotao };
  };
  const visitar = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      const t = n.text.split(/\s+/);
      if (!t.some((x) => x.startsWith("file:")) && PRIMARIO.test(n.text) && t.includes("text-white")) achados.push(`primário: "${n.text}"`);
    }
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ["button", "Link", "a"].includes(n.tagName.getText(sf))) {
      const tag = n.tagName.getText(sf);
      const attr = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "className");
      const ini = attr && ts.isJsxAttribute(attr) ? attr.initializer : undefined;
      const { texto, usaBotao } = ini ? classesDe(ini) : { texto: "", usaBotao: false };
      // <button>: padding em qualquer forma (px-, py-, p-) com borda ou fundo é cara de botão.
      // <Link>/<a>: px- E py- com borda ou fundo (card de lista com p-3 não é botão).
      const padding = tag === "button" ? /\bp[xy]?-\d/.test(texto) : /\bpx-\d/.test(texto) && /\bpy-\d/.test(texto);
      if (texto && !usaBotao && padding && /\b(border|bg-)/.test(texto)) achados.push(`<${tag}> à mão: ${texto.slice(0, 80)}`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Textos visíveis de um elemento JSX (texto e literais dos filhos), para localizar o botão no mapa. */
function textosVisiveis(el: ts.JsxElement, sf: ts.SourceFile): string {
  const partes: string[] = [];
  const coletar = (n: ts.Node) => {
    if (ts.isJsxAttributes(n)) return;
    if (ts.isJsxText(n)) {
      const t = n.getText(sf).replace(/\s+/g, " ").trim();
      if (t) partes.push(t);
    } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) partes.push(n.text);
    ts.forEachChild(n, coletar);
  };
  for (const c of el.children) coletar(c);
  return partes.join(" · ").slice(0, 60);
}

/**
 * Cada chamada a botaoClasses(...) do fonte, em ordem: "<rótulo> → variante/tamanho". Rótulo é o
 * texto visível do elemento (ou `const nome`); omitidos valem primario/md, como em Botao.tsx.
 */
export function mapaDeBotoes(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const itens: string[] = [];
  const valor = (i: ts.Expression) =>
    ts.isStringLiteral(i) ? i.text : ts.isConditionalExpression(i) && ts.isStringLiteral(i.whenTrue) && ts.isStringLiteral(i.whenFalse) ? `${i.whenTrue.text}|${i.whenFalse.text}` : "?";
  const chamaBotao = (n: ts.Node): boolean =>
    (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "botaoClasses") || (ts.forEachChild(n, chamaBotao) ?? false);
  // Constantes montadas com botaoClasses: o botão que usa uma delas fica registrado com o nome dela.
  const constantesDeBotao = new Set<string>();
  const coletar = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && chamaBotao(n.initializer)) constantesDeBotao.add(n.name.text);
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  /** "const nome" dentro de uma declaração; "<tag> texto" dentro de um className; senão null. */
  const rotuloDe = (n: ts.Node): string | null => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isVariableDeclaration(p)) return `const ${p.name.getText(sf)}`;
      if (ts.isJsxAttribute(p)) {
        if (p.name.getText(sf) !== "className") return null;
        const el = p.parent.parent;
        return `<${el.tagName.getText(sf)}> ${nomeDoElemento(el, sf) ?? ""}`.trim();
      }
    }
    return null;
  };
  const visitar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "botaoClasses") {
      let variante = "primario", tamanho = "md";
      const arg = n.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          if (p.name.getText(sf) === "variante") variante = valor(p.initializer);
          if (p.name.getText(sf) === "tamanho") tamanho = valor(p.initializer);
        }
      } else if (arg) variante = tamanho = "?";
      itens.push(`${rotuloDe(n) ?? "?"} → ${variante}/${tamanho}`);
    } else if (ts.isIdentifier(n) && constantesDeBotao.has(n.text) && !ts.isVariableDeclaration(n.parent) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) {
      const rotulo = rotuloDe(n);
      if (rotulo && !rotulo.startsWith("const ")) itens.push(`${rotulo} → ${n.text}`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return itens;
}

const arquivos = [
  ...AREAS_MIGRADAS.flatMap((raiz) =>
    (readdirSync(raiz, { recursive: true }) as string[])
      .filter((f) => /\.tsx$/.test(f))
      .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
  ),
  // Raiz do painel (layout, error, not-found, loading): sem recursão — as áreas cobrem o resto.
  ...(readdirSync("src/app/(app)", { withFileTypes: true }) as Dirent[])
    .filter((d) => d.isFile() && /\.tsx$/.test(d.name))
    .map((d) => ({ arquivo: `src/app/(app)/${d.name}`, conteudo: readFileSync(join("src/app/(app)", d.name), "utf-8") })),
];

describe("botões nas áreas migradas", () => {
  it("nenhum botão de ação montado à mão (use botaoClasses ou <Botao>); exceções contadas", () => {
    const ofensores = arquivos.flatMap(({ arquivo, conteudo }) => {
      const achados = botoesCrus(conteudo);
      return achados.length > (NAO_SAO_BOTOES_DE_ACAO[arquivo] ?? 0) ? [`${arquivo}: ${achados.join(" | ")}`] : [];
    });
    expect(ofensores).toEqual([]);
  });

  it("todo o painel está migrado: cada área de src/app/(app) está na lista (área nova já nasce sob a trava)", () => {
    const areasDoPainel = (readdirSync("src/app/(app)", { withFileTypes: true }) as Dirent[]).filter((d) => d.isDirectory()).map((d) => `src/app/(app)/${d.name}`);
    expect([...AREAS_MIGRADAS].sort()).toEqual(areasDoPainel.sort());
  });

  it("a lista de áreas migradas só cresce (uma área não sai num rebase distraído)", () => {
    expect(AREAS_MIGRADAS).toEqual(expect.arrayContaining(["src/app/(app)/configuracao", "src/app/(app)/diario", "src/app/(app)/academico", "src/app/(app)/alunos", "src/app/(app)/financeiro", "src/app/(app)/matriculas", "src/app/(app)/secretaria", "src/app/(app)/leads", "src/app/(app)/empresas", "src/app/(app)/inbox", "src/app/(app)/pipeline", "src/app/(app)/home", "src/app/(app)/carteiras", "src/app/(app)/comissoes", "src/app/(app)/preferencias", "src/app/(app)/acesso-negado"]));
  });

  it("variante e tamanho de cada botão migrado ficam como decididos (src/app/botoes-mapa.ts)", () => {
    const real: Record<string, string[]> = {};
    for (const { arquivo, conteudo } of arquivos) {
      if (/\.test\./.test(arquivo)) continue;
      const itens = mapaDeBotoes(conteudo);
      if (itens.length) real[arquivo.replace("src/app/(app)/", "")] = itens;
    }
    expect(real).toEqual(MAPA_BOTOES);
  });

  it("o mapa localiza cada chamada: rótulo pelo texto do botão ou pela constante; omitidos valem primario/md", () => {
    expect(mapaDeBotoes('<button className={botaoClasses({ variante: "perigo" })}>{ocupado ? "Rejeitando…" : "Rejeitar"}</button>')).toEqual(["<button> Rejeitando… · Rejeitar → perigo/md"]);
    expect(mapaDeBotoes('const principal = botaoClasses({ tamanho: "lg" });')).toEqual(["const principal → primario/lg"]);
    expect(mapaDeBotoes("<Link className={`${botaoClasses()} mt-2`} href=\"/x\">Propor</Link>")).toEqual(["<Link> Propor → primario/md"]);
    expect(mapaDeBotoes('<button className={botaoClasses({ variante: on ? "perigo" : "secundario" })}>X</button>')).toEqual(["<button> X → perigo|secundario/md"]);
    // Botão que usa uma constante de botão: registrado com o nome dela (trocar btnPri por btnSec quebra).
    expect(mapaDeBotoes('const btnPri = botaoClasses(); <button className={btnPri}>Registrar pagamento</button><button className={`${btnPri} mt-3`}>Ok</button>'))
      .toEqual(["const btnPri → primario/md", "<button> Registrar pagamento → btnPri", "<button> Ok → btnPri"]);
  });

  it("todo <button> do painel passa por botaoClasses; os controles que não são ação são exatamente os listados, por nome", () => {
    const real: Record<string, string[]> = {};
    for (const { arquivo, conteudo } of arquivos) {
      if (/\.test\./.test(arquivo)) continue;
      const achados = botoesForaDoDesign(conteudo);
      if (achados.length) real[arquivo] = achados;
    }
    // Por nome, não por contagem: trocar um controle isento por uma ação crua no mesmo arquivo quebra.
    expect(real).toEqual(CONTROLES_QUE_NAO_SAO_BOTAO);
  });

  it("botoesForaDoDesign: sem classe, cara de texto e estados crus acusam; botaoClasses (+ layout) passa", () => {
    expect(botoesForaDoDesign("<button onClick={f}>Registrar decisão</button>")).toEqual(["Registrar decisão"]);
    expect(botoesForaDoDesign('<button className="underline">Registrar evidência</button>')).toEqual(["Registrar evidência"]);
    expect(botoesForaDoDesign('<button className="text-gray-400" aria-label="Fechar"><IconX /></button>')).toEqual(["Fechar"]);
    expect(botoesForaDoDesign('const btnSec = "underline"; <button className={btnSec}>Ok</button>')).toEqual(["Ok"]);
    // Um estado cru basta para acusar (R4 da #117: e3, e3b, e4).
    expect(botoesForaDoDesign('<button className={ocupado ? "underline" : botaoClasses({ variante: "secundario" })}>A</button>')).toEqual(["A"]);
    expect(botoesForaDoDesign('<button className={botaoClasses() && "underline"}>B</button>')).toEqual(["B"]);
    expect(botoesForaDoDesign("<button className={`${botaoClasses()} underline border-0 bg-transparent px-0 py-0`}>C</button>")).toEqual(["C"]);
    expect(botoesForaDoDesign('<button className={botaoClasses() + " underline"}>D</button>')).toEqual(["D"]);
    // Passa: direto, por constante, com layout em template ou soma, e ternário entre dois botões.
    expect(botoesForaDoDesign('<button className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}>Editar</button>')).toEqual([]);
    expect(botoesForaDoDesign("const btnSec = botaoClasses(); <button className={`${btnSec} ml-3`}>Ok</button>")).toEqual([]);
    expect(botoesForaDoDesign('const btnSec = botaoClasses(); <button className={btnSec + " mt-3 self-end"}>Ok</button>')).toEqual([]);
    expect(botoesForaDoDesign('<button className={on ? botaoClasses() : botaoClasses({ variante: "secundario" })}>Ok</button>')).toEqual([]);
  });

  it("a lista de exceções não sobra", () => {
    const sobrando = Object.entries(NAO_SAO_BOTOES_DE_ACAO).filter(([a, n]) => botoesCrus(arquivos.find((x) => x.arquivo === a)?.conteudo ?? "").length < n);
    expect(sobrando).toEqual([]);
  });

  it("o detector pega todas as formas: atributo, expressão, template, concatenação, brand-600, secundário curto", () => {
    const casos = [
      '<button className="rounded-md bg-brand-solid px-4 py-2 text-sm text-white">x</button>',
      '<button className={"rounded-md bg-brand-solid px-4 py-2 text-white"}>x</button>',
      "<button className={`rounded bg-brand-solid px-3 py-2 text-white ${a}`}>x</button>",
      '<button className="rounded bg-brand-600 px-3 py-2 text-white">x</button>',
      '<button className="rounded border px-3 py-2">x</button>',
      '<button type="button" className="rounded border p-2">Adicionar</button>',
      '<button className={"rounded-md px-3 " + (a ? "bg-danger text-white" : "border")}>x</button>',
      'const c = "rounded bg-black px-4 py-2 text-white";',
      'const campo = "rounded-md border px-3 py-2"; <button className={campo}>Cancelar</button>',
      '<Link href="/x" className="inline-block rounded border px-3 py-2">Preparar nova versão</Link>',
      'const btnSec = "rounded border px-3 py-2"; <button className={btnSec + " mt-3"}>x</button>',
      'const campo = "rounded border p-2"; <button className={`${campo} self-end`}>x</button>',
      'const campo = "rounded border p-2"; <button className={ok ? campo : "text-sm"}>x</button>',
      '<a href="/x" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Abrir</a>',
      '<Link href="/x" className="block rounded-md border px-4 py-2 text-center">Continuar</Link>',
    ];
    for (const c of casos) expect(botoesCrus(c).length, c).toBeGreaterThan(0);
    for (const ok of [
      '<button className={botaoClasses({ tamanho: "lg" })}>x</button>',
      '<button className={`${botaoClasses()} mt-4`}>x</button>',
      "<button className={btnSec}>x</button>",
      'const campo = "rounded border p-2"; <input className={campo} />',
      "const botao = botaoClasses(); <button className={botao}>x</button>",
      "const btnSec = botaoClasses(); <button className={`${btnSec} ml-auto`}>x</button>",
      'const btnSec = botaoClasses({ variante: "secundario" }); <button className={btnSec + " mt-3"}>x</button>',
      '<input className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />',
      '<input className="file:bg-brand-solid file:text-white text-sm" />',
      '<button className="text-sm text-brand-700 hover:underline">x</button>',
      '<Link href="/x" className="block rounded border p-3 underline">Card da lista</Link>',
      '<Link href="/x" className={botaoClasses({ variante: "secundario" })}>Abrir</Link>',
    ]) expect(botoesCrus(ok), ok).toEqual([]);
  });
});
