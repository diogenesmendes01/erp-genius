import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { join, posix } from "node:path";
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
  "src/app/(app)/financeiro/FilaCobranca.tsx": ["(sem nome)", "✕"], // linha da fila, ✕ do detalhe
  // Inbox: item de conversa, anexar, gravar, fechar busca de vínculo, fichas de temperatura, item de nome.
  "src/app/(app)/inbox/InboxCliente.tsx": ["— · sem lead · opt-out", "Anexar arquivo", 'gravando ? "Parar e enviar" : "Gravar áudio"', "Fechar", "Fechar", 't === temperatura ? "Temperatura atual" : `Marcar como ${TEM', "key i.id"],
  "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx": ["✓"], // etapa do assistente
  "src/app/(app)/pipeline/KanbanBoard.tsx": ["⠿ arrastar", "pf · Pessoa Física · Empresa (B2B)"], // alça de arrastar, seletor de tipo
  "src/components/BarraMobile.tsx": ["rotuloBotaoMenu(aberta, naoLidasInbox)", "Sair"], // ícones da barra do celular (menu, sair)
  // Exceção de PALETA, não de papel: são ações, mas da IA — docs/18 reserva --ai-* (e --ai-solid para
  // aplicar sugestão) como o único sinal de "gerado por IA"; nenhuma variante do Botao tem essa cor.
  // Base e tamanho vêm do design system (BASE_BOTAO + TAMANHOS_BOTAO.sm); só a cor é própria.
  "src/components/CopilotoSugestoes.tsx": ["gerar · Analisando… · Gerar sugestões", "Aceitar", "Aplicar corrigido"],
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
    } else if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === "Botao") {
      // <Botao> também entra no mapa (é o que Botao.tsx manda usar em código novo) — R1 da #135, B4.
      const at = (nome: string) => (n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === nome) as ts.JsxAttribute | undefined)?.initializer;
      const lido = (i: ts.JsxAttributeValue | undefined, padrao: string) => (!i ? padrao : ts.isStringLiteral(i) ? i.text : ts.isJsxExpression(i) && i.expression ? valor(i.expression) : "?");
      itens.push(`<Botao> ${nomeDoElemento(n, sf) ?? ""} → ${lido(at("variante"), "primario")}/${lido(at("tamanho"), "md")}`.replace("<Botao>  →", "<Botao> →"));
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
  return rotulo.split(" · ").some((parte) => fragmentoDestrutivo(parte));
}

/**
 * Cada botão do design system no fonte — <button>/<Link>/<a> cujo className passa por botaoClasses
 * (direto ou por constante montada com ele) e todo <Botao> — com o nome (nomeDoElemento) e as
 * variantes possíveis: literal → ela; ternário → os dois lados; omitida → primario; outra expressão → "?".
 * Controles fora do design system não entram: a trava de botoesForaDoDesign já os lista por nome.
 */
export function variantesDosBotoes(fonte: string): { rotulo: string; variantes: string[]; fragmentos: string[] }[] {
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
  /**
   * Variantes de todas as chamadas a botaoClasses dentro de um nó, seguindo constantes PELO ESCOPO (uma
   * sombra noutra função não troca a variante do botão; follow-up #140, B1/T7).
   */
  const naExpressao = (raiz: ts.Node, vistos = new Set<ts.Node>()): string[] => {
    const v: string[] = [];
    const andar = (n: ts.Node) => {
      if (ehBotaoClasses(n)) { v.push(...daChamada(n)); return; }
      if (ts.isIdentifier(n) && ehReferencia(n)) {
        const valor = valorNoEscopo(n);
        if (valor && !vistos.has(valor)) { vistos.add(valor); v.push(...naExpressao(valor, vistos)); }
      }
      ts.forEachChild(n, andar);
    };
    andar(raiz);
    return v;
  };
  const atributo = (n: ts.JsxOpeningElement | ts.JsxSelfClosingElement, nome: string) =>
    n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === nome) as ts.JsxAttribute | undefined;
  const botoes: { rotulo: string; variantes: string[]; fragmentos: string[] }[] = [];
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
      if (variantes.length) botoes.push({ rotulo: nomeDoElemento(n, sf) ?? "(sem nome)", variantes, fragmentos: rotuloResolvido(n, sf).fragmentos });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return botoes;
}

/** Nomes dos botões do design system com rótulo destrutivo sem `perigo` entre as variantes possíveis. */
export function destrutivosSemPerigo(fonte: string): string[] {
  // Rótulo resolvido (constante, template, caixa, símbolo inicial) — não só o texto literal do nome.
  return variantesDosBotoes(fonte).filter((b) => (rotuloDestrutivo(b.rotulo) || b.fragmentos.some(fragmentoDestrutivo)) && !b.variantes.includes("perigo")).map((b) => b.rotulo);
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
  /** Condição normalizada e se veio negada (`!x`, `x === false`, `x !== true`, `a !== b` → negada). */
  const chave = (e: ts.Expression): [string, boolean] => condicaoNormalizada(e, sf);
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
            // Variante com perigo e rótulo destrutivo sob OUTRA condição: não dá para provar que o
            // destrutivo cai no ramo perigo — falha fechada (escreva as duas pela mesma condição).
            // (Textos sob um ternário da MESMA condição da variante são conferidos ramo a ramo abaixo.)
            const fora = (e: ts.Expression): string[] => {
              e = semParenteses(e);
              if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
              if (ts.isConditionalExpression(e)) return chave(e.condition)[0] === cv ? [] : [...fora(e.whenTrue), ...fora(e.whenFalse)];
              return [];
            };
            if (cr !== cv && [vSim, vNao].includes("perigo") && [...fora(m.whenTrue), ...fora(m.whenFalse)].some((t) => rotuloDestrutivo(t))) {
              desalinhados.push(`condições diferentes: variante por ${cv} × rótulo por ${cr}`);
            }
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
  {
    arquivo: "src/components/CopilotoSugestoes.tsx",
    rotulo: "Descartar",
    motivo: "descartar sugestão da IA é de baixo risco (a sugestão é regenerável); vermelho sólido em cada cartão chamaria mais atenção que aceitar",
  },
];

// ---------------------------------------------------------------------------------------------------
// Revisão R1 da #135: rótulo resolvido (constante, template, caixa, símbolo), falha fechada, tabelas de
// botão, condições normalizadas e aria-pressed ligado à condição da classe.
// Follow-up #140 (R3 da #135): em vez de enumerar formas, a trava resolve NOMES PELO ESCOPO (uma sombra
// noutra função não troca o valor; parâmetro não é constante), marca o trecho que não se resolve e exige
// que o COMEÇO do rótulo seja conhecido, lê objetos com spread e chave entre aspas, confere a polaridade
// dos atributos de estado, segue funções que decidem (locais, métodos e importadas do projeto) e varre os
// usos do componente de rótulo dinâmico em todo o src.
// ---------------------------------------------------------------------------------------------------

const VERBO_DESTRUTIVO_NO_MEIO = /\se\s(rejeitar|recusar|remover|excluir|apagar|descartar|desativar|inativar|revogar|encerrar|estornar|anular|cancelar)\b/i;
const PREFIXOS_DESTRUTIVOS = ["efetivar encerramento", "efetivar desistência"];

/**
 * Texto como a pessoa o lê (R1 da #148, B1; R2, B1): forma de compatibilidade (NFKC), sem nenhum
 * caractere que a tela não desenha — formatação (\p{Cf}: U+00AD, U+200B–U+200D, U+2060, U+FEFF…) e o
 * resto dos ignoráveis por padrão do Unicode (\p{Default_Ignorable_Code_Point}: o combining grapheme
 * joiner U+034F, os seletores de variação U+FE00–U+FE0F, os preenchedores Hangul U+115F/U+3164/U+1160…)
 * — e com todo espaço (NBSP, espaços tipográficos) virando um espaço comum. "Encer\u00adrar",
 * "Encer\u034frar" e "Encerrar\ufe0f" aparecem como "Encerrar" — e são comparados como "Encerrar".
 */
// U+2800 (braille em branco, categoria So) não é ignorável nem `\s`, mas a tela o desenha como espaço (R3, B1).
export const textoLido = (t: string) => t.normalize("NFKC").replace(/[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, "").replace(/[\s\u2800]+/gu, " ");

/**
 * Letra fora do alfabeto do português (R2 da #148, B2; R3, B2): o rótulo é em português, e um homóglifo
 * (E cirílico U+0415 em "Encerrar"; alfa LATINO U+0251; i sem ponto U+0131 em "Excluir") se lê como o verbo
 * sem casar com ele. Lista de inclusão — latim básico mais as letras do Latin-1 (acentos, ç, ª, º) —, e não
 * de exclusão por alfabeto: o próprio Script=Latin tem letras que se leem como outras. Sem tabela de
 * confusáveis: falha fechada — o pedaço conta como destrutivo (exige perigo ou exceção ancorada).
 */
const LETRA_FORA_DO_PORTUGUES = /(?=\p{L})[^A-Za-zªºÀ-ÖØ-öø-ÿ]/u;

/**
 * Um pedaço de rótulo nomeia ação destrutiva? Lido como na tela (textoLido), sem caixa e sem símbolo
 * inicial ("✕ Rejeitar", "rejeitar"); "Confirmar <destruição>" (inclui desistência); "Efetivar
 * encerramento/desistência"; e "… e descartar …". Letra de outro alfabeto: falha fechada (conta).
 */
export function fragmentoDestrutivo(fragmento: string): boolean {
  const t = textoLido(fragmento).replace(/^[^\p{L}]+/u, "").trim();
  const baixo = t.toLowerCase();
  if (LETRA_FORA_DO_PORTUGUES.test(t)) return true;
  if (!t || baixo === "cancelar") return false;
  return VERBOS_DESTRUTIVOS.some((v) => baixo === v.toLowerCase() || baixo.startsWith(`${v.toLowerCase()} `))
    || new RegExp(CONFIRMACAO_DESTRUTIVA.source, "i").test(t) || /^confirmar desistência(\s|$)/i.test(t)
    || PREFIXOS_DESTRUTIVOS.some((p) => baixo.startsWith(p)) || VERBO_DESTRUTIVO_NO_MEIO.test(` ${t}`);
}

/** Trecho de texto que não se resolve (substituição dinâmica num template, parte opaca de um "+"). */
const DESCONHECIDO = "\u0000";
/** Para mensagens: o trecho desconhecido aparece como "…". */
const legivel = (t: string) => t.split(DESCONHECIDO).join("…");
/**
 * O COMEÇO do texto (onde fica o verbo) é conhecido? "Excluir …" sim; "…", "… itens", "Encer…" e "✕ …"
 * não — a parte desconhecida pode completar ou ser o verbo (follow-up #140, B1: `"Encer" + x`). Texto
 * vazio ou só de símbolos não esconde nada.
 */
const comecoConhecido = (t: string) => {
  const s = t.replace(/^[^\p{L}\u0000]+/u, "");
  return s === "" || !s.split(/\s/)[0].includes(DESCONHECIDO);
};

/** Tira embrulhos que não mudam o valor: parênteses, `as`, `satisfies`, `<T>x`, `x!`. */
const semEmbrulho = (e: ts.Expression): ts.Expression => {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
  return e;
};

/** Nomes ligados por um padrão de declaração (`x`, `{ a, b: c }`, `[d, ...e]`). */
function nomesLigados(b: ts.BindingName): string[] {
  if (ts.isIdentifier(b)) return [b.text];
  return b.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : nomesLigados(el.name)));
}

const INCREMENTOS: ts.SyntaxKind[] = [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken];
/** O nome é reatribuído dentro do nó (`x = …`, `x += …`, `x++`)? */
function reatribuido(nome: string, escopo: ts.Node): boolean {
  let achou = false;
  const andar = (n: ts.Node) => {
    if (achou) return;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const alvo = semEmbrulho(n.left);
      if (ts.isIdentifier(alvo) && alvo.text === nome) achou = true;
    }
    if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && INCREMENTOS.includes(n.operator) && ts.isIdentifier(n.operand) && n.operand.text === nome) achou = true;
    ts.forEachChild(n, andar);
  };
  andar(escopo);
  return achou;
}

/** O identificador é uma referência a valor (não nome de propriedade, de atributo, de membro ou de tipo)? */
const ehReferencia = (n: ts.Identifier) => {
  const p = n.parent;
  return !((ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n)
    || ts.isJsxAttribute(p) || (ts.isBindingElement(p) && p.propertyName === n) || (ts.isQualifiedName(p) && p.right === n) || ts.isTypeReferenceNode(p)
    || ts.isPropertySignature(p) || ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === n));
};

type Declaracao =
  | { tipo: "valor"; valor: ts.Expression }
  | { tipo: "funcao"; funcao: ts.FunctionDeclaration | ts.FunctionExpression }
  | { tipo: "importado"; origem: string; nome: string }
  | { tipo: "opaco" };

/**
 * Declaração de um nome pelo ESCOPO (follow-up #140, B1/T7): sobe do uso até a declaração mais próxima —
 * bloco, cláusula de switch, função (parâmetros), laço, catch, arquivo — em vez de "o último const do
 * arquivo" (uma sombra noutra função trocava o valor). `const`, ou `let`/`var` nunca reatribuído, com
 * inicializador → o valor; função declarada → a função; import → a origem. Parâmetro, desestruturação,
 * reatribuição e o resto → "opaco"; nome sem declaração no arquivo → null. Quem chama trata os dois como
 * não resolvidos (falha fechada).
 */
