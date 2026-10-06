import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { MAPA_BOTOES } from "./botoes-mapa";

// Só para a verificação por renderização das alternâncias (TurmaFormulario, PoliticaPainel, importados
// dentro do teste): sem roteador do App Router e sem server actions.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("@/server/turmas/acoes", () => ({ criarTurma: async () => ({ ok: true }), editarTurma: async () => ({ ok: true }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ acionarKillSwitchRegua: async () => ({ ok: true }), salvarPoliticaRegua: async () => ({ ok: true }) }));

// E1 (docs/42-auditoria-frontend-ux.md): o botão tem uma fonte só (botaoClasses / <Botao>, em
// src/components/Botao.tsx). A migração é por ÁREA; nas áreas desta lista (que só cresce) e em
// src/components:
// - nenhum literal de classe (string, template, concatenação) desenha um botão primário à mão;
// - nenhum <button> com padding e borda/fundo escreve as classes à mão em vez de botaoClasses;
// - a variante e o tamanho decididos para cada botão na migração ficam travados (botoes-mapa.ts).
// A análise é pelo AST do TypeScript (qualquer forma de className), não por regex de atributo.
const AREAS_MIGRADAS = ["src/app/(app)/configuracao", "src/app/(app)/diario", "src/app/(app)/academico", "src/app/(app)/alunos", "src/app/(app)/financeiro", "src/app/(app)/matriculas", "src/app/(app)/secretaria", "src/app/(app)/leads", "src/app/(app)/empresas", "src/app/(app)/inbox", "src/app/(app)/pipeline", "src/app/(app)/home", "src/app/(app)/carteiras", "src/app/(app)/comissoes", "src/app/(app)/preferencias", "src/app/(app)/acesso-negado"];

/**
 * Componentes compartilhados (src/components, com subpastas) seguem a mesma regra das áreas. Fica
 * de fora só Botao.tsx: é a fonte das classes (os literais das variantes moram lá).
 */
const COMPONENTES = "src/components";
const FONTE_DO_BOTAO = "src/components/Botao.tsx";

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
  "src/components/BarraMobile.tsx": 2, // botões só de ícone da barra do celular (menu, sair)
  "src/components/Sidebar.tsx": 2, // item da navegação principal (ativo = fundo da marca) e contador de não lidas
  "src/components/SubTabs.tsx": 2, // sub-aba ativa (docs/18: bg-brand-600 é seleção, não ação): o literal e o <Link>
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
  "src/app/(app)/inbox/InboxCliente.tsx": ["— · sem lead · opt-out", "Anexar arquivo", 'gravando ? "Parar e enviar" : "Gravar áudio"', "Fechar", "Fechar", 't === temperatura ? "Temperatura atual" : `Marcar como ${TEM', "key i.id"],
  "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx": ["✓"], // etapa do assistente
  "src/app/(app)/pipeline/KanbanBoard.tsx": ["⠿ arrastar", "pf · Pessoa Física · Empresa (B2B)"], // alça de arrastar, seletor de tipo
  "src/components/BarraMobile.tsx": ["rotuloBotaoMenu(aberta, naoLidasInbox)", "Sair"], // ícones da barra do celular (menu, sair)
  // Exceção de PALETA, não de papel: são ações, mas da IA — docs/18 reserva --ai-* (e --ai-solid para
  // aplicar sugestão) como o único sinal de "gerado por IA"; nenhuma variante do Botao tem essa cor.
  // Base e tamanho vêm do design system (BASE_BOTAO + TAMANHOS_BOTAO.sm); só a cor é própria.
  "src/components/CopilotoSugestoes.tsx": ["gerar · Analisando… · Gerar sugestões", "Aplicar corrigido"],
  "src/components/Drawer.tsx": ["Fechar"], // ícone de fechar da gaveta
  "src/components/Sidebar.tsx": ["Alternar tema", "Sair"], // ícones do rodapé da Sidebar (tema, sair)
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

