import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MAPA_BOTOES } from "./botoes-mapa";

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