function declaracaoNoEscopo(id: ts.Identifier): Declaracao | null {
  const nome = id.text;
  for (let p: ts.Node | undefined = id.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p)) {
      if (p.parameters.some((par) => nomesLigados(par.name).includes(nome))) return { tipo: "opaco" };
      if (ts.isFunctionExpression(p) && p.name?.text === nome) return { tipo: "funcao", funcao: p };
    }
    if (ts.isCatchClause(p) && p.variableDeclaration && nomesLigados(p.variableDeclaration.name).includes(nome)) return { tipo: "opaco" };
    if ((ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)) && p.initializer && ts.isVariableDeclarationList(p.initializer)
      && p.initializer.declarations.some((d) => nomesLigados(d.name).includes(nome))) return { tipo: "opaco" };
    const instrucoes = ts.isSourceFile(p) || ts.isBlock(p) || ts.isModuleBlock(p) || ts.isCaseClause(p) || ts.isDefaultClause(p) ? p.statements : undefined;
    if (!instrucoes) continue;
    for (const s of instrucoes) {
      if (ts.isVariableStatement(s)) {
        for (const d of s.declarationList.declarations) {
          if (!nomesLigados(d.name).includes(nome)) continue;
          if (!ts.isIdentifier(d.name) || !d.initializer) return { tipo: "opaco" };
          const constante = (s.declarationList.flags & ts.NodeFlags.Const) !== 0;
          return constante || !reatribuido(nome, p) ? { tipo: "valor", valor: d.initializer } : { tipo: "opaco" };
        }
      }
      if (ts.isFunctionDeclaration(s) && s.name?.text === nome) return s.body ? { tipo: "funcao", funcao: s } : { tipo: "opaco" };
      if ((ts.isClassDeclaration(s) || ts.isEnumDeclaration(s)) && s.name?.text === nome) return { tipo: "opaco" };
      if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)) {
        const c = s.importClause, b = c?.namedBindings;
        if (c?.name?.text === nome) return { tipo: "importado", origem: s.moduleSpecifier.text, nome: "default" };
        if (b && ts.isNamespaceImport(b) && b.name.text === nome) return { tipo: "opaco" };
        const e = b && ts.isNamedImports(b) ? b.elements.find((x) => x.name.text === nome) : undefined;
        if (e) return { tipo: "importado", origem: s.moduleSpecifier.text, nome: (e.propertyName ?? e.name).text };
      }
    }
  }
  return null;
}

/** Valor de um identificador pelo escopo; null se não for um valor resolvível (parâmetro, import, reatribuído…). */
const valorNoEscopo = (id: ts.Identifier): ts.Expression | null => {
  const d = declaracaoNoEscopo(id);
  return d?.tipo === "valor" ? d.valor : null;
};

/**
 * Textos que uma expressão pode mostrar (alternativas); DESCONHECIDO onde um pedaço não se resolve;
 * null = nada resolvível. Nomes pelo escopo; `+` e template combinam as partes (`"Encer" + "rar"` →
 * "Encerrar"; follow-up #140, B1/T5–T6).
 */
function alternativasDeTexto(e: ts.Node, prof = 0): string[] | null {
  if (prof > 8) return null;
  const rec = (x: ts.Node) => alternativasDeTexto(x, prof + 1);
  const combina = (a: string[], b: string[]) => a.flatMap((x) => b.map((y) => x + y)).slice(0, 32);
  const K = ts.SyntaxKind;
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e) || ts.isNonNullExpression(e)) return rec(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isJsxText(e) || ts.isNumericLiteral(e)) return [e.text];
  if ([K.NullKeyword, K.TrueKeyword, K.FalseKeyword].includes(e.kind)) return [""];
  if (ts.isTemplateExpression(e)) {
    let acc = [e.head.text];
    for (const s of e.templateSpans) acc = combina(combina(acc, rec(s.expression) ?? [DESCONHECIDO]), [s.literal.text]);
    return acc;
  }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === K.PlusToken) return combina(rec(e.left) ?? [DESCONHECIDO], rec(e.right) ?? [DESCONHECIDO]);
  if (ts.isConditionalExpression(e)) { const a = rec(e.whenTrue), b = rec(e.whenFalse); return a && b ? [...a, ...b] : null; }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === K.AmpersandAmpersandToken) return rec(e.right);
  if (ts.isBinaryExpression(e) && [K.BarBarToken, K.QuestionQuestionToken].includes(e.operatorToken.kind)) { const a = rec(e.left), b = rec(e.right); return a && b ? [...a, ...b] : null; }
  if (ts.isIdentifier(e)) {
    if (e.text === "undefined") return [""];
    const v = valorNoEscopo(e);
    return v ? rec(v) : null;
  }
  if (ts.isJsxSelfClosingElement(e)) return [""];
  if (ts.isJsxElement(e) || ts.isJsxFragment(e)) {
    // Os fragmentos de um elemento vêm em SEQUÊNCIA ("Notas internas" + " (N)"), não são alternativas:
    // viram um texto só, cujo começo é o do elemento.
    const r = conteudoDoRotulo(e.children, prof + 1);
    return r.completo ? [r.fragmentos.join(" ")] : null;
  }
  return null;
}

/**
 * Fragmentos de texto do conteúdo e se o rótulo foi resolvido: o COMEÇO é onde fica o verbo — um
 * pedaço dinâmico depois de texto resolvido ("Remover {data}") não esconde a ação; um começo dinâmico
 * ("{titulo}", "{ocupado ? '…' : rotulo}", "{`${n} itens`}", "{'Encer' + x}") esconde, e o botão cai
 * na falha fechada.
 */
function conteudoDoRotulo(filhos: ts.NodeArray<ts.JsxChild>, prof = 0): { fragmentos: string[]; completo: boolean } {
  const fragmentos: string[] = [];
  let completo = true;
  const somar = (alt: string[] | null) => {
    if ((alt === null || !alt.every(comecoConhecido)) && !fragmentos.some((t) => /\p{L}/u.test(t))) completo = false;
    if (alt) fragmentos.push(...alt.map((t) => t.trim()).filter(Boolean));
  };
  for (const f of filhos) {
    // Lido como na tela ANTES de juntar espaços: U+FEFF conta como espaço para `\s`, mas não aparece
    // ("Rejei\ufefftar" é "Rejeitar", não "Rejei tar") — R1 da #148, B1.
    if (ts.isJsxText(f)) { const t = textoLido(f.text).replace(/\s+/g, " ").trim(); if (t) fragmentos.push(t); continue; }
    if (ts.isJsxExpression(f)) { if (f.expression) somar(alternativasDeTexto(f.expression, prof)); continue; }
    somar(alternativasDeTexto(f as ts.Node, prof));
  }
  return { fragmentos, completo };
}

/** Rótulo resolvido de um botão: conteúdo visível; sem texto, aria-label/title. */
function rotuloResolvido(n: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile): { fragmentos: string[]; completo: boolean } {
  const conteudo = ts.isJsxOpeningElement(n) ? conteudoDoRotulo(n.parent.children) : { fragmentos: [], completo: true };
  if (conteudo.fragmentos.some((t) => /\p{L}/u.test(t)) || !conteudo.completo) return conteudo;
  for (const nome of ["aria-label", "title"]) {
    const a = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === nome) as ts.JsxAttribute | undefined;
    if (!a?.initializer) continue;
    if (ts.isStringLiteral(a.initializer)) return { fragmentos: [a.initializer.text], completo: true };
    if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
      const alt = alternativasDeTexto(a.initializer.expression);
      return alt === null || !alt.every(comecoConhecido) ? { fragmentos: alt ?? [], completo: false } : { fragmentos: alt, completo: true };
    }
  }
  return conteudo;
}

/** O botão tira variante e rótulo da MESMA linha de uma tabela (`variante: a.variante` com `{a.label}`)? */
function varianteDaTabela(n: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile): boolean {
  let objeto: string | null = null;
  const procura = (x: ts.Node) => {
    if (ts.isPropertyAssignment(x) && x.name.getText(sf) === "variante" && ts.isPropertyAccessExpression(x.initializer) && x.initializer.name.text === "variante") objeto = x.initializer.expression.getText(sf);
    ts.forEachChild(x, procura);
  };
  procura(n.attributes);
  if (!objeto || !ts.isJsxOpeningElement(n)) return false;
  return n.parent.children.some((c) => ts.isJsxExpression(c) && !!c.expression && ts.isPropertyAccessExpression(c.expression) && c.expression.expression.getText(sf) === objeto && /^(label|rotulo)$/.test(c.expression.name.text));
}

/**
 * Botões do design system cujo rótulo não dá para resolver estaticamente (prop, chamada, começo dinâmico,
 * linha de tabela sem a variante junto): falha fechada — cada um tem de estar em ROTULOS_DINAMICOS, com motivo.
 */
export function rotulosNaoResolvidos(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visita = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ehBotaoDoDesign(n, sf)) {
      const r = rotuloResolvido(n, sf);
      if (!r.completo && !varianteDaTabela(n, sf)) achados.push(nomeDoElemento(n, sf) ?? "(sem nome)");
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** <Botao>, ou <button>/<Link>/<a> com className que passa por botaoClasses (direto ou por constante no escopo). */
function ehBotaoDoDesign(n: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile): boolean {
  const tag = n.tagName.getText(sf);
  if (tag === "Botao") return true;
  if (!["button", "Link", "a"].includes(tag)) return false;
  const cls = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "className") as ts.JsxAttribute | undefined;
  if (!cls?.initializer) return false;
  const usa = (x: ts.Node, vistos = new Set<ts.Node>()): boolean => {
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === "botaoClasses") return true;
    if (ts.isIdentifier(x) && ehReferencia(x)) {
      const v = valorNoEscopo(x);
      if (v && !vistos.has(v)) { vistos.add(v); if (usa(v, vistos)) return true; }
    }
    return ts.forEachChild(x, (c) => usa(c, vistos) || undefined) ?? false;
  };
  return usa(cls.initializer);
}

/** Nome de propriedade sem aspas (`variante`, `"variante"`, `["variante"]`); null quando a chave é computada e não literal. */
function nomeDaPropriedade(nome: ts.PropertyName): string | null {
  if (ts.isIdentifier(nome) || ts.isStringLiteral(nome) || ts.isNumericLiteral(nome) || ts.isPrivateIdentifier(nome)) return nome.text;
  if (ts.isComputedPropertyName(nome)) {
    const alt = alternativasDeTexto(nome.expression);
    return alt?.length === 1 && !alt[0].includes(DESCONHECIDO) ? alt[0] : null;
  }
  return null;
}

/** Entrada de objeto literal: chave (null = pode ser qualquer chave: spread opaco, chave computada) e valor (null = opaco). */
type Entrada = { chave: string | null; valor: ts.Expression | null };

/** Objeto literal por trás da expressão (direto, embrulhado ou constante no escopo); null se não for. */
function objetoLiteral(e: ts.Expression, prof = 0): ts.ObjectLiteralExpression | null {
  if (prof > 6) return null;
  const x = semEmbrulho(e);
  if (ts.isObjectLiteralExpression(x)) return x;
  if (ts.isIdentifier(x)) { const v = valorNoEscopo(x); return v ? objetoLiteral(v, prof + 1) : null; }
  return null;
}

/** Entradas de um objeto literal, em ordem, abrindo o spread de objeto resolvível pelo escopo (`...NEUTRA`). */
function entradasDoObjeto(obj: ts.ObjectLiteralExpression, prof = 0): Entrada[] {
  return obj.properties.flatMap((p): Entrada[] => {
    if (ts.isPropertyAssignment(p)) return [{ chave: nomeDaPropriedade(p.name), valor: p.initializer }];
    if (ts.isShorthandPropertyAssignment(p)) return [{ chave: p.name.text, valor: p.name }];
    if (ts.isSpreadAssignment(p)) {
      const o = prof < 6 ? objetoLiteral(p.expression) : null;
      return o ? entradasDoObjeto(o, prof + 1) : [{ chave: null, valor: null }];
    }
    return [{ chave: nomeDaPropriedade(p.name), valor: null }]; // método ou acessor
  });
}

/** Valor de uma chave: a última entrada que a define; "opaco" se um spread/chave computada pode tê-la sobrescrito; undefined se ausente. */
function valorDaChave(entradas: Entrada[], chave: string): ts.Expression | "opaco" | undefined {
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    if (e.chave === null) return "opaco";
    if (e.chave === chave) return e.valor ?? "opaco";
  }
  return undefined;
}

/** Último valor CONCRETO de uma chave (ignora spread opaco): o rótulo que a linha mostra se o spread não o trocar. */
function ultimoValorConcreto(entradas: Entrada[], chave: string): ts.Expression | undefined {
  for (let i = entradas.length - 1; i >= 0; i--) if (entradas[i].chave === chave && entradas[i].valor) return entradas[i].valor!;
  return undefined;
}

/**
 * Linhas de tabela de botão (`{ label | rotulo, variante }`): rótulo destrutivo exige `perigo` em TODAS as
 * variantes possíveis. Os valores se resolvem (constante pelo escopo, `as`/`satisfies`, `+`, template,
 * ternário; R2 da #135, B1; follow-up #140, B1/T5–T7), a chave vale sem aspas (T9) e o spread do arquivo
 * entra na ordem (T8). Falha fechada: variante que um spread opaco pode sobrescrever vira "?", e rótulo
 * que não se lê numa linha com variante acusa.
 */