// Hierarquia (E1): ação destrutiva ou de recusa usa a variante `perigo`. Lista FECHADA de verbos: o
// rótulo visível (cada alternativa de um ternário conta, separadas por " · ") que começa por um deles
// exige perigo. "Cancelar" sozinho fica de fora — é o fechar de modal/formulário (secundario ou
// fantasma); "Cancelar <algo>" desfaz registro e entra. "Confirmar <substantivo destrutivo>" é o passo
// de confirmação da mesma ação e também entra.
export const VERBOS_DESTRUTIVOS = ["Rejeitar", "Recusar", "Remover", "Excluir", "Apagar", "Descartar", "Desativar", "Inativar", "Revogar", "Encerrar", "Estornar", "Anular", "Cancelar"];
const CONFIRMACAO_DESTRUTIVA = /^Confirmar (cancelamento|rejeição|exclusão|remoção|revogação|encerramento|perda|desativação|estorno)(\s|$)/;

/** O rótulo (com as alternativas separadas por " · ") nomeia uma ação destrutiva ou de recusa? */
export function rotuloDestrutivo(rotulo: string): boolean {
  return rotulo.split(" · ").some((parte) => {
    const t = parte.trim();
    if (t === "Cancelar") return false;
    return VERBOS_DESTRUTIVOS.some((v) => t === v || t.startsWith(`${v} `)) || CONFIRMACAO_DESTRUTIVA.test(t);
  });
}

/**
 * Cada botão do design system no fonte — <button>/<Link>/<a> cujo className passa por botaoClasses
 * (direto ou por constante montada com ele) e todo <Botao> — com o nome (nomeDoElemento) e as
 * variantes possíveis: literal → ela; ternário → os dois lados; omitida → primario; outra expressão → "?".
 * Controles fora do design system não entram: a trava de botoesForaDoDesign já os lista por nome.
 */
export function variantesDosBotoes(fonte: string): { rotulo: string; variantes: string[] }[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ehBotaoClasses = (n: ts.Node): n is ts.CallExpression => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "botaoClasses";
  const daExpressao = (e: ts.Expression): string[] => {
    if (ts.isParenthesizedExpression(e)) return daExpressao(e.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
    if (ts.isConditionalExpression(e)) return [...daExpressao(e.whenTrue), ...daExpressao(e.whenFalse)];
    return ["?"];
  };
  const daChamada = (c: ts.CallExpression): string[] => {
    const arg = c.arguments[0];
    if (!arg) return ["primario"];
    if (!ts.isObjectLiteralExpression(arg)) return ["?"];
    const p = arg.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(sf) === "variante") as ts.PropertyAssignment | undefined;
    return p ? daExpressao(p.initializer) : ["primario"];
  };
  /** Variantes de todas as chamadas a botaoClasses e constantes de botão dentro de um nó. */
  const constantes = new Map<string, string[]>();
  const naExpressao = (raiz: ts.Node): string[] => {
    const v: string[] = [];
    const andar = (n: ts.Node) => {
      if (ehBotaoClasses(n)) { v.push(...daChamada(n)); return; }
      if (ts.isIdentifier(n) && constantes.has(n.text) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) v.push(...constantes.get(n.text)!);
      ts.forEachChild(n, andar);
    };
    andar(raiz);
    return v;
  };
  const coletar = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const v = naExpressao(n.initializer);
      if (v.length) constantes.set(n.name.text, v);
    }
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  const atributo = (n: ts.JsxOpeningElement | ts.JsxSelfClosingElement, nome: string) =>
    n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === nome) as ts.JsxAttribute | undefined;
  const botoes: { rotulo: string; variantes: string[] }[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf);
      let variantes: string[] = [];
      if (tag === "Botao") {
        const ini = atributo(n, "variante")?.initializer;
        variantes = !ini ? ["primario"] : ts.isStringLiteral(ini) ? [ini.text] : ts.isJsxExpression(ini) && ini.expression ? daExpressao(ini.expression) : ["?"];
      } else if (["button", "Link", "a"].includes(tag)) {
        const ini = atributo(n, "className")?.initializer;
        if (ini) variantes = naExpressao(ini);
      }
      if (variantes.length) botoes.push({ rotulo: nomeDoElemento(n, sf) ?? "(sem nome)", variantes });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return botoes;
}

/** Nomes dos botões do design system com rótulo destrutivo sem `perigo` entre as variantes possíveis. */
export function destrutivosSemPerigo(fonte: string): string[] {
  return variantesDosBotoes(fonte).filter((b) => rotuloDestrutivo(b.rotulo) && !b.variantes.includes("perigo")).map((b) => b.rotulo);
}

/**
 * Ramo a ramo: quando a variante e o rótulo do mesmo botão dependem da MESMA condição
 * (`variante: ativo ? "perigo" : "fantasma"` com `{ativo ? "Desativar" : "Ativar"}`), o rótulo destrutivo
 * tem de cair no ramo `perigo` — "perigo entre as possíveis" não basta (o ramo invertido pintaria de
 * vermelho o "Ativar" e deixaria o "Desativar" neutro). `!cond` conta como a mesma condição invertida.
 */
export function ramosDestrutivosDesalinhados(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const semParenteses = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) ? semParenteses(e.expression) : e);
  /** Condição normalizada e se veio negada (`!x` → ["x", true]). */
  const chave = (e: ts.Expression): [string, boolean] => {
    e = semParenteses(e);
    if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) { const [c, neg] = chave(e.operand); return [c, !neg]; }
    return [e.getText(sf).replace(/\s+/g, ""), false];
  };
  const textos = (e: ts.Expression): string[] => {
    e = semParenteses(e);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
    if (ts.isConditionalExpression(e)) return [...textos(e.whenTrue), ...textos(e.whenFalse)];
    return [];
  };
  /** Ternários de variante dentro do className (botaoClasses({ variante: c ? a : b })) ou em <Botao variante={…}>. */
  const ternariosDeVariante = (abertura: ts.JsxOpeningElement | ts.JsxSelfClosingElement): ts.ConditionalExpression[] => {
    const achados: ts.ConditionalExpression[] = [];
    for (const p of abertura.attributes.properties) {
      if (!ts.isJsxAttribute(p) || !p.initializer || !ts.isJsxExpression(p.initializer) || !p.initializer.expression) continue;
      const nome = p.name.getText(sf);
      if (nome === "variante") { const e = semParenteses(p.initializer.expression); if (ts.isConditionalExpression(e)) achados.push(e); }
      if (nome === "className") {
        const andar = (n: ts.Node) => {
          if (ts.isPropertyAssignment(n) && n.name.getText(sf) === "variante") { const e = semParenteses(n.initializer); if (ts.isConditionalExpression(e)) achados.push(e); }
          ts.forEachChild(n, andar);
        };
        andar(p.initializer.expression);
      }
    }
    return achados;
  };
  const desalinhados: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isJsxElement(n)) {
      for (const tv of ternariosDeVariante(n.openingElement)) {
        const [cv, negV] = chave(tv.condition);
        const variante = (e: ts.Expression) => (ts.isStringLiteral(semParenteses(e)) ? (semParenteses(e) as ts.StringLiteral).text : "?");
        const [vSim, vNao] = negV ? [variante(tv.whenFalse), variante(tv.whenTrue)] : [variante(tv.whenTrue), variante(tv.whenFalse)];
        const rotulos = (m: ts.Node) => {
          if (ts.isConditionalExpression(m)) {
            const [cr, negR] = chave(m.condition);
            if (cr === cv) {
              const [rSim, rNao] = negR ? [m.whenFalse, m.whenTrue] : [m.whenTrue, m.whenFalse];
              for (const [ramo, v] of [[rSim, vSim], [rNao, vNao]] as const) {
                for (const t of textos(ramo)) if (rotuloDestrutivo(t) && v !== "perigo") desalinhados.push(`${t} → ${v}`);
              }
            }
          }
          ts.forEachChild(m, rotulos);
        };
        for (const filho of n.children) rotulos(filho);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return desalinhados;
}

type Achado = { arquivo: string; rotulo: string };
/**
 * Confere exceções ancoradas (arquivo + rótulo exato): o achado sem exceção fica em `semExcecao`; a
 * exceção que não casa com EXATAMENTE um achado (sumiu, mudou de rótulo ou ficou ambígua) fica em `soltas`.
 */
export function conferirExcecoes(achados: Achado[], excecoes: Achado[]): { semExcecao: string[]; soltas: string[] } {
  const casa = (a: Achado, e: Achado) => a.arquivo === e.arquivo && a.rotulo === e.rotulo;
  return {
    semExcecao: achados.filter((a) => !excecoes.some((e) => casa(a, e))).map((a) => `${a.arquivo}: ${a.rotulo}`),
    soltas: excecoes.filter((e) => achados.filter((a) => casa(a, e)).length !== 1).map((e) => `${e.arquivo}: ${e.rotulo}`),
  };
}

/** Rótulo destrutivo que de propósito não é `perigo`: arquivo + rótulo exato + motivo. */
const DESTRUTIVOS_SEM_PERIGO: (Achado & { motivo: string })[] = [
  {
    arquivo: "src/app/(app)/inbox/InboxCliente.tsx",
    rotulo: "Remover opt-out",
    motivo: "o efeito é registrar nova autorização de contato (opt-in com evidência): reabre o canal, não apaga nem recusa nada",
  },
];

const OPERADORES_CONDICIONAIS: ts.SyntaxKind[] = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken];