export function tabelasDeBotaoSemPerigo(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visita = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) {
      const entradas = entradasDoObjeto(n);
      const variante = valorDaChave(entradas, "variante");
      for (const chave of ["label", "rotulo"]) {
        // Rótulo possível: o último escrito na linha, mesmo com spread opaco depois (falha fechada — a
        // variante, essa sim, vira "?" quando um spread pode trocá-la).
        const rotulo = ultimoValorConcreto(entradas, chave) ?? valorDaChave(entradas, chave);
        if (rotulo === undefined || variante === undefined || (rotulo === "opaco" && variante === "opaco")) continue;
        const variantes = variante === "opaco" ? ["?"] : alternativasDeTexto(variante) ?? ["?"];
        const textos = rotulo === "opaco" ? null : alternativasDeTexto(rotulo);
        if (textos === null || !textos.every(comecoConhecido)) {
          if (variante !== "opaco") achados.push(`(rótulo não resolvível) → ${variantes.join("|")}`);
        } else if (textos.some(fragmentoDestrutivo) && !variantes.every((v) => v === "perigo")) achados.push(`${textos.map(legivel).join(" · ")} → ${variantes.join("|")}`);
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** Texto da expressão sem espaços, trocando parâmetros pelos argumentos da chamada (`atual` → `tipo`). */
function textoCom(e: ts.Node, sf: ts.SourceFile, subst?: ReadonlyMap<string, string>): string {
  const bruto = e.getText(sf);
  if (!subst?.size) return bruto.replace(/\s+/g, "");
  const mapa: ReadonlyMap<string, string> = subst;
  const inicio = e.getStart(sf);
  const trocas: [number, number, string][] = [];
  const andar = (n: ts.Node) => {
    if (ts.isIdentifier(n) && mapa.has(n.text) && ehReferencia(n)) trocas.push([n.getStart(sf) - inicio, n.end - inicio, mapa.get(n.text)!]);
    ts.forEachChild(n, andar);
  };
  andar(e);
  let saida = bruto;
  for (const [de, ate, por] of trocas.sort((a, b) => b[0] - a[0])) saida = saida.slice(0, de) + por + saida.slice(ate);
  return saida.replace(/\s+/g, "");
}

/** Igualdade sem ordem: `tipo === t` e `t === tipo` são a mesma condição. */
const igualdade = (a: string, b: string) => [a, b].sort().join("===");

/**
 * Condição normalizada: `x === true` → x; `x === false`/`x !== true`/`!x` → ¬x; `a !== b` → ¬(a === b); a
 * igualdade não depende da ordem dos lados. Com `subst`, os parâmetros de uma função viram os argumentos.
 */
export function condicaoNormalizada(e: ts.Expression, sf: ts.SourceFile, subst?: ReadonlyMap<string, string>): [string, boolean] {
  const K = ts.SyntaxKind;
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isPrefixUnaryExpression(e) && e.operator === K.ExclamationToken) { const [c, n] = condicaoNormalizada(e.operand, sf, subst); return [c, !n]; }
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind, dir = e.right.kind;
    if ([K.EqualsEqualsEqualsToken, K.EqualsEqualsToken].includes(op) && dir === K.TrueKeyword) return condicaoNormalizada(e.left, sf, subst);
    if ([K.ExclamationEqualsEqualsToken, K.ExclamationEqualsToken].includes(op) && dir === K.FalseKeyword) return condicaoNormalizada(e.left, sf, subst);
    if ([K.EqualsEqualsEqualsToken, K.EqualsEqualsToken].includes(op) && dir === K.FalseKeyword) { const [c, n] = condicaoNormalizada(e.left, sf, subst); return [c, !n]; }
    if ([K.ExclamationEqualsEqualsToken, K.ExclamationEqualsToken].includes(op) && dir === K.TrueKeyword) { const [c, n] = condicaoNormalizada(e.left, sf, subst); return [c, !n]; }
    if ([K.ExclamationEqualsEqualsToken, K.ExclamationEqualsToken].includes(op)) return [igualdade(textoCom(e.left, sf, subst), textoCom(e.right, sf, subst)), true];
    if ([K.EqualsEqualsEqualsToken, K.EqualsEqualsToken].includes(op)) return [igualdade(textoCom(e.left, sf, subst), textoCom(e.right, sf, subst)), false];
  }
  return [textoCom(e, sf, subst), false];
}

const OPERADORES_CONDICIONAIS: ts.SyntaxKind[] = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken];
const IGUALDADES: ts.SyntaxKind[] = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];

/** Árvore sintática; o tipo de script segue a extensão (.ts não é lido como TSX: `<T>(x)` viraria JSX). */
const arvoreDe = (fonte: string, arquivo: string) =>
  ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX);

/** Caminho do arquivo do projeto que o import aponta ("./X", "../X", "@/X"), entre os que `existe` aceita. */
function resolverModulo(de: string, origem: string, existe: (caminho: string) => boolean = existsSync): string | null {
  const base = origem.startsWith("@/") ? "src/" + origem.slice(2) : origem.startsWith(".") ? posix.join(posix.dirname(de), origem) : null;
  if (!base) return null;
  return [".tsx", ".ts", "/index.tsx", "/index.ts"].map((ext) => base + ext).find((c) => existe(c)) ?? null;
}
const modulosLidos = new Map<string, ts.SourceFile>();

type FuncaoAnalisavel = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration;
/** Função de nível de arquivo com esse nome (declaração, ou const com arrow/function). */
function funcaoDoArquivo(sf: ts.SourceFile, nome: string): FuncaoAnalisavel | null {
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.name?.text === nome && s.body) return s;
    if (!ts.isVariableStatement(s)) continue;
    for (const d of s.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== nome || !d.initializer) continue;
      const f = semEmbrulho(d.initializer);
      if (ts.isArrowFunction(f) || ts.isFunctionExpression(f)) return f;
    }
  }
  return null;
}

/** Uma condição normalizada (chave + se veio negada) e o texto original, para comparar polaridades. */
type Condicao = { chave: string; neg: boolean; texto: string };

/**
 * Alternância sem aria-pressed (docs/42, /configuracao/turmas #6 e similares): <button>/<Botao> cuja
 * aparência muda conforme uma condição — className (ou variante/tamanho) com ternário, `&&`, `||`,
 * `??`, direto, por variável no escopo ou por função que DECIDE (ternário, if, comparação, switch/case,
 * consulta a objeto de chave computada), seja do arquivo, método de objeto do arquivo ou importada do
 * projeto (analisada na origem) — mostra a seleção só por cor. Ficam de fora:
 * - quem declara aria-pressed com a condição da classe, na mesma polaridade (dentro de função, a
 *   comparação com os parâmetros trocados pelos argumentos: `estilo(tipo, t)` ↔ `tipo === t`);
 * - quem anuncia o estado em aria-current/aria-expanded com a MESMA condição e a MESMA polaridade da
 *   classe (follow-up #140, B2). aria-haspopup não isenta: diz que o botão abre algo, não o estado — um
 *   botão de menu anuncia o estado em aria-expanded;
 * - quem troca o nome PELA MESMA condição (texto visível ou aria-label): é uma ação que muda de rótulo
 *   ("Desativar"/"Ativar", "Gravar"/"Parar"), não um botão de alternância — e aria-pressed com rótulo
 *   que muda confunde o leitor de tela.
 * Devolve o nome de cada um (nomeDoElemento). `arquivo` resolve imports do projeto; `modulos` dá fontes
 * virtuais por especificador de import (autoteste).
 */