/**
 * Alternância sem aria-pressed (docs/42, /configuracao/turmas #6 e similares): <button>/<Botao> cuja
 * aparência muda conforme uma condição — className (ou variante/tamanho) com ternário, `&&`, `||`,
 * `??`, direto ou por variável/função do arquivo — mostra a seleção só por cor. Ficam de fora:
 * - quem já declara aria-pressed;
 * - quem abre ou navega (aria-current, aria-expanded, aria-haspopup): o estado está nesse atributo;
 * - quem troca o nome PELA MESMA condição (texto visível ou aria-label): é uma ação que muda de rótulo
 *   ("Desativar"/"Ativar", "Gravar"/"Parar"), não um botão de alternância — e aria-pressed com rótulo
 *   que muda confunde o leitor de tela.
 * Devolve o nome de cada um (nomeDoElemento).
 */
export function alternanciasSemAriaPressed(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const texto = (n: ts.Node) => n.getText(sf).replace(/\s+/g, " ");
  const variaveis = new Map<string, ts.Node>();
  const coletar = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) variaveis.set(n.name.text, n.initializer);
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  /** Condições (texto) de que uma expressão de classe depende, seguindo variáveis do arquivo. */
  const condicoesDe = (raiz: ts.Node, vistas = new Set<string>()): string[] => {
    const achadas: string[] = [];
    const andar = (n: ts.Node) => {
      if (ts.isConditionalExpression(n)) achadas.push(texto(n.condition));
      else if (ts.isBinaryExpression(n) && OPERADORES_CONDICIONAIS.includes(n.operatorToken.kind)) achadas.push(texto(n.left));
      else if (ts.isIdentifier(n) && variaveis.has(n.text) && !vistas.has(n.text) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) {
        vistas.add(n.text);
        achadas.push(...condicoesDe(variaveis.get(n.text)!, vistas));
      }
      ts.forEachChild(n, andar);
    };
    andar(raiz);
    return achadas;
  };
  /** Condições de ternários que produzem texto no conteúdo visível (sem entrar em atributos dos filhos). */
  const condicoesDoTexto = (el: ts.JsxElement): string[] => {
    const achadas: string[] = [];
    const temTexto = (n: ts.Node): boolean =>
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n) || (ts.isJsxText(n) && n.getText(sf).trim() !== "") ||
      (!ts.isJsxAttributes(n) && (ts.forEachChild(n, temTexto) ?? false));
    const andar = (n: ts.Node) => {
      if (ts.isJsxAttributes(n)) return;
      if (ts.isConditionalExpression(n) && (temTexto(n.whenTrue) || temTexto(n.whenFalse))) achadas.push(texto(n.condition));
      ts.forEachChild(n, andar);
    };
    for (const c of el.children) andar(c);
    return achadas;
  };
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ["button", "Botao"].includes(n.tagName.getText(sf))) {
      const attrs = new Map(n.attributes.properties.filter(ts.isJsxAttribute).map((a) => [a.name.getText(sf), a.initializer] as const));
      const daClasse = ["className", "variante", "tamanho"].flatMap((nome) => (attrs.get(nome) ? condicoesDe(attrs.get(nome)!) : []));
      const isento = attrs.has("aria-pressed") || ["aria-current", "aria-expanded", "aria-haspopup"].some((a) => attrs.has(a));
      if (daClasse.length && !isento) {
        const doNome = [...(ts.isJsxOpeningElement(n) ? condicoesDoTexto(n.parent) : []), ...(attrs.get("aria-label") ? condicoesDe(attrs.get("aria-label")!) : [])];
        if (!daClasse.some((c) => doNome.includes(c))) achados.push(nomeDoElemento(n, sf) ?? "(sem nome)");
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Alternância que de propósito não leva aria-pressed: arquivo + nome exato (nomeDoElemento) + motivo. */
const ALTERNANCIAS_SEM_ARIA_PRESSED: (Achado & { motivo: string })[] = [];

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
  // Componentes compartilhados, com subpastas (um componente novo já nasce sob a trava).
  ...(readdirSync(COMPONENTES, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(COMPONENTES, f).split("\\").join("/"), conteudo: readFileSync(join(COMPONENTES, f), "utf-8") }))
    .filter(({ arquivo }) => arquivo !== FONTE_DO_BOTAO),
];