export function alternanciasSemAriaPressed(fonte: string, arquivo = "x.tsx", modulos: Record<string, string> = {}): string[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const K = ts.SyntaxKind;
  const cond = (e: ts.Expression): Condicao => {
    const s = e.getSourceFile();
    const [chave, neg] = condicaoNormalizada(e, s);
    return { chave, neg, texto: textoCom(e, s) };
  };
  const lerModulo = (de: ts.SourceFile, origem: string): ts.SourceFile | null => {
    if (origem in modulos) return arvoreDe(modulos[origem], `${origem}.tsx`);
    const caminho = resolverModulo(de.fileName, origem);
    if (!caminho) return null;
    if (!modulosLidos.has(caminho)) modulosLidos.set(caminho, arvoreDe(readFileSync(caminho, "utf-8"), caminho));
    return modulosLidos.get(caminho)!;
  };
  const funcaoDe = (d: Declaracao | null, de: ts.SourceFile): FuncaoAnalisavel | null => {
    if (d?.tipo === "funcao") return d.funcao;
    if (d?.tipo === "valor") { const f = semEmbrulho(d.valor); return ts.isArrowFunction(f) || ts.isFunctionExpression(f) ? f : null; }
    if (d?.tipo === "importado") { const m = lerModulo(de, d.origem); return m ? funcaoDoArquivo(m, d.nome) : null; }
    return null;
  };
  /** Função chamada: pelo escopo (local ou importada) ou método de objeto do arquivo (`E.estilo`); null se externa. */
  const funcaoChamada = (callee: ts.Expression): FuncaoAnalisavel | null => {
    const x = semEmbrulho(callee);
    if (ts.isIdentifier(x)) return funcaoDe(declaracaoNoEscopo(x), x.getSourceFile());
    if (!ts.isPropertyAccessExpression(x)) return null;
    const o = objetoLiteral(x.expression);
    const p = o?.properties.find((q) => !ts.isSpreadAssignment(q) && nomeDaPropriedade(q.name) === x.name.text);
    if (p && ts.isMethodDeclaration(p)) return p;
    if (p && ts.isPropertyAssignment(p)) { const f = semEmbrulho(p.initializer); return ts.isArrowFunction(f) || ts.isFunctionExpression(f) ? f : null; }
    if (p && ts.isShorthandPropertyAssignment(p)) return funcaoDe(declaracaoNoEscopo(p.name), p.getSourceFile());
    return null;
  };
  /**
   * Decisões do corpo de uma função, com os parâmetros trocados pelos argumentos da chamada: ternário, if,
   * `&&`/`||`/`??`, comparação, `switch (a) { case b: … }` (→ a === b) e consulta a objeto de chave
   * computada (`({ [a]: … })[b]` → a === b) — follow-up #140, B4. Vazio = a função não decide.
   */
  const decisoesDaFuncao = (fn: FuncaoAnalisavel, args: readonly ts.Expression[]): Condicao[] => {
    if (!fn.body) return [];
    const fsf = fn.getSourceFile();
    const subst = new Map<string, string>();
    fn.parameters.forEach((p, i) => { if (ts.isIdentifier(p.name) && args[i]) subst.set(p.name.text, textoCom(args[i], args[i].getSourceFile())); });
    const achadas: Condicao[] = [];
    const c = (e: ts.Expression) => { const [chave, neg] = condicaoNormalizada(e, fsf, subst); achadas.push({ chave, neg, texto: textoCom(e, fsf, subst) }); };
    const iguais = (a: ts.Expression, b: ts.Expression) => { const chave = igualdade(textoCom(a, fsf, subst), textoCom(b, fsf, subst)); achadas.push({ chave, neg: false, texto: chave }); };
    const andar = (n: ts.Node) => {
      if (ts.isConditionalExpression(n)) c(n.condition);
      else if (ts.isIfStatement(n)) c(n.expression);
      else if (ts.isBinaryExpression(n) && OPERADORES_CONDICIONAIS.includes(n.operatorToken.kind)) c(n.left);
      else if (ts.isBinaryExpression(n) && IGUALDADES.includes(n.operatorToken.kind)) c(n);
      else if (ts.isSwitchStatement(n)) { for (const cl of n.caseBlock.clauses) if (ts.isCaseClause(cl)) iguais(n.expression, cl.expression); }
      else if (ts.isElementAccessExpression(n)) {
        const o = objetoLiteral(n.expression);
        for (const p of o?.properties ?? []) if (!ts.isSpreadAssignment(p) && p.name && ts.isComputedPropertyName(p.name)) iguais(n.argumentExpression, p.name.expression);
      }
      ts.forEachChild(n, andar);
    };
    andar(fn.body);
    return achadas;
  };
  /** Expressão booleana (comparação, negação, lógica): o que decide uma seleção. */
  const booleana = (e: ts.Expression): boolean => {
    while (ts.isParenthesizedExpression(e)) e = e.expression;
    return (ts.isPrefixUnaryExpression(e) && e.operator === K.ExclamationToken)
      || (ts.isBinaryExpression(e) && [K.EqualsEqualsEqualsToken, K.EqualsEqualsToken, K.ExclamationEqualsEqualsToken, K.ExclamationEqualsToken, K.LessThanToken, K.GreaterThanToken, K.LessThanEqualsToken, K.GreaterThanEqualsToken, K.AmpersandAmpersandToken, K.BarBarToken].includes(e.operatorToken.kind));
  };
  /**
   * Condições de que uma expressão de classe depende, seguindo nomes pelo escopo: ternário, `&&`/`||`/`??`,
   * tabela indexada por booleano (`ESTILO[String(x === y)]`), chamada com argumento booleano
   * (`estiloSelecao(x === y)`) e chamada a função que decide (`estilo(tipo, t)`).
   */
  const condicoesDe = (raiz: ts.Node, vistos = new Set<ts.Node>()): Condicao[] => {
    const achadas: Condicao[] = [];
    const andar = (n: ts.Node) => {
      if (ts.isConditionalExpression(n)) achadas.push(cond(n.condition));
      else if (ts.isBinaryExpression(n) && OPERADORES_CONDICIONAIS.includes(n.operatorToken.kind)) achadas.push(cond(n.left));
      else if (ts.isElementAccessExpression(n)) { const procura = (x: ts.Node) => { if (ts.isExpression(x) && booleana(x)) achadas.push(cond(x)); else ts.forEachChild(x, procura); }; procura(n.argumentExpression); }
      else if (ts.isCallExpression(n) && !(ts.isIdentifier(n.expression) && n.expression.text === "botaoClasses")) {
        for (const a of n.arguments) if (booleana(a)) achadas.push(cond(a));
        const fn = funcaoChamada(n.expression);
        if (fn) { achadas.push(...decisoesDaFuncao(fn, n.arguments)); n.arguments.forEach(andar); return; }
      }
      else if (ts.isIdentifier(n) && ehReferencia(n)) {
        const v = valorNoEscopo(n);
        if (v && !vistos.has(v)) { vistos.add(v); achadas.push(...condicoesDe(v, vistos)); }
      }
      ts.forEachChild(n, andar);
    };
    andar(raiz);
    return achadas;
  };
  /** Condições de ternários que produzem texto no conteúdo visível (sem entrar em atributos dos filhos). */
  const condicoesDoTexto = (el: ts.JsxElement): Condicao[] => {
    const achadas: Condicao[] = [];
    const temTexto = (n: ts.Node): boolean =>
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n) || (ts.isJsxText(n) && n.getText(sf).trim() !== "") ||
      (!ts.isJsxAttributes(n) && (ts.forEachChild(n, temTexto) ?? false));
    const andar = (n: ts.Node) => {
      if (ts.isJsxAttributes(n)) return;
      if (ts.isConditionalExpression(n) && (temTexto(n.whenTrue) || temTexto(n.whenFalse))) achadas.push(cond(n.condition));
      ts.forEachChild(n, andar);
    };
    for (const c of el.children) andar(c);
    return achadas;
  };
  // ids do arquivo, para conferir aria-labelledby (follow-up #140, B3/A16f): literais e expressões.
  const idsLiterais = new Set<string>(), idsExpressoes = new Set<string>();
  const coletarIds = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && n.name.getText(sf) === "id" && n.initializer) {
      if (ts.isStringLiteral(n.initializer)) idsLiterais.add(n.initializer.text);
      else if (ts.isJsxExpression(n.initializer) && n.initializer.expression) {
        const alt = alternativasDeTexto(n.initializer.expression);
        if (alt && alt.every((t) => !t.includes(DESCONHECIDO))) alt.forEach((t) => idsLiterais.add(t));
        else idsExpressoes.add(textoCom(n.initializer.expression, sf));
      }
    }
    ts.forEachChild(n, coletarIds);
  };
  coletarIds(sf);
  const atributoDe = (ab: ts.JsxOpeningElement | ts.JsxSelfClosingElement, nome: string) =>
    ab.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === nome) as ts.JsxAttribute | undefined;
  /** aria-label que nomeia: texto com letras (literal, ou expressão resolvida); `""`, `{``}`, `{undefined}` e expressão opaca não (B3). */
  const nomeia = (a: ts.JsxAttribute | undefined): boolean => {
    const v = a?.initializer;
    if (!v) return false;
    if (ts.isStringLiteral(v)) return /\p{L}/u.test(v.text);
    const alt = ts.isJsxExpression(v) && v.expression ? alternativasDeTexto(v.expression) : null;
    return !!alt && alt.length > 0 && alt.every((t) => /\p{L}/u.test(t));
  };
  /** aria-labelledby que aponta para id existente NO ARQUIVO: cada id literal, ou a mesma expressão de um `id={…}` (B3/A16f). */
  const apontaParaId = (a: ts.JsxAttribute | undefined): boolean => {
    const v = a?.initializer;
    const todosExistem = (t: string) => { const lista = t.trim().split(/\s+/).filter(Boolean); return lista.length > 0 && lista.every((id) => idsLiterais.has(id)); };
    if (!v) return false;
    if (ts.isStringLiteral(v)) return todosExistem(v.text);
    if (!ts.isJsxExpression(v) || !v.expression) return false;
    const alt = alternativasDeTexto(v.expression);
    if (alt && alt.every((t) => !t.includes(DESCONHECIDO))) return alt.every(todosExistem);
    return idsExpressoes.has(textoCom(v.expression, sf));
  };
  /** Está dentro de um grupo rotulado (`role="group"` com nome de verdade, ou <fieldset> com <legend>/nome)? */
  const emGrupoRotulado = (n: ts.Node): boolean => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (!ts.isJsxElement(p) || p.openingElement === n) continue;
      const ab = p.openingElement;
      const nomeado = nomeia(atributoDe(ab, "aria-label")) || apontaParaId(atributoDe(ab, "aria-labelledby"));
      if (ab.tagName.getText(sf) === "fieldset") {
        const legenda = p.children.some((c) => ts.isJsxElement(c) && c.openingElement.tagName.getText(sf) === "legend" && conteudoDoRotulo(c.children).fragmentos.some((t) => /\p{L}/u.test(t)));
        if (legenda || nomeado) return true;
      }
      const role = atributoDe(ab, "role")?.initializer;
      if (role && ts.isStringLiteral(role) && role.text === "group" && nomeado) return true;
    }
    return false;
  };
  /** Valor de atributo ARIA que não diz nada: ausente, literal booleano/nulo/texto, `undefined`. */
  const constante = (ini: ts.JsxAttributeValue | undefined): boolean => {
    const expr = ini && ts.isJsxExpression(ini) ? ini.expression : undefined;
    return !expr || ts.isStringLiteral(ini!) || [K.TrueKeyword, K.FalseKeyword, K.NullKeyword].includes(expr.kind) || ts.isStringLiteral(expr)
      || ts.isNoSubstitutionTemplateLiteral(expr) || (ts.isIdentifier(expr) && expr.text === "undefined");
  };
  /**
   * Quando aria-current/aria-expanded ANUNCIA o estado: a condição e a polaridade (follow-up #140, B2).
   * `c ? "page" : undefined` → c; `c ? undefined : "true"` → ¬c; `c && "page"` → c; `{c}` → c. Constante,
   * ou ternário cujos dois lados anunciam (ou nenhum), não anuncia nada → null.
   */
  const anuncio = (ini: ts.JsxAttributeValue | undefined): Condicao | null => {
    const bruto = ini && ts.isJsxExpression(ini) ? ini.expression : undefined;
    if (!bruto || constante(ini)) return null;
    const e = semEmbrulho(bruto);
    const anuncia = (x: ts.Expression): boolean | null => {
      const y = semEmbrulho(x);
      if (ts.isStringLiteral(y) || ts.isNoSubstitutionTemplateLiteral(y)) return y.text !== "" && y.text !== "false";
      if (y.kind === K.TrueKeyword) return true;
      if (y.kind === K.FalseKeyword || y.kind === K.NullKeyword || (ts.isIdentifier(y) && y.text === "undefined")) return false;
      return null;
    };
    if (ts.isConditionalExpression(e)) {
      const sim = anuncia(e.whenTrue), nao = anuncia(e.whenFalse), c = cond(e.condition);
      return sim === true && nao === false ? c : sim === false && nao === true ? { ...c, neg: !c.neg } : null;
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === K.AmpersandAmpersandToken) return anuncia(e.right) === true ? cond(e.left) : null;
    return cond(e);
  };
  const mesma = (a: Condicao, b: Condicao) => a.chave === b.chave && a.neg === b.neg;
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ["button", "Botao"].includes(n.tagName.getText(sf))) {
      const attrs = new Map(n.attributes.properties.filter(ts.isJsxAttribute).map((a) => [a.name.getText(sf), a.initializer] as const));
      const daClasse = ["className", "variante", "tamanho"].flatMap((nome) => (attrs.get(nome) ? condicoesDe(attrs.get(nome)!) : []));
      const doNome = [...(ts.isJsxOpeningElement(n) ? condicoesDoTexto(n.parent) : []), ...(attrs.get("aria-label") ? condicoesDe(attrs.get("aria-label")!) : [])];
      const nome = nomeDoElemento(n, sf) ?? "(sem nome)";
      if (attrs.has("aria-pressed")) {
        // aria-pressed precisa dizer o estado de verdade: expressão (não constante) igual a uma condição
        // da classe, com a mesma polaridade — também a de dentro da função que decide; botão de rótulo
        // que muda não é alternância; e o conjunto é um grupo rotulado (R1 da #135, B3/B5; #140, B4).
        const ini = attrs.get("aria-pressed");
        if (constante(ini)) achados.push(`${nome} — aria-pressed constante`);
        else if (daClasse.length && !daClasse.some((c) => mesma(c, cond((ini as ts.JsxExpression).expression!)))) achados.push(`${nome} — aria-pressed não é a condição da classe`);
        // Rótulo que muda PELA MESMA condição da seleção (o nome escolhido pelo item da lista não conta).
        if (doNome.some((c) => daClasse.some((d) => d.chave === c.chave))) achados.push(`${nome} — aria-pressed com rótulo que muda`);
        if (!emGrupoRotulado(n)) achados.push(`${nome} — aria-pressed fora de grupo rotulado`);
      } else if (daClasse.length) {
        const isentoPorEstado = ["aria-current", "aria-expanded"].some((a) => {
          const c = anuncio(attrs.get(a));
          return !!c && daClasse.some((d) => mesma(c, d));
        });
        const textosDoNome = doNome.map((c) => c.texto);
        if (!isentoPorEstado && !daClasse.some((c) => textosDoNome.includes(c.texto))) achados.push(nome);
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
    // <Botao> entra no mapa (R1 da #135, B4).
    expect(mapaDeBotoes('<Botao variante="perigo" tamanho="sm">Excluir</Botao>')).toEqual(["<Botao> Excluir → perigo/sm"]);
    expect(mapaDeBotoes("<Botao>Salvar</Botao>")).toEqual(["<Botao> Salvar → primario/md"]);
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
    // Condições diferentes: não dá para provar o alinhamento — falha fechada (R1 da #135, B3).
    expect(ramosDestrutivosDesalinhados(b('ativo ? "perigo" : "fantasma"', 'ocupado ? "Desativando…" : "Desativar"'))).toEqual(["condições diferentes: variante por ativo × rótulo por ocupado"]);
    // Normalização: `!== true`, `=== false`, `!==` valem como negação — a inversão escrita de outro jeito acusa.
    expect(ramosDestrutivosDesalinhados(b('ativo !== true ? "perigo" : "fantasma"', 'ativo ? "Desativar" : "Ativar"'))).toEqual(["Desativar → fantasma"]);
    expect(ramosDestrutivosDesalinhados(b('ativo === false ? "perigo" : "fantasma"', 'ativo ? "Desativar" : "Ativar"'))).toEqual(["Desativar → fantasma"]);
    expect(ramosDestrutivosDesalinhados(b('x !== "revogar" ? "perigo" : "secundario"', 'x === "revogar" ? "Revogar" : "Registrar"'))).toEqual(["Revogar → secundario"]);
    expect(ramosDestrutivosDesalinhados(b('ativo === true ? "perigo" : "fantasma"', 'ativo ? "Desativar" : "Ativar"'))).toEqual([]);
    // Ternário externo de outra condição com o da mesma condição dentro: o de dentro é conferido ramo a ramo.
    expect(ramosDestrutivosDesalinhados(b('x === "revogar" ? "perigo" : "secundario"', 'ocupado ? "Aguarde…" : x === "revogar" ? "Revogar" : "Registrar"'))).toEqual([]);
  });

  it("rotuloDestrutivo: lista fechada de verbos; Cancelar sozinho (fechar) não conta; Cancelar <algo> e Confirmar <destruição> contam", () => {
    for (const r of ["Rejeitar", "Rejeitar proposta", "Remover campo", "Excluir", "Revogar designação", "Encerrar", "Descartar relato sem pausar",
      "Cancelar e liberar reserva", "Registrando… · Confirmar rejeição", "Confirmar perda", "Desativar · Ativar", "Ativar · Desativar", "Inativar empresa · Reativar empresa",
      // R1 da #135 (B2/B4): sem caixa, com símbolo inicial, desistência, efetivar encerramento/desistência e "… e descartar …".
      "Registrando… · revogar", "rejeitar janela", "✕ Rejeitar janela", "Confirmar desistência e liberar reservas", "Efetivar encerramento aprovado",
      "Efetivar desistência", "Reabrir formulário e descartar preenchimento"])
      expect(rotuloDestrutivo(r), r).toBe(true);
    for (const r of ["Cancelar", "Fechar · Cancelar", "Cancelar · Editar", "Rejeitando…", "Removido", "Arquivar", "Reativar", "Ativar",
      "Confirmar divergência material", "Salvar", "Aprovar proposta", "Reabrir formulário", "Efetivar matrícula"])
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
      .flatMap(({ arquivo, conteudo }) => alternanciasSemAriaPressed(conteudo, arquivo).map((rotulo) => ({ arquivo, rotulo })));
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

  it("alternanciasSemAriaPressed (R1 da #135, B3/B5): aria-pressed constante, invertido, solto do grupo ou em botão de rótulo que muda acusa; classe por índice ou função também é seleção", () => {
    const grupo = (botao: string) => `<div role="group" aria-label="Dias">${botao}</div>`;
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed={true} className={ativo ? "bg-brand-600" : ""}>Seg</button>'))).toEqual(["Seg — aria-pressed constante"]);
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed="false" className={ativo ? "bg-brand-600" : ""}>Seg</button>'))).toEqual(["Seg — aria-pressed constante"]);
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed={undefined} className={ativo ? "bg-brand-600" : ""}>Seg</button>'))).toEqual(["Seg — aria-pressed constante"]);
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed={filtro !== d.chave} className={filtro === d.chave ? "bg-brand-600" : ""}>Seg</button>'))).toEqual(["Seg — aria-pressed não é a condição da classe"]);
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed={outra} className={ativo ? "bg-brand-600" : ""}>Seg</button>'))).toEqual(["Seg — aria-pressed não é a condição da classe"]);
    expect(alternanciasSemAriaPressed('<div role="group"><button aria-pressed={ativo} className={ativo ? "bg-brand-600" : ""}>Seg</button></div>')).toEqual(["Seg — aria-pressed fora de grupo rotulado"]);
    expect(alternanciasSemAriaPressed('<div><button aria-pressed={ativo} className={ativo ? "bg-brand-600" : ""}>Seg</button></div>')).toEqual(["Seg — aria-pressed fora de grupo rotulado"]);
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed={ativo} className={botaoClasses({ variante: ativo ? "perigo" : "fantasma" })}>{ativo ? "Desativar" : "Ativar"}</button>'))).toEqual(["Desativar · Ativar — aria-pressed com rótulo que muda"]);
    // Seleção por tabela indexada ou função importada, sem aria-pressed.
    expect(alternanciasSemAriaPressed('<button className={ESTILO[String(tipo === t)]}>PF</button>')).toEqual(["PF"]);
    expect(alternanciasSemAriaPressed('<button className={estiloSelecao(filtro === d.chave)}>Todos</button>')).toEqual(["Todos"]);
  });

  it("alternanciasSemAriaPressed: isenta aria-pressed, quem abre/navega e quem troca o nome pela mesma condição", () => {
    const grupo = (botao: string) => `<div role="group" aria-label="Dias">${botao}</div>`;
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed={ativo} className={"chip " + (ativo ? "bg-brand-600" : "")}>Seg</button>'))).toEqual([]);
    expect(alternanciasSemAriaPressed(grupo('<Botao aria-pressed={on} variante={on ? "primario" : "secundario"}>Mensal</Botao>'))).toEqual([]);
    expect(alternanciasSemAriaPressed('<fieldset><legend>Dias</legend><button aria-pressed={ativo} className={ativo ? "bg-brand-600" : ""}>Seg</button></fieldset>')).toEqual([]);
    // Normalização: `=== true` é a mesma condição.
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed={ativo === true} className={ativo ? "bg-brand-600" : ""}>Seg</button>'))).toEqual([]);
    // Rótulo escolhido pelo item da lista (não pela seleção) não é "rótulo que muda".
    expect(alternanciasSemAriaPressed(grupo('<button aria-pressed={tipo === t} className={tipo === t ? "bg-brand-600" : ""}>{t === "pf" ? "Pessoa Física" : "Empresa"}</button>'))).toEqual([]);
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

/**
 * Usos de um componente cujo atributo (ou propriedade dele) vira o rótulo de um botão, em TODOS os
 * arquivos dados — não numa lista fixa (follow-up #140, B6). O componente é reconhecido pelo nome
 * declarado no módulo, por import com qualquer nome (`import { Formulario as G }`), por namespace
 * (`<M.Formulario>`), por alias (`const F = Formulario`) e pelos aliases que o próprio módulo exporta;
 * num arquivo sem declaração do nome, a tag homônima também conta. Falha fechada: spread de props,
 * valor que não se resolve, referência fora de JSX (`createElement(Formulario, …)`, passar adiante) e
 * reexportação viram problema. Devolve os textos resolvidos e os problemas (com arquivo:linha).
 */
export function usosDoComponente(
  fontes: { arquivo: string; conteudo: string }[], declaradoEm: string, componente: string, atributo: string, propriedade?: string,
): { valores: string[]; problemas: string[] } {
  const existentes = new Set(fontes.map((f) => f.arquivo));
  const doModulo = (de: string, origem: string) => resolverModulo(de, origem, (c) => existentes.has(c)) === declaradoEm;
  const valores: string[] = [], problemas: string[] = [];
  const exportados = new Set([componente]);
  const exportado = (n: ts.VariableStatement) => !!n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const ordenadas = [...fontes].sort((a, b) => (a.arquivo === declaradoEm ? -1 : b.arquivo === declaradoEm ? 1 : 0));
  for (const { arquivo, conteudo } of ordenadas) {
    const sf = arvoreDe(conteudo, arquivo);
    const linha = (n: ts.Node) => `${arquivo}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
    const declarante = arquivo === declaradoEm;
    const ligados = new Set<string>(declarante ? [componente] : []), espacos = new Set<string>();
    let homonimo = false;
    for (const s of sf.statements) {
      if (ts.isExportDeclaration(s) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier) && doModulo(arquivo, s.moduleSpecifier.text)) problemas.push(`${linha(s)}: reexporta o módulo de <${componente}>`);
      if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
      const c = s.importClause, b = c?.namedBindings, deLa = doModulo(arquivo, s.moduleSpecifier.text);
      if (c?.name) { if (c.name.text === componente) homonimo = true; if (deLa && exportados.has("default")) ligados.add(c.name.text); }
      if (b && ts.isNamespaceImport(b) && deLa) espacos.add(b.name.text);
      if (b && ts.isNamedImports(b)) for (const e of b.elements) {
        if (e.name.text === componente) homonimo = true;
        if (deLa && exportados.has((e.propertyName ?? e.name).text)) ligados.add(e.name.text);
      }
    }
    const declaraONome = (n: ts.Node) => {
      if (((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === componente) || (ts.isVariableDeclaration(n) && nomesLigados(n.name).includes(componente))) homonimo = true;
      ts.forEachChild(n, declaraONome);
    };
    if (!declarante) declaraONome(sf);
    const livre = !declarante && !homonimo && !ligados.has(componente);
    /** A expressão é o componente: nome ligado ou `M.<exportado>` de um namespace do módulo. */
    const ehComponente = (e: ts.Node): boolean => (ts.isIdentifier(e) && ligados.has(e.text))
      || (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && espacos.has(e.expression.text) && exportados.has(e.name.text));
    // Aliases (ponto fixo): `const F = Formulario`, `const F = M.Formulario`, `const { Formulario: F } = M`.
    for (let mudou = true; mudou;) {
      mudou = false;
      const marcar = (nome: string) => { if (!ligados.has(nome)) { ligados.add(nome); mudou = true; } };
      const visita = (n: ts.Node) => {
        if (ts.isVariableDeclaration(n) && n.initializer) {
          const v = semEmbrulho(n.initializer);
          if (ts.isIdentifier(n.name) && ehComponente(v)) marcar(n.name.text);
          if (ts.isObjectBindingPattern(n.name) && ts.isIdentifier(v) && espacos.has(v.text)) {
            for (const el of n.name.elements) {
              const chave = el.propertyName ? nomeDaPropriedade(el.propertyName) : ts.isIdentifier(el.name) ? el.name.text : null;
              if (chave && exportados.has(chave) && ts.isIdentifier(el.name)) marcar(el.name.text);
            }
          }
        }
        ts.forEachChild(n, visita);
      };
      visita(sf);
    }
    const analisar = (n: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
      if (n.attributes.properties.some(ts.isJsxSpreadAttribute)) { problemas.push(`${linha(n)}: <${componente}> com spread de props`); return; }
      const at = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === atributo) as ts.JsxAttribute | undefined;
      let expr: ts.Expression | undefined = at?.initializer ? (ts.isStringLiteral(at.initializer) ? at.initializer : ts.isJsxExpression(at.initializer) ? at.initializer.expression : undefined) : undefined;
      if (expr && propriedade) {
        const o = objetoLiteral(expr);
        const v = o ? valorDaChave(entradasDoObjeto(o), propriedade) : "opaco";
        expr = v && v !== "opaco" ? v : undefined;
      }
      const alt = expr ? alternativasDeTexto(expr) : null;
      if (alt === null || !alt.every(comecoConhecido)) problemas.push(`${linha(n)}: <${componente}> ${atributo}${propriedade ? `.${propriedade}` : ""} não resolvível`);
      else for (const t of alt) { valores.push(legivel(t)); if (fragmentoDestrutivo(t)) problemas.push(`${linha(n)}: <${componente}> "${legivel(t)}" é destrutivo`); }
    };
    /** Referência ao componente que a trava lê: tag JSX, alias, import, a própria declaração e exportação no módulo. */
    const permitida = (id: ts.Identifier): boolean => {
      let p: ts.Node = id.parent;
      if ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === id) return true;
      if (ts.isPropertyAccessExpression(p) && p.expression === id) {
        if (!exportados.has(p.name.text)) return true; // outra exportação do módulo (M.Horario)
        const pai = p.parent;
        if ((ts.isJsxOpeningElement(pai) || ts.isJsxSelfClosingElement(pai) || ts.isJsxClosingElement(pai)) && pai.tagName === p) return true;
        p = pai;
      }
      while (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p) || ts.isNonNullExpression(p)) p = p.parent;
      if (ts.isVariableDeclaration(p) && (p.name === id || (p.initializer && ts.isIdentifier(p.name)))) return true;
      if (ts.isVariableDeclaration(p) && ts.isObjectBindingPattern(p.name) && p.initializer && semEmbrulho(p.initializer) === id) return true;
      if (ts.isBindingElement(p) && (p.name === id || p.propertyName === id)) return true;
      if ((ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p)) && p.name === id) return true;
      if (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return true;
      if (declarante && (ts.isExportSpecifier(p) || ts.isExportAssignment(p))) return true;
      return false;
    };
    const visita = (n: ts.Node) => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        if (ehComponente(n.tagName) || (livre && ts.isIdentifier(n.tagName) && n.tagName.text === componente)) analisar(n);
      }
      if (ts.isIdentifier(n) && (ligados.has(n.text) || espacos.has(n.text)) && (ehReferencia(n) || ts.isJsxOpeningElement(n.parent) || ts.isJsxSelfClosingElement(n.parent) || ts.isJsxClosingElement(n.parent)) && !permitida(n)) problemas.push(`${linha(n)}: ${n.text} usado fora de JSX`);
      // Exportação de um alias: no módulo, o alias passa a ser outro nome do componente; fora dele, é reexportação.
      if (ts.isVariableStatement(n) && exportado(n)) {
        for (const d of n.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || !ligados.has(d.name.text) || d.name.text === componente) continue;
          if (declarante) exportados.add(d.name.text); else problemas.push(`${linha(d)}: reexporta <${componente}> como ${d.name.text}`);
        }
      }
      if (ts.isExportSpecifier(n) && !n.parent.parent.moduleSpecifier && ligados.has((n.propertyName ?? n.name).text)) {
        if (declarante) exportados.add(n.name.text); else problemas.push(`${linha(n)}: reexporta <${componente}>`);
      }
      if (ts.isExportAssignment(n) && ts.isIdentifier(n.expression) && ligados.has(n.expression.text)) {
        if (declarante) exportados.add("default"); else problemas.push(`${linha(n)}: reexporta <${componente}> como default`);
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  return { valores, problemas };
}

/**
 * Classes que um DESCENDENTE de botão isento ai-* pode ter: layout, tamanho, tipografia sem cor e a
 * própria paleta ai-*. Lista fechada: qualquer outra (bg-red-600, text-white, ring-…, opacity-…) acusa.
 */
const CLASSE_NEUTRA_OU_IA = /^(-?(m|p)[trblxyse]?-[\w./[\]-]+|gap(-[xy])?-\S+|(min-|max-)?(w|h|size)-\S+|flex|inline|inline-flex|inline-block|block|hidden|contents|items-\S+|justify-\S+|self-\S+|shrink(-0)?|grow(-0)?|truncate|whitespace-\S+|font-(normal|medium|semibold|bold)|leading-\S+|tracking-\S+|text-(xs|sm|base|lg|xl|[2-9]xl|left|center|right)|sr-only|not-sr-only|rounded(-\S+)?|align-\S+|underline|no-underline|italic|uppercase|lowercase|capitalize|tabular-nums|(hover:)?(bg|text|border)-ai-[\w-]+)$/;

/**
 * Problemas de cor no CONTEÚDO de um botão isento ai-* (follow-up #140, B5: `<span className="bg-red-600">`
 * recoloria o botão). Falha fechada: só texto, <span>/<strong>/<em>/<b>/<i>/<small> e ícones Icon*; cada
 * elemento só com className literal de classes neutras ou ai-*, aria-* e key (sem style, spread, cor por
 * prop); conteúdo em expressão tem de se resolver em texto; constantes JSX são seguidas pelo escopo.
 */
export function coresNosDescendentes(botao: ts.JsxElement): string[] {
  const problemas: string[] = [];
  const vistos = new Set<ts.Node>();
  const elemento = (el: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
    const tag = el.tagName.getText(el.getSourceFile());
    if (!/^(span|strong|em|b|i|small)$/.test(tag) && !/^Icon[A-Z]\w*$/.test(tag)) problemas.push(`<${tag}> não é texto nem ícone`);
    for (const p of el.attributes.properties) {
      if (!ts.isJsxAttribute(p)) { problemas.push(`<${tag}> com spread`); continue; }
      const nome = p.name.getText(el.getSourceFile());
      if (nome === "key" || /^aria-/.test(nome)) continue;
      if (nome !== "className") { problemas.push(`<${tag}> ${nome}`); continue; }
      const v = p.initializer;
      const alt = v && ts.isStringLiteral(v) ? [v.text] : v && ts.isJsxExpression(v) && v.expression ? alternativasDeTexto(v.expression) : null;
      if (alt === null || alt.some((t) => t.includes(DESCONHECIDO))) { problemas.push(`<${tag}> className não literal`); continue; }
      for (const c of alt.join(" ").split(/\s+/).filter(Boolean)) if (!CLASSE_NEUTRA_OU_IA.test(c)) problemas.push(`<${tag}> ${c}`);
    }
  };
  const andar = (n: ts.Node) => {
    if (ts.isJsxAttributes(n)) return;
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) elemento(n);
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)) && alternativasDeTexto(n.expression) === null) {
      problemas.push(`conteúdo não resolvível: ${n.expression.getText(n.getSourceFile()).replace(/\s+/g, " ")}`);
    }
    if (ts.isIdentifier(n) && ehReferencia(n)) {
      const v = valorNoEscopo(n);
      if (v && !vistos.has(v)) { vistos.add(v); andar(v); }
    }
    ts.forEachChild(n, andar);
  };
  for (const c of botao.children) andar(c);
  return problemas;
}

// Rótulo que a trava não resolve estaticamente (prop, chamada, começo dinâmico): arquivo + nome
// (nomeDoElemento) + quantos + motivo. Falha fechada: um botão novo assim não passa sem entrar aqui (R1
// da #135, B1/B4). Com `fontes`, o rótulo vem de uma prop do componente declarado em `arquivo`: TODOS os
// usos dele em src/app e src/components são conferidos (follow-up #140, B6 — sem lista fixa de arquivos).
type FonteDoRotulo = { componente: string; atributo: string; propriedade?: string };
const ROTULOS_DINAMICOS: { arquivo: string; nome: string; vezes: number; motivo: string; fontes?: FonteDoRotulo }[] = [
  { arquivo: "src/app/(app)/inbox/InboxCliente.tsx", nome: "→", vezes: 1, motivo: "link para o cadastro vinculado: o rótulo é o nome do aluno/lead (navegação, não ação)" },
  { arquivo: "src/app/(app)/academico/recuperacoes/planos/[propostaId]/Formularios.tsx", nome: "Registrando…", vezes: 1, fontes: { componente: "Formulario", atributo: "titulo" }, motivo: "envio do formulário genérico; o rótulo é o título passado pelos usos (este arquivo e os que o importam): 'Registrar …', 'Reservar …', 'Propor …', 'Guardar …', 'Decidir …', 'Solicitar …'" },
  { arquivo: "src/components/EstadoRota.tsx", nome: "(sem nome)", vezes: 2, fontes: { componente: "EstadoRota", atributo: "acao", propriedade: "rotulo" }, motivo: "ação da tela de erro/não encontrado (link ou botão): 'Tentar de novo', 'Voltar ao início' — vem do chamador" },
];

/** Todos os .ts/.tsx de src/app e src/components (sem testes): onde um uso do componente pode estar. */
const FONTES_DO_SRC = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("hierarquia: rótulo resolvido, tabelas e falha fechada (R1 da #135)", () => {
  it("todo botão do design system tem rótulo resolvível no começo — ou está em ROTULOS_DINAMICOS, com a contagem exata", () => {
    const contagem = new Map<string, number>();
    for (const { arquivo, conteudo } of arquivos.filter(({ arquivo }) => !/\.test\./.test(arquivo))) {
      for (const nome of rotulosNaoResolvidos(conteudo)) contagem.set(`${arquivo} | ${nome}`, (contagem.get(`${arquivo} | ${nome}`) ?? 0) + 1);
    }
    const esperado = new Map(ROTULOS_DINAMICOS.map((r) => [`${r.arquivo} | ${r.nome}`, r.vezes]));
    expect(Object.fromEntries(contagem)).toEqual(Object.fromEntries(esperado));
    for (const r of ROTULOS_DINAMICOS) expect(r.motivo.trim().length, r.nome).toBeGreaterThan(20);
  });

  // O rótulo dinâmico vem de uma prop: cada valor passado a ela (em TODOS os usos do componente no src) tem
  // de se resolver e não pode nomear ação destrutiva — senão o botão de envio, secundário, herdaria
  // "Excluir …" (R2 da #135, B6; follow-up #140, B6: alias, import com outro nome e uso fora de uma lista fixa).
  it("rótulos dinâmicos: todos os usos do componente no src passam valores resolvidos e nenhum é destrutivo", () => {
    for (const r of ROTULOS_DINAMICOS.filter((x) => x.fontes)) {
      const { componente, atributo, propriedade } = r.fontes!;
      const modulo = posix.basename(r.arquivo).replace(/\.tsx?$/, "");
      // Só lê a fundo quem cita o componente ou o módulo (um uso precisa de um dos dois no texto).
      const candidatos = FONTES_DO_SRC.filter(({ conteudo }) => conteudo.includes(componente) || conteudo.includes(modulo));
      expect(candidatos.map((c) => c.arquivo), r.arquivo).toContain(r.arquivo);
      const { valores, problemas } = usosDoComponente(candidatos, r.arquivo, componente, atributo, propriedade);
      expect(problemas, r.arquivo).toEqual([]);
      expect(valores.length, `${r.arquivo}: nenhum uso de <${componente}> encontrado`).toBeGreaterThan(0);
    }
  });

  it("rotulosNaoResolvidos (autoteste): começo dinâmico acusa; constante, template, verbo antes do dinâmico e tabela com variante passam", () => {
    const b = (corpo: string, antes = "") => rotulosNaoResolvidos(`${antes}\nexport function T({ rotulo, t, d, a }: any) { return ${corpo}; }`);
    expect(b('<button className={botaoClasses()}>{rotulo}</button>')).toHaveLength(1);
    expect(b('<button className={botaoClasses()}>{t ? "Salvando…" : rotulo}</button>')).toHaveLength(1);
    expect(b('<Botao>{rotulo}</Botao>')).toHaveLength(1);
    expect(b('<button className={botaoClasses()}>{ROTULO}</button>', 'const ROTULO = "Excluir janela";')).toEqual([]);
    expect(b('<button className={botaoClasses()}>{`Excluir ${t}`}</button>')).toEqual([]);
    expect(b('<button className={botaoClasses()}>Remover {d}</button>')).toEqual([]);
    expect(b('<button className={botaoClasses({ variante: a.variante })}>{a.label}</button>')).toEqual([]);
    expect(b('<button className="underline">{rotulo}</button>')).toEqual([]); // fora do design system
  });

  it("destrutivosSemPerigo (R1 da #135, B4): rótulo por constante, template, minúscula e símbolo inicial também exigem perigo, no <button> e no <Botao>", () => {
    expect(destrutivosSemPerigo('const ROTULO = "Excluir janela"; <Botao variante="secundario">{ROTULO}</Botao>')).toHaveLength(1);
    expect(destrutivosSemPerigo('<Botao variante="secundario">{`Excluir ${x}`}</Botao>')).toHaveLength(1);
    expect(destrutivosSemPerigo('<button className={botaoClasses({ variante: "secundario" })}>rejeitar janela</button>')).toHaveLength(1);
    expect(destrutivosSemPerigo('<button className={botaoClasses({ variante: "secundario" })}>✕ Rejeitar janela</button>')).toHaveLength(1);
    expect(destrutivosSemPerigo('const R = "Rejeitar janela"; <button className={botaoClasses({ variante: "secundario" })}>{R}</button>')).toHaveLength(1);
    expect(destrutivosSemPerigo('const R = "Rejeitar janela"; <button className={botaoClasses({ variante: "perigo" })}>{R}</button>')).toEqual([]);
  });

  it("linha de tabela de botão ({ label, variante }) com rótulo destrutivo tem variante perigo", () => {
    const achados = arquivos.filter(({ arquivo }) => !/\.test\./.test(arquivo)).flatMap(({ arquivo, conteudo }) => tabelasDeBotaoSemPerigo(conteudo).map((r) => `${arquivo}: ${r}`));
    expect(achados).toEqual([]);
    expect(tabelasDeBotaoSemPerigo('const A = [{ label: "Excluir país", alvo: 1, variante: "fantasma" }, { label: "Pausar", variante: "fantasma" }];')).toEqual(["Excluir país → fantasma"]);
    expect(tabelasDeBotaoSemPerigo('const A = [{ label: "Encerrar", variante: "perigo" }, { rotulo: "Reativar", variante: "fantasma" }];')).toEqual([]);
  });
});

describe("exceções ai-* do copiloto (R1 da #135, B6)", () => {
  // Os botões isentos por nome usam a paleta de IA (docs/18), mas base e tamanho vêm do design system:
  // a constante btnIa é exatamente BASE_BOTAO + TAMANHOS_BOTAO.sm, os isentos usam btnIa, e só somam
  // cor/borda da paleta ai-* (texto branco no sólido); o conteúdo não traz cor própria (follow-up #140, B5).
  const fonte = readFileSync("src/components/CopilotoSugestoes.tsx", "utf8");
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const classesDosIsentos: { nome: string; expr: string; estilo: boolean; conteudo: string[] }[] = [];
  const visita = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === "button") {
      const nome = nomeDoElemento(n, sf) ?? "";
      if ((CONTROLES_QUE_NAO_SAO_BOTAO["src/components/CopilotoSugestoes.tsx"] ?? []).includes(nome)) {
        const cls = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "className") as ts.JsxAttribute | undefined;
        const estilo = n.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "style") || n.attributes.properties.some(ts.isJsxSpreadAttribute);
        const conteudo = ts.isJsxOpeningElement(n) ? coresNosDescendentes(n.parent) : [];
        classesDosIsentos.push({ nome, expr: cls?.initializer?.getText(sf) ?? "", estilo, conteudo });
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);

  it("btnIa é BASE_BOTAO + TAMANHOS_BOTAO.sm, sem nada a mais", () => {
    expect(fonte).toMatch(/const btnIa = `\$\{BASE_BOTAO\} \$\{TAMANHOS_BOTAO\.sm\}`;/);
  });

  it("cada botão isento usa btnIa e só soma classes da paleta ai-* (e texto branco)", () => {
    expect(classesDosIsentos.map((c) => c.nome).sort()).toEqual([...(CONTROLES_QUE_NAO_SAO_BOTAO["src/components/CopilotoSugestoes.tsx"] ?? [])].sort());
    for (const { nome, expr, estilo } of classesDosIsentos) {
      // Sem style inline nem spread: a cor só pode vir das classes ai-* conferidas abaixo (R2 da #135, B5).
      expect(estilo, `${nome}: style/spread`).toBe(false);
      expect(expr, nome).toMatch(/^\{btnIa \+ "[^"]*"\}$/);
      const extras = expr.match(/"([^"]*)"/)![1].trim().split(/\s+/);
      for (const c of extras) expect(/^(hover:)?(bg|text|border)-ai-[\w-]+$|^border$|^text-white$|^hover:brightness-95$/.test(c), `${nome}: ${c}`).toBe(true);
    }
  });

  it("o conteúdo de cada isento não recolore o botão: só texto, ícone e classes neutras ou ai-* (follow-up #140, B5)", () => {
    expect(classesDosIsentos.flatMap(({ nome, conteudo }) => conteudo.map((p) => `${nome}: ${p}`))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// Follow-up #140 (R3 da #135): uma fonte virtual por evasão do issue — a trava acusa cada uma, e as formas
// legítimas vizinhas continuam passando.
// ---------------------------------------------------------------------------------------------------
describe("follow-up #140: evasões restantes da trava de botões (autotestes)", () => {
  it("B1 — tabela de botão: concatenação, template com expressão, constante sombreada, spread e chave entre aspas não escondem rótulo nem variante", () => {
    // T5 / T6: o rótulo montado por "+" ou por template com expressão literal se resolve.
    expect(tabelasDeBotaoSemPerigo('const A = [{ label: "Encer" + "rar", variante: "fantasma" }];')).toEqual(["Encerrar → fantasma"]);
    expect(tabelasDeBotaoSemPerigo('const A = [{ label: `Encer${"rar"}`, variante: "fantasma" }];')).toEqual(["Encerrar → fantasma"]);
    // Começo dinâmico (parte do verbo desconhecida) numa linha com variante: falha fechada.
    expect(tabelasDeBotaoSemPerigo('export function T({ x }: any) { return [{ label: "Encer" + x, variante: "fantasma" }]; }')).toEqual(["(rótulo não resolvível) → fantasma"]);
    // T7: a constante vale pelo escopo — a sombra em outra função não troca o valor (nos dois sentidos).
    expect(tabelasDeBotaoSemPerigo('const NEUTRO = "fantasma"; const A = [{ label: "Encerrar", variante: NEUTRO }]; function _sombra() { const NEUTRO = "perigo"; return NEUTRO; }')).toEqual(["Encerrar → fantasma"]);
    expect(tabelasDeBotaoSemPerigo('const PERIGO = "perigo"; const A = [{ label: "Encerrar", variante: PERIGO }]; function _sombra() { const PERIGO = "fantasma"; return PERIGO; }')).toEqual([]);
    // T8: variante por spread — de objeto do arquivo (resolvido) ou opaco (falha fechada); spread depois da variante pode sobrescrevê-la.
    expect(tabelasDeBotaoSemPerigo('const NEUTRA = { variante: "fantasma" as const }; const A = [{ label: "Encerrar", ...NEUTRA }];')).toEqual(["Encerrar → fantasma"]);
    expect(tabelasDeBotaoSemPerigo('export function T(props: any) { return [{ label: "Encerrar", ...props }]; }')).toEqual(["Encerrar → ?"]);
    expect(tabelasDeBotaoSemPerigo('export function T(p: any) { return [{ label: "Encerrar", variante: "perigo", ...p }]; }')).toEqual(["Encerrar → ?"]);
    expect(tabelasDeBotaoSemPerigo('const PERIGO = { variante: "perigo" as const }; const A = [{ label: "Encerrar", ...PERIGO }];')).toEqual([]);
    // T9: chave entre aspas (ou computada literal) é a mesma chave; atalho resolve pelo escopo.
    expect(tabelasDeBotaoSemPerigo('const A = [{ label: "Encerrar", "variante": "fantasma" }];')).toEqual(["Encerrar → fantasma"]);
    expect(tabelasDeBotaoSemPerigo('const A = [{ "label": "Encerrar", ["variante"]: "fantasma" }];')).toEqual(["Encerrar → fantasma"]);
    expect(tabelasDeBotaoSemPerigo('const label = "Encerrar"; const variante = "fantasma"; const A = [{ label, variante }];')).toEqual(["Encerrar → fantasma"]);
    // Ternário na variante: todas as variantes possíveis têm de ser perigo.
    expect(tabelasDeBotaoSemPerigo('export function T({ x }: any) { return [{ label: "Encerrar", variante: x ? "perigo" : "fantasma" }]; }')).toEqual(["Encerrar → perigo|fantasma"]);
  });

  it("B1 — botão: rótulo por \"+\"/template se resolve; começo dinâmico falha fechado; nome vale pelo escopo (sombra, parâmetro, let reatribuído)", () => {
    expect(destrutivosSemPerigo('<Botao variante="secundario">{"Encer" + "rar matrícula"}</Botao>')).toHaveLength(1);
    expect(destrutivosSemPerigo('<Botao variante="secundario">{`Encer${"rar"} matrícula`}</Botao>')).toHaveLength(1);
    expect(rotulosNaoResolvidos('export function T({ x }: any) { return <Botao variante="secundario">{"Encer" + x}</Botao>; }')).toHaveLength(1);
    expect(rotulosNaoResolvidos('export function T({ x }: any) { return <Botao>{`${x} itens`}</Botao>; }')).toHaveLength(1);
    expect(rotulosNaoResolvidos('export function T({ x }: any) { return <button aria-label={"Remo" + x} className={botaoClasses()}><Icone /></button>; }')).toHaveLength(1);
    // Constante sombreada noutra função: vale a do escopo do botão (antes, "o último const do arquivo").
    expect(destrutivosSemPerigo('function A() { const R = "Excluir janela"; return <Botao variante="secundario">{R}</Botao>; } function B() { const R = "Salvar"; return R; }')).toHaveLength(1);
    expect(destrutivosSemPerigo('const btn = botaoClasses({ variante: "secundario" }); const r = <button className={btn}>Excluir</button>; function _s() { const btn = botaoClasses({ variante: "perigo" }); return btn; }')).toEqual(["Excluir"]);
    // Parâmetro homônimo de uma constante do arquivo não é a constante: rótulo dinâmico.
    expect(rotulosNaoResolvidos('const rotulo = "Salvar"; export function T({ rotulo }: { rotulo: string }) { return <Botao>{rotulo}</Botao>; }')).toHaveLength(1);
    // let reatribuído não se resolve; let nunca reatribuído, sim.
    expect(rotulosNaoResolvidos('export function T() { let r = "Salvar"; r = "Excluir"; return <Botao>{r}</Botao>; }')).toHaveLength(1);
    expect(rotulosNaoResolvidos('export function T() { let r = "Salvar"; return <Botao>{r}</Botao>; }')).toEqual([]);
  });

  it("B2 — isenção por estado: aria-current/aria-expanded só isentam com a MESMA condição e polaridade da classe; aria-haspopup não isenta seleção", () => {
    const b = (attr: string) => alternanciasSemAriaPressed(`<button ${attr} className={tipo === t ? "bg-surface" : "text-gray-500"}>PF</button>`);
    expect(b("aria-expanded={tipo !== t}")).toEqual(["PF"]); // A15d
    expect(b('aria-current={tipo === t ? undefined : "true"}')).toEqual(["PF"]); // A15e
    expect(b('aria-current={tipo !== t ? "page" : undefined}')).toEqual(["PF"]); // A18
    expect(b('aria-current={tipo === t ? "page" : "page"}')).toEqual(["PF"]); // os dois lados anunciam
    expect(b("aria-haspopup={undefined}")).toEqual(["PF"]); // A15f
    expect(b('aria-haspopup="true"')).toEqual(["PF"]); // A15g
    expect(b('aria-haspopup="menu"')).toEqual(["PF"]); // A17
    // Legítimas (A15c): a mesma condição, a mesma polaridade (lados trocados, `&&`, dupla negação).
    expect(b('aria-current={tipo === t ? "true" : undefined}')).toEqual([]);
    expect(b('aria-current={t === tipo && "page"}')).toEqual([]);
    expect(b('aria-current={tipo === t ? "page" : "false"}')).toEqual([]);
    expect(b('aria-current={!(tipo !== t) ? "page" : undefined}')).toEqual([]);
    expect(b("aria-expanded={tipo === t}")).toEqual([]);
    expect(b('aria-haspopup="menu" aria-expanded={tipo === t}')).toEqual([]); // botão de menu anuncia em aria-expanded
  });

  it("B3 — grupo rotulado: aria-label vazio, undefined ou opaco não nomeia; aria-labelledby exige id existente no arquivo (A16f)", () => {
    const btn = '<button aria-pressed={ativo} className={ativo ? "bg-brand-600" : ""}>Seg</button>';
    const fora = ["Seg — aria-pressed fora de grupo rotulado"];
    const grupo = (attrs: string) => alternanciasSemAriaPressed('<div role="group" ' + attrs + ">" + btn + "</div>");
    expect(grupo("aria-label={``}")).toEqual(fora); // A16d
    expect(grupo("aria-label={undefined}")).toEqual(fora); // A16e
    expect(grupo('aria-label={" "}')).toEqual(fora);
    expect(grupo("aria-label={rotulo}")).toEqual(fora); // expressão opaca não prova nome
    expect(grupo('aria-labelledby="id-que-nao-existe"')).toEqual(fora); // A16f
    expect(grupo("aria-labelledby={idTitulo}")).toEqual(fora); // nenhum id={idTitulo} no arquivo
    expect(alternanciasSemAriaPressed('const r = <><h3 id="a">Dias</h3><div role="group" aria-labelledby="a b">' + btn + "</div></>;")).toEqual(fora); // "b" não existe
    expect(alternanciasSemAriaPressed("const r = <fieldset>" + btn + "</fieldset>;")).toEqual(fora); // fieldset sem legenda
    // Passam: texto, template com texto, id literal existente, id pela mesma expressão.
    expect(grupo('aria-label="Dias"')).toEqual([]);
    expect(grupo("aria-label={`Dias de ${turma}`}")).toEqual([]);
    expect(alternanciasSemAriaPressed('const r = <><h3 id="dias-titulo">Dias</h3><div role="group" aria-labelledby="dias-titulo">' + btn + "</div></>;")).toEqual([]);
    expect(alternanciasSemAriaPressed('const idDias = useId(); const r = <><h3 id={idDias}>Dias</h3><div role="group" aria-labelledby={idDias}>' + btn + "</div></>;")).toEqual([]);
  });

  it("B4 — seleção em função: switch, consulta a objeto, método e função importada contam; aria-pressed tem de ser a comparação dos argumentos", () => {
    const SWITCH = 'function estilo(atual: string, opcao: string) { switch (atual) { case opcao: return "bg-surface"; default: return "text-gray-500"; } }';
    const LOOKUP = 'function estilo(atual: string, opcao: string) { return ({ [atual]: "bg-surface" } as Record<string, string>)[opcao] ?? "text-gray-500"; }';
    const TERNARIO = 'function estilo(atual: string, opcao: string) { return atual === opcao ? "bg-surface" : "text-gray-500"; }';
    const grupo = (botao: string, antes: string) => alternanciasSemAriaPressed(`${antes}\nconst r = <div role="group" aria-label="Tipo">${botao}</div>;`);
    // A8d / A8g: sem aria-pressed, a seleção escondida em switch ou consulta a objeto acusa.
    expect(grupo('<button className={"rounded " + estilo(tipo, t)}>PF</button>', SWITCH)).toEqual(["PF"]);
    expect(grupo('<button className={"rounded " + estilo(tipo, t)}>PF</button>', LOOKUP)).toEqual(["PF"]);
    // A8f: aria-pressed invertido em relação à comparação dos argumentos acusa, em qualquer das formas.
    for (const f of [SWITCH, LOOKUP, TERNARIO]) {
      expect(grupo("<button aria-pressed={tipo !== t} className={estilo(tipo, t)}>PF</button>", f), f).toEqual(["PF — aria-pressed não é a condição da classe"]);
      expect(grupo("<button aria-pressed={tipo === t} className={estilo(tipo, t)}>PF</button>", f), f).toEqual([]);
      expect(grupo("<button aria-pressed={t === tipo} className={estilo(tipo, t)}>PF</button>", f), f).toEqual([]);
    }
    // Método de objeto do arquivo.
    expect(grupo("<button className={E.estilo(tipo, t)}>PF</button>", 'const E = { estilo(atual: string, opcao: string) { return atual === opcao ? "bg-surface" : ""; } };')).toEqual(["PF"]);
    // Função importada do projeto: analisada na origem.
    const importado = (botao: string) => alternanciasSemAriaPressed(`import { estilo } from "./estilos";\nconst r = <div role="group" aria-label="Tipo">${botao}</div>;`, "x.tsx", { "./estilos": `export ${TERNARIO}` });
    expect(importado("<button className={estilo(tipo, t)}>PF</button>")).toEqual(["PF"]);
    expect(importado("<button aria-pressed={tipo !== t} className={estilo(tipo, t)}>PF</button>")).toEqual(["PF — aria-pressed não é a condição da classe"]);
    expect(importado("<button aria-pressed={tipo === t} className={estilo(tipo, t)}>PF</button>")).toEqual([]);
    // Função que não decide (só junta classes) não é seleção.
    expect(grupo('<button className={junta("rounded", "px-2")}>PF</button>', "function junta(...c: string[]) { return c.join(\" \"); }")).toEqual([]);
  });

  it("B5 — isentos ai-*: descendente com cor fora da paleta, elemento opaco, style ou conteúdo não resolvível recolorem o botão", () => {
    const desc = (conteudo: string, antes = "") => {
      const sf = ts.createSourceFile("x.tsx", `${antes}\nconst r = <button className={btnIa + " bg-ai-solid text-white"}>${conteudo}</button>;`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let achados: string[] = [];
      const v = (n: ts.Node) => { if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "button") achados = coresNosDescendentes(n); ts.forEachChild(n, v); };
      v(sf);
      return achados;
    };
    expect(desc('<span className="-mx-2 -my-0.5 rounded bg-red-600 px-2 py-0.5">Aplicar corrigido</span>')).toEqual(["<span> bg-red-600"]); // K4d
    expect(desc('<span className="text-white">Aplicar</span>')).toEqual(["<span> text-white"]);
    expect(desc('<span style={{ background: "red" }}>Aplicar</span>')).toEqual(["<span> style"]);
    expect(desc("<span {...p}>Aplicar</span>")).toEqual(["<span> com spread"]);
    expect(desc("<Vermelho>Aplicar</Vermelho>")).toEqual(["<Vermelho> não é texto nem ícone"]);
    expect(desc('<IconCheck color="red" />')).toEqual(["<IconCheck> color"]);
    expect(desc("<span className={cor}>Aplicar</span>")).toEqual(["<span> className não literal"]);
    expect(desc("{conteudo}")).toEqual(["conteúdo não resolvível: conteudo"]);
    expect(desc('{x ? <span className="bg-danger">A</span> : "B"}')).toEqual(["<span> bg-danger"]);
    expect(desc("{FAIXA}", 'const FAIXA = <span className="bg-red-600">Aplicar</span>;')).toEqual(["<span> bg-red-600"]);
    // Passam: texto, ternário de textos, ícone e classes neutras ou ai-*.
    expect(desc('Aplicar <IconSparkles className="h-3.5 w-3.5" aria-hidden /> <span className="font-medium text-ai-700">corrigido</span>')).toEqual([]);
    expect(desc('{ocupado ? "Analisando…" : "Gerar sugestões"}')).toEqual([]);
  });

  it("B6 — rótulo dinâmico: alias, import com outro nome, namespace e uso em qualquer arquivo entram; spread, fora de JSX e reexportação falham fechado", () => {
    const DECL = "src/app/x/Formularios.tsx";
    const declara = 'export function Formulario({ titulo }: { titulo: string }) { return <button className={botaoClasses()}>{titulo}</button>; }\nexport function A() { return <Formulario titulo="Registrar decisão" />; }';
    const usos = (extras: Record<string, string>, declaracao = declara) =>
      usosDoComponente([{ arquivo: DECL, conteudo: declaracao }, ...Object.entries(extras).map(([arquivo, conteudo]) => ({ arquivo, conteudo }))], DECL, "Formulario", "titulo");
    expect(usos({})).toEqual({ valores: ["Registrar decisão"], problemas: [] });
    // H16d: alias local do componente.
    expect(usos({}, `${declara}\nconst F = Formulario;\nexport function B() { return <F titulo="Excluir tentativa reservada" />; }`).problemas)
      .toEqual([expect.stringMatching(/Formularios\.tsx:4: <Formulario> "Excluir tentativa reservada" é destrutivo$/)]);
    // H16g: uso em outro arquivo do src — import direto, com outro nome, por namespace e por alias exportado.
    expect(usos({ "src/app/x/page.tsx": 'import { Formulario } from "./Formularios";\nexport default () => <Formulario titulo="Excluir tentativa" />;' }).problemas)
      .toEqual([expect.stringMatching(/page\.tsx:2: <Formulario> "Excluir tentativa" é destrutivo$/)]);
    expect(usos({ "src/app/y/z.tsx": 'import { Formulario as G } from "../x/Formularios";\nexport const Z = () => <G titulo="Remover tentativa" />;' }).problemas).toHaveLength(1);
    expect(usos({ "src/app/y/z.tsx": 'import * as M from "@/app/x/Formularios";\nexport const Z = () => <M.Formulario titulo="Apagar tentativa" />;' }).problemas).toHaveLength(1);
    expect(usos({ "src/app/y/z.tsx": 'import { Atalho } from "../x/Formularios";\nexport const Z = () => <Atalho titulo="Descartar tentativa" />;' }, `${declara}\nexport const Atalho = Formulario;`).problemas).toHaveLength(1);
    // Usos que a trava não lê: falha fechada.
    expect(usos({ "src/app/y/z.tsx": 'import { Formulario } from "../x/Formularios";\nexport const Z = (p: any) => <Formulario {...p} />;' }).problemas).toEqual([expect.stringMatching(/spread de props$/)]);
    expect(usos({ "src/app/y/z.tsx": 'import { Formulario } from "../x/Formularios";\nexport const Z = ({ t }: any) => <Formulario titulo={t} />;' }).problemas).toEqual([expect.stringMatching(/titulo não resolvível$/)]);
    expect(usos({ "src/app/y/z.tsx": 'import { createElement } from "react";\nimport { Formulario } from "../x/Formularios";\nexport const Z = () => createElement(Formulario, { titulo: "Excluir" });' }).problemas)
      .toEqual([expect.stringMatching(/Formulario usado fora de JSX$/)]);
    expect(usos({ "src/app/y/index.ts": 'export { Formulario } from "../x/Formularios";' }).problemas).toEqual([expect.stringMatching(/reexporta/)]);
    expect(usos({ "src/app/y/z.tsx": 'import { Formulario } from "../x/Formularios";\nexport const G = Formulario;' }).problemas).toEqual([expect.stringMatching(/reexporta/)]);
    // Homônimo de outro módulo não é o componente; tag sem import nenhum conta (falha fechada).
    expect(usos({ "src/app/y/z.tsx": 'import { Formulario } from "./Formulario";\nexport const Z = () => <Formulario titulo="Excluir" />;' }).problemas).toEqual([]);
    expect(usos({ "src/app/y/z.tsx": 'export const Z = () => <Formulario titulo="Excluir" />;' }).problemas).toHaveLength(1);
    // Propriedade de objeto (EstadoRota acao.rotulo): spread do arquivo e chave entre aspas também se leem.
    const rota = (uso: string) => usosDoComponente([
      { arquivo: "src/components/EstadoRota.tsx", conteudo: "export function EstadoRota({ acao }: any) { return <button className={botaoClasses()}>{acao.rotulo}</button>; }" },
      { arquivo: "src/app/erro.tsx", conteudo: `import { EstadoRota } from "@/components/EstadoRota";\n${uso}` },
    ], "src/components/EstadoRota.tsx", "EstadoRota", "acao", "rotulo");
    expect(rota('export default () => <EstadoRota acao={{ href: "/", rotulo: "Voltar ao início" }} />;')).toEqual({ valores: ["Voltar ao início"], problemas: [] });
    expect(rota('const BASE = { rotulo: "Excluir conta" }; export default () => <EstadoRota acao={{ href: "/", ...BASE }} />;').problemas).toHaveLength(1);
    expect(rota('export default () => <EstadoRota acao={{ href: "/", "rotulo": "Excluir conta" }} />;').problemas).toHaveLength(1);
    expect(rota('export default (p: any) => <EstadoRota acao={{ rotulo: "Voltar", ...p }} />;').problemas).toEqual([expect.stringMatching(/acao\.rotulo não resolvível$/)]);
  });
});

// ---------------------------------------------------------------------------------------------------
// Revisão R1 da #148: caractere invisível no verbo (B1), desestruturação opaca (B2) e um caso por item
// das listas fechadas de verbos e substantivos (C1). As listas são comparadas com CÓPIAS LITERAIS, e é a
// cópia que se percorre — percorrer a própria lista não provaria nada.
// ---------------------------------------------------------------------------------------------------
describe("R1 da #148: rótulo lido como na tela, desestruturação opaca e listas fechadas", () => {
  // Caracteres que a tela não desenha: formatação (\p{Cf}: U+00AD, U+200B–U+200D, U+2060, U+FEFF) e, desde a
  // R2, os ignoráveis por padrão que não são Cf: combining grapheme joiner (U+034F), seletores de variação
  // (U+FE00, U+FE0F) e preenchedores Hangul (U+115F, U+1160, U+3164). Por código, não por literal invisível.
  const INVISIVEIS = [0xad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x34f, 0xfe00, 0xfe0f, 0x115f, 0x1160, 0x3164].map((p) => String.fromCodePoint(p));

  it("B1 — textoLido: tira formatação invisível, normaliza espaços e compatibilidade (NFKC)", () => {
    for (const c of INVISIVEIS) expect(textoLido(`Encer${c}rar${c}`), JSON.stringify(c)).toBe("Encerrar");
    expect(textoLido("Rejeitar\u00a0proposta")).toBe("Rejeitar proposta");
    expect(textoLido("Excluir\u2003\u2003janela")).toBe("Excluir janela");
    expect(textoLido("Ｅxcluir")).toBe("Excluir"); // letra de largura total
    expect(textoLido("Confirmar exclusão")).toBe("Confirmar exclusão"); // acento preservado
  });

  it("B1 — E4/E5: caractere invisível no meio ou no fim do verbo não esconde o destrutivo (tabela, <Botao>, <button> e texto JSX)", () => {
    for (const c of INVISIVEIS) {
      const nome = JSON.stringify(c);
      expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "Encer${c}rar", variante: "fantasma" }];`), `E4 ${nome}`).toHaveLength(1);
      expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "Encerrar${c}", variante: "fantasma" }];`), `E5 ${nome}`).toHaveLength(1);
      expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "Encer${c}rar", variante: "perigo" }];`), `perigo ${nome}`).toEqual([]);
      expect(destrutivosSemPerigo(`<Botao variante="secundario">{"Rejei${c}tar proposta"}</Botao>`), `<Botao> ${nome}`).toHaveLength(1);
      expect(destrutivosSemPerigo(`<button className={botaoClasses({ variante: "secundario" })}>Rejei${c}tar proposta</button>`), `texto JSX ${nome}`).toHaveLength(1);
      expect(destrutivosSemPerigo(`<button aria-label="Remover${c}" className={botaoClasses({ variante: "fantasma" })}><Icone /></button>`), `aria-label ${nome}`).toHaveLength(1);
    }
    expect(tabelasDeBotaoSemPerigo('const A = [{ label: "Encerrar\u00a0país", variante: "fantasma" }];')).toHaveLength(1); // NBSP
    expect(destrutivosSemPerigo('<Botao variante="secundario">{"Cancelar\u00a0matrícula"}</Botao>')).toHaveLength(1);
    // "Cancelar" sozinho (fechar) continua neutro, mesmo com caractere invisível.
    expect(destrutivosSemPerigo('<Botao variante="secundario">{"Cancelar\u200b"}</Botao>')).toEqual([]);
  });

  it("R2 B1 — E6/E7/E8: ignoráveis que não são Cf também somem (cada um, na tabela, no meio e no fim do verbo)", () => {
    // Os três da R2, um a um, pelo código — mesmo que a lista de cima mude, estes ficam.
    for (const p of [0x34f, 0xfe0f, 0x3164]) {
      const c = String.fromCodePoint(p);
      expect(textoLido(`Encer${c}rar`), p.toString(16)).toBe("Encerrar");
      expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "Encer${c}rar", variante: "fantasma" }];`), `meio ${p.toString(16)}`).toHaveLength(1);
      expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "Encerrar${c}", variante: "fantasma" }];`), `fim ${p.toString(16)}`).toHaveLength(1);
    }
  });

  it("R2 B2 — E9: letra de outro alfabeto (homóglifo) no rótulo falha fechado — exige perigo", () => {
    const E_CIRILICO = String.fromCodePoint(0x415), e_CIRILICO = String.fromCodePoint(0x435), ALFA = String.fromCodePoint(0x3b1);
    expect(fragmentoDestrutivo(`${E_CIRILICO}ncerrar`)).toBe(true);
    expect(fragmentoDestrutivo(`R${e_CIRILICO}jeitar proposta`)).toBe(true);
    expect(fragmentoDestrutivo(`Salv${ALFA}r`)).toBe(true); // qualquer letra fora do latim, não só a do verbo
    expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "${E_CIRILICO}ncerrar", variante: "fantasma" }];`)).toHaveLength(1);
    expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "${E_CIRILICO}ncerrar", variante: "perigo" }];`)).toEqual([]);
    expect(destrutivosSemPerigo(`<Botao variante="secundario">{"R${e_CIRILICO}jeitar proposta"}</Botao>`)).toHaveLength(1);
    expect(destrutivosSemPerigo(`<button className={botaoClasses({ variante: "secundario" })}>R${e_CIRILICO}jeitar proposta</button>`)).toHaveLength(1);
    // Latim com acento, números e símbolos não são outro alfabeto.
    for (const r of ["Ação concluída", "Salvar 2ª via", "✓ Salvar · →", "Exportar CSV (UTF-8)"]) expect(fragmentoDestrutivo(r), r).toBe(false);
  });

  it("R3 B1 — E10: U+2800 (braille em branco) é espaço na tela — não esconde o verbo", () => {
    const BRAILLE = String.fromCodePoint(0x2800);
    expect(textoLido(`Encerrar${BRAILLE}`)).toBe("Encerrar ");
    expect(textoLido(`Encerrar${BRAILLE}${BRAILLE} país`)).toBe("Encerrar país");
    expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "Encerrar${BRAILLE}", variante: "fantasma" }];`), "fim").toHaveLength(1);
    expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "Encerrar${BRAILLE}país", variante: "fantasma" }];`), "entre palavras").toHaveLength(1);
    expect(destrutivosSemPerigo(`<Botao variante="secundario">Encerrar${BRAILLE}</Botao>`), "Botao").toHaveLength(1);
  });

  it("R3 B2 — E12: homóglifo de dentro do alfabeto latino (ɑ, ı) falha fechado; letras do português não", () => {
    const ALFA_LATINO = String.fromCodePoint(0x251), I_SEM_PONTO = String.fromCodePoint(0x131);
    for (const r of [`Encerr${ALFA_LATINO}r`, `Exclu${I_SEM_PONTO}r`]) {
      expect(fragmentoDestrutivo(r), r).toBe(true);
      expect(tabelasDeBotaoSemPerigo(`const A = [{ label: "${r}", variante: "fantasma" }];`), `tabela ${r}`).toHaveLength(1);
      expect(destrutivosSemPerigo(`<Botao variante="secundario">${r}</Botao>`), `Botao ${r}`).toHaveLength(1);
    }
    // Todo o Latin-1 que o português usa continua neutro (acentos, cedilha, ordinais).
    for (const r of ["Nº 3", "Pré-visualização", "Ação concluída", "Salvar 2ª via", "Órgão emissor", "Índice útil", "ÂÊÔ âêô ÃÕ ãõ À à Ü ü"]) {
      expect(fragmentoDestrutivo(r), r).toBe(false);
    }
  });

  it("B2 — S4: nome vindo de desestruturação é opaco (não vale o inicializador inteiro)", () => {
    // Com a desestruturação lida como o inicializador, `r` viraria "Salvar" (resolvido) e `NEUTRA` o objeto
    // de fora (sem `variante`, a linha sumiria): hoje os dois caem na falha fechada.
    expect(rotulosNaoResolvidos('const [r] = "Salvar"; const x = <Botao>{r}</Botao>;')).toHaveLength(1);
    expect(rotulosNaoResolvidos('const { length: r } = "Salvar"; const x = <Botao>{r}</Botao>;')).toHaveLength(1);
    expect(tabelasDeBotaoSemPerigo('const { NEUTRA } = { NEUTRA: { variante: "perigo" as const } }; const A = [{ label: "Encerrar", ...NEUTRA }];')).toEqual(["Encerrar → ?"]);
    // O caso da revisão: rótulo por desestruturação no botão e na linha de tabela.
    expect(rotulosNaoResolvidos('const { rotulo } = { rotulo: "Excluir" }; const x = <Botao variante="fantasma">{rotulo}</Botao>;')).toHaveLength(1);
    expect(tabelasDeBotaoSemPerigo('const { rotulo } = { rotulo: "Excluir" }; const A = [{ rotulo, variante: "fantasma" }];')).toEqual(["(rótulo não resolvível) → fantasma"]);
    // Também em parâmetro desestruturado, em laço e em catch.
    expect(rotulosNaoResolvidos('const r = "Salvar"; export function T({ a: { r } }: any) { return <Botao>{r}</Botao>; }')).toHaveLength(1);
    expect(rotulosNaoResolvidos('const r = "Salvar"; for (const r of lista) { const x = <Botao>{r}</Botao>; }')).toHaveLength(1);
    expect(rotulosNaoResolvidos('const r = "Salvar"; try { f(); } catch (r) { const x = <Botao>{r}</Botao>; }')).toHaveLength(1);
  });

  it("C1 — lista fechada de verbos: cada verbo acusa sozinho, com complemento e depois de \" e \"", () => {
    const VERBOS = ["Rejeitar", "Recusar", "Remover", "Excluir", "Apagar", "Descartar", "Desativar", "Inativar", "Revogar", "Encerrar", "Estornar", "Anular", "Cancelar"];
    expect(VERBOS_DESTRUTIVOS).toEqual(VERBOS);
    expect(VERBO_DESTRUTIVO_NO_MEIO.source.match(/\(([^)]*)\)/)![1].split("|")).toEqual(VERBOS.map((v) => v.toLowerCase()));
    for (const v of VERBOS) {
      expect(fragmentoDestrutivo(`${v} registro`), `${v} registro`).toBe(true);
      expect(fragmentoDestrutivo(`${v.toLowerCase()} registro`), `${v} minúsculo`).toBe(true);
      expect(fragmentoDestrutivo(`Salvar e ${v.toLowerCase()} registro`), `… e ${v}`).toBe(true);
      expect(fragmentoDestrutivo(v), v).toBe(v !== "Cancelar"); // "Cancelar" sozinho é fechar
    }
  });

  it("C1 — lista fechada de confirmações e prefixos: cada substantivo acusa como \"Confirmar <substantivo>\"", () => {
    const SUBSTANTIVOS = ["cancelamento", "rejeição", "exclusão", "remoção", "revogação", "encerramento", "perda", "desativação", "estorno"];
    expect(CONFIRMACAO_DESTRUTIVA.source.match(/\(([^)]*)\)/)![1].split("|")).toEqual(SUBSTANTIVOS);
    for (const s of [...SUBSTANTIVOS, "desistência"]) {
      expect(fragmentoDestrutivo(`Confirmar ${s}`), s).toBe(true);
      expect(fragmentoDestrutivo(`Confirmar ${s} da matrícula`), `${s} com complemento`).toBe(true);
    }
    const PREFIXOS = ["efetivar encerramento", "efetivar desistência"];
    expect(PREFIXOS_DESTRUTIVOS).toEqual(PREFIXOS);
    for (const p of PREFIXOS) expect(fragmentoDestrutivo(`${p[0].toUpperCase()}${p.slice(1)} aprovado`), p).toBe(true);
    // Vizinhos que não destroem.
    for (const r of ["Confirmar divergência material", "Confirmar", "Efetivar matrícula"]) expect(fragmentoDestrutivo(r), r).toBe(false);
  });
});