describe("botões nas áreas migradas", () => {
  it("nenhum botão de ação montado à mão (use botaoClasses ou <Botao>); exceções contadas", () => {
    const ofensores = arquivos.flatMap(({ arquivo, conteudo }) => {
      const achados = botoesCrus(conteudo);
      return achados.length > (NAO_SAO_BOTOES_DE_ACAO[arquivo] ?? 0) ? [`${arquivo}: ${achados.join(" | ")}`] : [];
    });
    expect(ofensores).toEqual([]);
  });

  it("src/components está sob a trava (menos a fonte das classes, Botao.tsx)", () => {
    const componentes = arquivos.filter(({ arquivo }) => arquivo.startsWith(`${COMPONENTES}/`)).map(({ arquivo }) => arquivo);
    expect(componentes).toEqual(expect.arrayContaining(["src/components/CopilotoSugestoes.tsx", "src/components/PagamentoModal.tsx", "src/components/EstadoRota.tsx", "src/components/ExportarPlanilha.tsx"]));
    expect(componentes).not.toContain(FONTE_DO_BOTAO);
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

describe("hierarquia: ação destrutiva ou de recusa é perigo", () => {
  it("todo botão do design system com rótulo destrutivo tem perigo; as exceções são ancoradas e cada uma casa com exatamente um botão", () => {
    const achados = arquivos
      .filter(({ arquivo }) => !/\.test\./.test(arquivo))
      .flatMap(({ arquivo, conteudo }) => destrutivosSemPerigo(conteudo).map((rotulo) => ({ arquivo, rotulo })));
    expect(conferirExcecoes(achados, DESTRUTIVOS_SEM_PERIGO)).toEqual({ semExcecao: [], soltas: [] });
    for (const e of DESTRUTIVOS_SEM_PERIGO) expect(e.motivo.trim().length, `${e.arquivo}: ${e.rotulo}`).toBeGreaterThan(20);
  });

  it("variante e rótulo na mesma condição: o rótulo destrutivo cai no ramo perigo (ramo invertido falha)", () => {
    const desalinhados = arquivos
      .filter(({ arquivo }) => !/\.test\./.test(arquivo))
      .flatMap(({ arquivo, conteudo }) => ramosDestrutivosDesalinhados(conteudo).map((r) => `${arquivo}: ${r}`));
    expect(desalinhados).toEqual([]);
  });

  it("ramosDestrutivosDesalinhados (autoteste): alinhado passa; invertido, negado e <Botao> invertidos acusam", () => {
    const b = (variante: string, rotulo: string) => `<button className={botaoClasses({ variante: ${variante}, tamanho: "sm" })}>{${rotulo}}</button>`;
    expect(ramosDestrutivosDesalinhados(b('ativo ? "perigo" : "fantasma"', 'ativo ? "Desativar" : "Ativar"'))).toEqual([]);
    expect(ramosDestrutivosDesalinhados(b('!ativo ? "fantasma" : "perigo"', 'ativo ? "Desativar" : "Ativar"'))).toEqual([]);
    expect(ramosDestrutivosDesalinhados(b('ativo ? "perigo" : "fantasma"', '!ativo ? "Ativar" : "Desativar"'))).toEqual([]);
    expect(ramosDestrutivosDesalinhados(b('ativo ? "fantasma" : "perigo"', 'ativo ? "Desativar" : "Ativar"'))).toEqual(["Desativar → fantasma"]);
    expect(ramosDestrutivosDesalinhados(b('!ativo ? "perigo" : "fantasma"', 'ativo ? "Desativar" : "Ativar"'))).toEqual(["Desativar → fantasma"]);
    expect(ramosDestrutivosDesalinhados('<Botao variante={e.ativo ? "secundario" : "perigo"}>{e.ativo ? "Inativar empresa" : "Reativar empresa"}</Botao>')).toEqual(["Inativar empresa → secundario"]);
    expect(ramosDestrutivosDesalinhados('<button className={`${botaoClasses({ variante: x === "revogar" ? "secundario" : "perigo" })} mt-2`}>{x === "revogar" ? "Revogar designação" : "Registrar"}</button>')).toEqual(["Revogar designação → secundario"]);
    // Condições diferentes: fora do alcance desta regra (a de "perigo entre as possíveis" segue valendo).
    expect(ramosDestrutivosDesalinhados(b('ativo ? "perigo" : "fantasma"', 'ocupado ? "Desativando…" : "Desativar"'))).toEqual([]);
  });

  it("rotuloDestrutivo: lista fechada de verbos; Cancelar sozinho (fechar) não conta; Cancelar <algo> e Confirmar <destruição> contam", () => {
    for (const r of ["Rejeitar", "Rejeitar proposta", "Remover campo", "Excluir", "Revogar designação", "Encerrar", "Descartar relato sem pausar",
      "Cancelar e liberar reserva", "Registrando… · Confirmar rejeição", "Confirmar perda", "Desativar · Ativar", "Ativar · Desativar", "Inativar empresa · Reativar empresa"])
      expect(rotuloDestrutivo(r), r).toBe(true);
    for (const r of ["Cancelar", "Fechar · Cancelar", "Cancelar · Editar", "Rejeitando…", "Removido", "Arquivar", "Reativar", "Ativar",
      "Confirmar divergência material", "Registrando… · revogar", "Salvar", "Aprovar proposta"])
      expect(rotuloDestrutivo(r), r).toBe(false);
  });

  it("destrutivosSemPerigo: lê variante direta, por constante, padrão (primario), ternário e <Botao>", () => {
    // Acusa.
    expect(destrutivosSemPerigo('<button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Rejeitar</button>')).toEqual(["Rejeitar"]);
    expect(destrutivosSemPerigo("<button className={botaoClasses()}>Excluir aluno</button>")).toEqual(["Excluir aluno"]);
    expect(destrutivosSemPerigo('const botao = botaoClasses({ variante: "secundario" }); <button className={botao}>Rejeitar proposta</button>')).toEqual(["Rejeitar proposta"]);
    expect(destrutivosSemPerigo('<button className={`${botaoClasses({ variante: "fantasma" })} ml-2`}>{ocupado ? "Revogando…" : "Revogar"}</button>')).toEqual(["Revogando… · Revogar"]);
    expect(destrutivosSemPerigo('<button aria-label="Remover anexo" className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}><IconTrash /></button>')).toEqual(["Remover anexo"]);
    expect(destrutivosSemPerigo('<Botao variante="secundario">Remover</Botao>')).toEqual(["Remover"]);
    expect(destrutivosSemPerigo("<Botao>Encerrar matrícula</Botao>")).toEqual(["Encerrar matrícula"]);
    expect(destrutivosSemPerigo('<Link href="/x" className={botaoClasses({ variante: "secundario" })}>Cancelar matrícula</Link>')).toEqual(["Cancelar matrícula"]);
    expect(destrutivosSemPerigo('<button className={botaoClasses({ variante: modo })}>Descartar</button>')).toEqual(["Descartar"]); // variante opaca ("?")
    // Passa.
    expect(destrutivosSemPerigo('<button className={botaoClasses({ variante: "perigo" })}>Rejeitar</button>')).toEqual([]);
    expect(destrutivosSemPerigo('const perigo = botaoClasses({ variante: "perigo", tamanho: "sm" }); <button className={perigo}>Remover</button>')).toEqual([]);
    expect(destrutivosSemPerigo('<button className={botaoClasses({ variante: ativo ? "perigo" : "fantasma", tamanho: "sm" })}>{ativo ? "Desativar" : "Ativar"}</button>')).toEqual([]);
    expect(destrutivosSemPerigo('<Botao variante={ativo ? "perigo" : "secundario"}>Inativar</Botao>')).toEqual([]);
    expect(destrutivosSemPerigo('<button className={botaoClasses({ variante: "secundario" })}>Cancelar</button>')).toEqual([]);
    expect(destrutivosSemPerigo('<button className={botaoClasses({ variante: "secundario" })}>Aprovar</button>')).toEqual([]);
    // Fora do design system não entra aqui (a trava de botoesForaDoDesign o lista por nome).
    expect(destrutivosSemPerigo('<button className="underline">Remover</button>')).toEqual([]);
  });

  it("conferirExcecoes: achado sem exceção acusa; exceção sem alvo, com alvo trocado ou ambígua fica solta", () => {
    const a = { arquivo: "x.tsx", rotulo: "Remover opt-out" };
    expect(conferirExcecoes([a], [])).toEqual({ semExcecao: ["x.tsx: Remover opt-out"], soltas: [] });
    expect(conferirExcecoes([a], [a])).toEqual({ semExcecao: [], soltas: [] });
    expect(conferirExcecoes([], [a])).toEqual({ semExcecao: [], soltas: ["x.tsx: Remover opt-out"] }); // o botão sumiu ou virou perigo
    expect(conferirExcecoes([{ ...a, arquivo: "y.tsx" }], [a])).toEqual({ semExcecao: ["y.tsx: Remover opt-out"], soltas: ["x.tsx: Remover opt-out"] }); // âncora é o arquivo
    expect(conferirExcecoes([a, a], [a])).toEqual({ semExcecao: [], soltas: ["x.tsx: Remover opt-out"] }); // dois botões iguais: exceção ambígua
  });
});

/** Rótulos dos botões com aria-pressed num HTML renderizado, separados pelo estado. */
function pressionados(html: string): { sim: string[]; nao: string[] } {
  const sim: string[] = [];
  const nao: string[] = [];
  for (const m of html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)) (m[1] === "true" ? sim : nao).push(m[2]);
  return { sim, nao };
}

describe("alternâncias anunciam o estado (aria-pressed)", () => {
  it("todo botão que muda de aparência por uma condição tem aria-pressed (ou abre/navega, ou troca o nome pela mesma condição); exceções ancoradas", () => {
    const achados = arquivos
      .filter(({ arquivo }) => !/\.test\./.test(arquivo))
      .flatMap(({ arquivo, conteudo }) => alternanciasSemAriaPressed(conteudo).map((rotulo) => ({ arquivo, rotulo })));
    expect(conferirExcecoes(achados, ALTERNANCIAS_SEM_ARIA_PRESSED)).toEqual({ semExcecao: [], soltas: [] });
    for (const e of ALTERNANCIAS_SEM_ARIA_PRESSED) expect(e.motivo.trim().length, `${e.arquivo}: ${e.rotulo}`).toBeGreaterThan(20);
  });

  it("alternanciasSemAriaPressed: acusa seleção só por cor, em qualquer forma de className", () => {
    expect(alternanciasSemAriaPressed('<button key={d.n} className={"rounded border " + (ativo ? "bg-brand-600 text-white" : "text-gray-600")}>{d.label}</button>')).toEqual(["key d.n"]);
    expect(alternanciasSemAriaPressed('<button className={`chip ${ativo && "bg-brand-600"}`}>Seg</button>')).toEqual(["Seg"]);
    expect(alternanciasSemAriaPressed('const cls = (on: boolean) => (on ? "bg-brand-600" : "border"); <button className={cls(ativo)}>Ter</button>')).toEqual(["Ter"]);
    expect(alternanciasSemAriaPressed('const chip = ativo ? "bg-brand-600" : "border"; <button className={chip}>Qua</button>')).toEqual(["Qua"]);
    expect(alternanciasSemAriaPressed('<Botao variante={selecionado ? "primario" : "secundario"}>Mensal</Botao>')).toEqual(["Mensal"]);
    // O nome muda, mas por OUTRA condição (o item do map, o carregamento): não comunica a seleção.
    expect(alternanciasSemAriaPressed('<button className={botaoClasses({ variante: tipo === t ? "primario" : "secundario" })}>{t === "pf" ? "Pessoa Física" : "Empresa"}</button>')).toEqual(["pf · Pessoa Física · Empresa"]);
    expect(alternanciasSemAriaPressed('<button className={on ? "bg-brand-600" : ""}>{ocupado ? "Salvando…" : "Salvar"}</button>')).toEqual(["Salvando… · Salvar"]);
    // title não conta como troca de nome; ternário em atributo de um filho não é texto.
    expect(alternanciasSemAriaPressed('<button title={on ? "Atual" : "Marcar"} className={on ? "bg-brand-600" : "text-gray-400"}>{ROTULO[t]}</button>')).toEqual(['on ? "Atual" : "Marcar"']);
    expect(alternanciasSemAriaPressed('<button className={on ? "bg-brand-600" : ""}><span className={on ? "font-medium" : ""}>Seg</span></button>')).toEqual(["Seg"]);
  });

  it("alternanciasSemAriaPressed: isenta aria-pressed, quem abre/navega e quem troca o nome pela mesma condição", () => {
    expect(alternanciasSemAriaPressed('<button aria-pressed={ativo} className={"chip " + (ativo ? "bg-brand-600" : "")}>Seg</button>')).toEqual([]);
    expect(alternanciasSemAriaPressed('<Botao aria-pressed={on} variante={on ? "primario" : "secundario"}>Mensal</Botao>')).toEqual([]);
    expect(alternanciasSemAriaPressed('<button aria-current={atual ? "true" : undefined} className={"item " + (atual ? "bg-brand-50" : "")}>Conversa</button>')).toEqual([]);
    expect(alternanciasSemAriaPressed('<button aria-expanded={aberto} className={aberto ? "bg-gray-100" : ""}>Filtros</button>')).toEqual([]);
    expect(alternanciasSemAriaPressed('<button className={botaoClasses({ variante: i.ativo ? "perigo" : "fantasma" })}>{i.ativo ? "Desativar" : "Ativar"}</button>')).toEqual([]);
    expect(alternanciasSemAriaPressed('<button aria-label={gravando ? "Parar" : "Gravar"} className={gravando ? "bg-red-100" : ""}><Icone /></button>')).toEqual([]);
    expect(alternanciasSemAriaPressed('<button className={botaoClasses({ variante: "secundario" })}>Salvar</button>')).toEqual([]);
    expect(alternanciasSemAriaPressed("const btn = botaoClasses(); <button className={`${btn} mt-2`}>Ok</button>")).toEqual([]);
  });

  it("por renderização: o dia marcado sai com aria-pressed=\"true\", o desmarcado com \"false\", e o conjunto é um grupo rotulado", async () => {
    const { TurmaFormulario } = await import("./(app)/configuracao/turmas/TurmaFormulario");
    const turma = {
      id: "t1", nome: "Turma", modalidadeId: "", nivelId: "", professorId: "", diasSemana: [1, 3], horarioInicio: "08:00", horarioFim: "09:00",
      dataInicio: "", dataFim: "", capacidade: 12, rolling: false,
    };
    const htmlTurma = renderToStaticMarkup(createElement(TurmaFormulario, { turma, modalidades: [], niveis: [], professores: [], onClose: () => {} }));
    expect(pressionados(htmlTurma)).toEqual({ sim: ["Seg", "Qua"], nao: ["Ter", "Qui", "Sex", "Sáb", "Dom"] });
    expect(htmlTurma).toContain('role="group" aria-label="Dias da semana"');

    const { PoliticaPainel } = await import("./(app)/configuracao/whatsapp/PoliticaPainel");
    const politica = {
      id: null, nome: "Cobrança", estado: "DESLIGADA", janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5], tetoPorContatoDia: 1,
      silencioPosInboundHoras: 0, killSwitch: false, numeroRemetenteId: null, degraus: [],
    };
    const htmlPolitica = renderToStaticMarkup(createElement(PoliticaPainel, { politica, numeros: [], templates: [] }));
    expect(pressionados(htmlPolitica)).toEqual({ sim: ["seg", "ter", "qua", "qui", "sex"], nao: ["dom", "sáb"] });
    expect(htmlPolitica).toContain('role="group" aria-label="Dias da semana"');
  });
});
