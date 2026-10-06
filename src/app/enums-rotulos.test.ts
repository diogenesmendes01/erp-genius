import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  AlcanceImpactoQuantidadeAulas, CanalAvisoAlteracaoAgenda, CategoriaDocumento, ClassificacaoImpactoCoberturaAditivo,
  DecisaoImpactoTaxaAditivo, EstadoDiaCompensacao, EstadoEnvioAssinatura, EstadoLinhaPreparacaoMigracao,
  EstadoReconferenciaDeltaDesistencia, EstadoReservaDevolucaoCredito, FinalidadeTokenPortalAluno,
  ModalidadeConciliacaoFinanceiraMigracao, MotivoPendenciaAvisoAgenda, ParticipacaoAula, ResultadoEnsaioVinculoMigracao,
  SituacaoAplicacaoCadastroMigracao, SituacaoAvisoAlteracaoAgenda, SituacaoEnvioPortalAluno, SituacaoPropostaQuantidadeAulas,
  SituacaoTrocaEmailPortalAluno, StatusConjuntoImpactosCoberturaAditivo, StatusConjuntoImpactosTaxaAditivo,
  StatusCorrecaoCadastro, StatusFaturaB2B, StatusIntencao, StatusMudancaAcademica, StatusPropostaAcertoTaxaAditivo,
  StatusPropostaConciliacaoFinanceiraMigracao, StatusPropostaEntradaFinanceiraHistoricaMigracao,
  StatusPropostaPresencaHistoricaMigracao, StatusReservaSegundaChamada, StatusReservaVaga, StatusSolicitacaoEncerramento,
  StatusTemplate, StatusTurma, TipoAjuste, TipoAprovacao, TipoDestinacaoRecebimento, TipoMensagem, TipoMovimentacao,
  TipoSugestaoIA, UnidadePermutaServico, Vigencia, StatusEncontroAgenda, StatusPagamentoInformado, ReferenciaCoberturaMensal,
  FinalidadeNumero, FormaAgendaOferta,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as L from "@/lib/labels";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { PagadorEntradaFinanceiraHistoricaSchema } from "@/server/migracao/entrada-financeira-historica-schema";
import { OcorrenciaHorasSchema } from "@/server/matricula/ocorrencia-horas";
import { SaldoCompraHorasSchema } from "@/server/matricula/saldo-horas";

// E5 (docs/42-auditoria-frontend-ux.md §5.7): enum cru na tela ("Estado: PREVISTO", "COMPREENSAO ORAL",
// "PENDENTE_DECISAO") e mapas de rótulo soltos em telas (30 ad-hoc em 23 arquivos). A trava tem três
// partes:
//   (i)  telas não montam rótulo a partir do código (`replaceAll("_", " ")`, `.toLowerCase()` do enum) nem
//        imprimem campo de enum direto no texto do JSX — por AST, e por RENDERIZAÇÃO em cinco telas,
//        cada uma com todos os valores dos seus enums;
//   (ii) mapa de rótulo de enum (objeto literal com chaves de um enum e valores de texto) só existe em
//        src/lib/labels.ts — exceções ancoradas (arquivo + nome + motivo), cada uma casando com um caso;
//   (iii) os mapas novos de labels.ts cobrem exatamente os valores do enum e não repetem o código cru.

// ---------------------------------------------------------------------------------------------------
// Fontes e enums
// ---------------------------------------------------------------------------------------------------

/** Enums do schema (lidos do próprio schema.prisma) + habilidades avaliadas (enum de domínio). */
function enumsDoSchema(schema: string): Map<string, string[]> {
  const enums = new Map<string, string[]>();
  for (const m of schema.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const valores = m[2].split("\n").map((l) => l.replace(/\/\/.*$/, "").trim().split(/\s+/)[0]).filter((v) => /^[A-Z][A-Z0-9_]*$/.test(v ?? ""));
    enums.set(m[1], valores);
  }
  return enums;
}
const ENUMS = enumsDoSchema(readFileSync("prisma/schema.prisma", "utf-8"));
ENUMS.set("Habilidade", [...HABILIDADES]);

const fontes = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.(t|j)sx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** Árvore sintática; o tipo de script segue a extensão (.ts não é lido como TSX: `<T>(x)` viraria JSX). */
const arvore = (fonte: string, arquivo = "x.tsx") => ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true,
  arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : arquivo.endsWith(".jsx") ? ts.ScriptKind.JSX : arquivo.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
const visitar = (no: ts.Node, f: (n: ts.Node) => void) => { f(no); ts.forEachChild(no, (filho) => visitar(filho, f)); };
const linhaDe = (sf: ts.SourceFile, no: ts.Node) => sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1;

// ---------------------------------------------------------------------------------------------------
// (i) enum cru na tela — por AST
// ---------------------------------------------------------------------------------------------------

/** Campos que carregam valor de enum nas telas (status, situação, tipo…). */
const CAMPOS_ENUM = new Set([
  "status", "situacao", "estado", "tipo", "canal", "papel", "finalidade", "habilidade", "participacao",
  "statusMatricula", "matriculaStatus", "encontroStatus", "statusReserva", "statusBeneficio", "statusMeta",
  "alcance", "classificacao", "categoria", "modalidade", "unidade", "etapa", "forma", "temperatura", "segmento", "vigencia",
]);
/** Nomes exatos que também carregam enum (revisão R1 da #138, B1). */
const CAMPOS_ENUM_EXATOS = new Set(["decisao", "ambiente", "destino", "desfecho"]);
/** Bases que nomeiam enum também com complemento (`estadoEnvio`, `ocorrenciaHistoricaTipo`). */
const BASES_COMPOSTAS = ["status", "situacao", "estado", "tipo", "participacao", "desfecho", "finalidade", "classificacao"];
/** Complemento que faz do campo um identificador, data ou texto — não o enum (`statusId`, `estadoEm`, `tipoNome`). */
const COMPLEMENTO_NAO_ENUM = /(Id|Ids|Em|Hash|Nome|Codigo|Texto|Rotulo|Label|Versao|Conferido)$/;
/** Nome de campo de enum: o nome da lista (`status`, `decisao`), a base com complemento
 * (`estadoEnvio`, `participacaoAnterior`) ou o complemento com a base no fim (`ocorrenciaHistoricaTipo`). */
export const nomeDeEnum = (nome: string) => CAMPOS_ENUM.has(nome) || CAMPOS_ENUM_EXATOS.has(nome)
  || (!COMPLEMENTO_NAO_ENUM.test(nome) && BASES_COMPOSTAS.some((b) => (nome.startsWith(b) && /^[A-Z]/.test(nome.slice(b.length)))
    || (nome.length > b.length && nome.endsWith(b[0].toUpperCase() + b.slice(1)))));
/** Atributos JSX que são texto lido pela pessoa (os demais — key, href, name, value… — não são). */
const ATRIBUTOS_TEXTO = new Set(["title", "aria-label", "placeholder", "alt", "aria-description"]);

const semEmbrulho = (e: ts.Expression): ts.Expression => {
  let atual = e;
  while (ts.isParenthesizedExpression(atual) || ts.isNonNullExpression(atual) || ts.isAsExpression(atual) || ts.isSatisfiesExpression(atual)) atual = atual.expression;
  return atual;
};
/** Tira embrulhos que não mudam o texto: `String(x)`, `x.toString()`, `` `${x}` `` sozinho. */
const semConversao = (e: ts.Expression): ts.Expression => {
  let x = semEmbrulho(e);
  for (;;) {
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === "String" && x.arguments.length === 1) x = semEmbrulho(x.arguments[0]);
    else if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === "toString" && !x.arguments.length) x = semEmbrulho(x.expression.expression);
    else if (ts.isTemplateExpression(x) && !x.head.text && x.templateSpans.length === 1 && !x.templateSpans[0].literal.text) x = semEmbrulho(x.templateSpans[0].expression);
    else return x;
  }
};
/** Valores de texto das constantes do arquivo (`const SEP = "_"`), por nome — para argumento passado por nome. */
function constantesDeTexto(sf: ts.SourceFile): Map<string, string[]> {
  const m = new Map<string, string[]>();
  visitar(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    const i = semEmbrulho(n.initializer);
    if (ts.isStringLiteralLike(i)) m.set(n.name.text, [...(m.get(n.name.text) ?? []), i.text]);
  });
  return m;
}
/** Os textos que a expressão pode ser: literal, ou constante do arquivo com esse nome. */
const textosDe = (e: ts.Expression | undefined, consts: Map<string, string[]>): string[] => {
  if (!e) return [];
  const x = semEmbrulho(e);
  if (ts.isStringLiteralLike(x)) return [x.text];
  return ts.isIdentifier(x) ? consts.get(x.text) ?? [] : [];
};
/** Regex que pega "_" e não pega letra nem dígito (`/_/g`, `/_+/g`, `/[_]/g`, `/[_-]+/g`…). */
const regexDeSublinhado = (literal: string) => {
  const m = /^\/(.*)\/([a-z]*)$/s.exec(literal);
  if (!m) return false;
  try { const re = new RegExp(m[1], m[2].replace(/[gy]/g, "")); return re.test("_") && !re.test("a") && !re.test("A") && !re.test("0"); } catch { return false; }
};
/** Expressões que podem chegar ao texto: ramos do ternário e lados de ??/||/&&. */
function folhas(e: ts.Expression): ts.Expression[] {
  const x = semEmbrulho(e);
  if (ts.isConditionalExpression(x)) return [...folhas(x.whenTrue), ...folhas(x.whenFalse)];
  if (ts.isBinaryExpression(x)) {
    const op = x.operatorToken.kind;
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) return [...folhas(x.left), ...folhas(x.right)];
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return folhas(x.right);
  }
  return [x];
}
/** Campo de enum: `x.status`, `x["status"]`, sob `String()`/`toString()`, ou nome local que guarda um
 * (`const s = d.status`, `const { status } = d`, `({ status }) =>`). O escopo é o arquivo: um nome que
 * em algum lugar do arquivo guarda enum conta em todo ele (falha fechada). */
function detectorDeCampo(sf: ts.SourceFile) {
  const aliases = new Set<string>();
  const campo = (e: ts.Expression): ts.Expression | null => {
    const x = semConversao(e);
    if (ts.isPropertyAccessExpression(x) && nomeDeEnum(x.name.text)) return x;
    if (ts.isElementAccessExpression(x) && ts.isStringLiteralLike(x.argumentExpression) && nomeDeEnum(x.argumentExpression.text)) return x;
    if (ts.isIdentifier(x) && aliases.has(x.text)) return x;
    // Lista de enums em texto: `itens.map((i) => i.status).join(", ")` ou só o `.map(...)` no JSX.
    if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression)) {
      const metodo = x.expression.name.text, [fn] = x.arguments;
      if (metodo === "join") return campo(x.expression.expression);
      if ((metodo === "map" || metodo === "flatMap") && fn && ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return campo(fn.body);
    }
    return null;
  };
  // Ponto fixo: um alias pode guardar outro (`const a = d.status; const b = a;`).
  for (let mudou = true; mudou;) {
    mudou = false;
    visitar(sf, (n) => {
      let nome: string | null = null;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && campo(n.initializer)) nome = n.name.text;
      if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && !n.dotDotDotToken) {
        const chave = n.propertyName ? (ts.isIdentifier(n.propertyName) || ts.isStringLiteral(n.propertyName) ? n.propertyName.text : null) : n.name.text;
        if (chave && ts.isObjectBindingPattern(n.parent) && nomeDeEnum(chave)) nome = n.name.text;
      }
      if (nome && !aliases.has(nome)) { aliases.add(nome); mudou = true; }
    });
  }
  return campo;
}
/** O template está em posição de texto? (filho de JSX ou atributo de texto, atravessando ternário e ??). */
function templateEmTexto(t: ts.TemplateExpression): boolean {
  let no: ts.Node = t;
  while (no.parent && (ts.isParenthesizedExpression(no.parent) || ts.isConditionalExpression(no.parent) || ts.isBinaryExpression(no.parent))) no = no.parent;
  const pai = no.parent;
  if (!pai || !ts.isJsxExpression(pai)) return false;
  if (ts.isJsxElement(pai.parent) || ts.isJsxFragment(pai.parent)) return true;
  return ts.isJsxAttribute(pai.parent) && ATRIBUTOS_TEXTO.has(pai.parent.name.getText());
}

export type EnumCru = { tipo: "sublinhado" | "caixa" | "texto"; trecho: string; linha: number };

/** Enum cru que uma tela imprime ou transforma em "rótulo". */
export function enumsCrus(fonte: string, arquivo = "x.tsx"): EnumCru[] {
  const sf = arvore(fonte, arquivo);
  const achados: EnumCru[] = [];
  const achar = (tipo: EnumCru["tipo"], no: ts.Node) => achados.push({ tipo, trecho: no.getText(sf).replace(/\s+/g, " ").slice(0, 90), linha: linhaDe(sf, no) });
  const consts = constantesDeTexto(sf), campoEnum = detectorDeCampo(sf);
  visitar(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text, [a, b] = n.arguments;
      // x.replaceAll("_", " "), x.replace(/_+/g, " "), x.replace(SEP, " "), x.split("_").join(" ")
      const sublinhado = (arg?: ts.Expression) => !!arg && (textosDe(arg, consts).includes("_") || (ts.isRegularExpressionLiteral(semEmbrulho(arg)) && regexDeSublinhado(semEmbrulho(arg).getText(sf))));
      const espaco = (arg?: ts.Expression) => textosDe(arg, consts).includes(" ");
      if ((metodo === "replaceAll" || metodo === "replace") && sublinhado(a) && espaco(b)) achar("sublinhado", n);
      if (metodo === "join" && espaco(a)) {
        const alvo = semEmbrulho(n.expression.expression);
        if (ts.isCallExpression(alvo) && ts.isPropertyAccessExpression(alvo.expression) && alvo.expression.name.text === "split" && sublinhado(alvo.arguments[0])) achar("sublinhado", n);
      }
      // x.status.toLowerCase(): o código em minúscula não é rótulo ("a agenda está cancelado")
      if (/^to(Locale)?(Lower|Upper)Case$/.test(metodo) && campoEnum(n.expression.expression)) achar("caixa", n);
    }
    // {x.status} (ou {cond ? x.status : …}, {x.status ?? "—"}) como texto do JSX
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      // Template fica com o detector de template abaixo (um achado só).
      for (const folha of folhas(n.expression)) if (!ts.isTemplateExpression(semEmbrulho(folha)) && campoEnum(folha)) achar("texto", folha);
    }
    // `Situação: ${x.status}` em texto do JSX
    if (ts.isTemplateExpression(n) && templateEmTexto(n)) {
      for (const span of n.templateSpans) for (const folha of folhas(span.expression)) if (campoEnum(folha)) achar("texto", folha);
    }
  });
  return achados;
}

/** Campos com nome de enum que já chegam como texto (o servidor rotulou) ou não são enum. Cada um casa com
 * exatamente `vezes` achados (1, se omitido). */
const TEXTO_JA_ROTULADO: { arquivo: string; trecho: string; motivo: string; vezes?: number }[] = [
  { arquivo: "src/app/(app)/academico/recuperacoes/page.tsx", trecho: "item.estado", motivo: "o servidor já devolve o texto (\"Sem nota\", \"Oficializada\"…), server/avaliacoes/recuperacao-consulta.ts" },
  { arquivo: "src/app/(app)/financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx", trecho: "c.tipo", motivo: "tipo de comissão já rotulado no servidor (\"Fixa\"/\"Percentual\"), server/contratos/aditivo-acerto-taxa-consulta.ts" },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", trecho: "acerto.alcance", motivo: "frase montada por descreverAcerto (\"todas as cobranças da matrícula\"…)" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx", trecho: "t.categoria", motivo: "categoria do template na Meta (utility/marketing), texto livre e não enum do schema" },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx", trecho: "p.destino", motivo: "frase montada pela página (\"Aula T-01 — …\" / \"Reposição M-1 — Ana\"), regularizacoes-gravacao/page.tsx" },
  { arquivo: "src/app/(app)/alunos/[id]/creditos/[creditoId]/DevolucaoCredito.tsx", trecho: "p.destino", motivo: "destino da devolução digitado pela pessoa (texto livre), server/financeiro/devolucao-credito.ts" },
  { arquivo: "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx", trecho: "impacto.destino", vezes: 2, motivo: "código ou nome da turma de destino, resolvido no servidor (diario/correcao-reposicao-consulta.ts)" },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx", trecho: "statusOrigem", motivo: "situação no sistema de origem, texto do legado preservado (CorrespondenciaStatusMatriculaMigracao.statusOrigem é String)" },
];

describe("(i) enum cru na tela — AST", () => {
  const achados = fontes.flatMap(({ arquivo, conteudo }) => enumsCrus(conteudo, arquivo).map((a) => ({ arquivo, ...a })));

  it("nenhuma tela monta rótulo trocando \"_\" por espaço nem muda a caixa do código", () => {
    expect(achados.filter((a) => a.tipo !== "texto").map((a) => `${a.arquivo}:${a.linha} ${a.trecho}`)).toEqual([]);
  });

  it("nenhuma tela imprime campo de enum direto no texto (rotular(MAPA, valor) ou MAPA[valor])", () => {
    const sobra = achados.filter((a) => a.tipo === "texto" && !TEXTO_JA_ROTULADO.some((e) => e.arquivo === a.arquivo && e.trecho === a.trecho));
    expect(sobra.map((a) => `${a.arquivo}:${a.linha} ${a.trecho}`)).toEqual([]);
  });

  it("cada exceção casa com exatamente os seus achados (exceção sem caso sai da lista)", () => {
    for (const e of TEXTO_JA_ROTULADO) {
      expect(achados.filter((a) => a.tipo === "texto" && a.arquivo === e.arquivo && a.trecho === e.trecho), `${e.arquivo} ${e.trecho}`).toHaveLength(e.vezes ?? 1);
    }
  });

  it("autoteste: o detector pega as formas conhecidas em fontes virtuais", () => {
    const tipos = (fonte: string) => enumsCrus(fonte).map((a) => `${a.tipo}:${a.trecho}`);
    expect(tipos('const r = <p>{i.habilidade.replaceAll("_", " ")}</p>;')).toEqual(['sublinhado:i.habilidade.replaceAll("_", " ")']);
    expect(tipos('const r = s.replace(/_/g, " ");')).toEqual(['sublinhado:s.replace(/_/g, " ")']);
    expect(tipos("const r = `(${t.statusMeta.toLowerCase().replace(\"_\", \" \")})`;")).toEqual([
      'sublinhado:t.statusMeta.toLowerCase().replace("_", " ")', "caixa:t.statusMeta.toLowerCase()",
    ]);
    expect(tipos('const r = x.split("_").join(" ");')).toEqual(['sublinhado:x.split("_").join(" ")']);
    expect(tipos("const r = <p>Estado: {i.status}.</p>;")).toEqual(["texto:i.status"]);
    expect(tipos("const r = <p>{d.encontro!.status}</p>;")).toEqual(["texto:d.encontro!.status"]);
    expect(tipos('const r = <p>{x ? p.situacao : "—"} {NOTA[d.status] ?? d.status}</p>;')).toEqual(["texto:p.situacao", "texto:d.status"]);
    expect(tipos("const r = <h3>{`Proposta ${p.estado}`}</h3>;")).toEqual(["texto:p.estado"]);
    expect(tipos("const r = <input aria-label={`Motivo ${p.tipo}`} />;")).toEqual(["texto:p.tipo"]);
    expect(tipos("const r = <p>A agenda está {a.encontroStatus.toLowerCase()}</p>;")).toEqual(["caixa:a.encontroStatus.toLowerCase()"]);
    // Não acusa: rótulo do mapa, key/name/value, comparação, campo que não é enum, minúscula de rótulo.
    expect(tipos([
      "const r = <li key={`${p.papel}:${p.etapa}`} data-x={p.status}>{rotular(MAPA, i.status)} {MAPA[i.status]} {p.nome}</li>;",
      "const s = <input name={`nota-${n.habilidade}`} value={c.tipo} />;",
      'const t = i.status === "PREVISTO" ? 1 : 2; const u = f.get(`${p.papel}_nome`);',
      "const v = <p>{rotular(MAPA, x.tipo).toLowerCase()} {busca.trim().toLowerCase()}</p>;",
    ].join("\n"))).toEqual([]);
  });

  it("autoteste (R1 da #138, B1): alias, desestruturação, String(), colchete, campo composto, regex e constante", () => {
    const tipos = (fonte: string) => enumsCrus(fonte).map((a) => `${a.tipo}:${a.trecho}`);
    expect(tipos("const s = d.status; const r = <p>{s}</p>;")).toEqual(["texto:s"]);
    expect(tipos("const a = d.status; const b = a; const r = <p>{b}</p>;")).toEqual(["texto:b"]);
    expect(tipos("const { situacao } = d; const r = <p>{situacao}</p>;")).toEqual(["texto:situacao"]);
    expect(tipos("const { status: s } = d; const r = <p>{s}</p>;")).toEqual(["texto:s"]);
    expect(tipos("function B({ estado }: P) { return <p>{estado}</p>; }")).toEqual(["texto:estado"]);
    expect(tipos("const r = <p>{String(d.status)} {d.tipo.toString()}</p>;")).toEqual(["texto:String(d.status)", "texto:d.tipo.toString()"]);
    expect(tipos("const r = <p>{`${d.status}`}</p>;")).toEqual(["texto:d.status"]);
    expect(tipos('const r = <p>{d["status"]}</p>;')).toEqual(['texto:d["status"]']);
    expect(tipos("const r = <p>{processo.estadoEnvio} {i.decisao} {f.participacaoAnterior} {o.ocorrenciaHistoricaTipo} {p.ambiente}</p>;")).toEqual([
      "texto:processo.estadoEnvio", "texto:i.decisao", "texto:f.participacaoAnterior", "texto:o.ocorrenciaHistoricaTipo", "texto:p.ambiente",
    ]);
    expect(tipos('const r = <p>{xs.map((i) => i.status).join(", ")} {ys.map((y) => y.tipo)}</p>;')).toEqual(['texto:xs.map((i) => i.status).join(", ")', "texto:ys.map((y) => y.tipo)"]);
    expect(tipos('const r = h.habilidade.replace(/_+/g, " ");')).toEqual(['sublinhado:h.habilidade.replace(/_+/g, " ")']);
    expect(tipos('const r = x.replace(/[_]/g, " ");')).toEqual(['sublinhado:x.replace(/[_]/g, " ")']);
    expect(tipos('const SEP = "_", ESP = " "; const r = x.replaceAll(SEP, ESP);')).toEqual(["sublinhado:x.replaceAll(SEP, ESP)"]);
    // Não acusa: id/data/nome/texto de campo de enum, motivo da decisão, rótulo de produto, regex que não pega "_" sozinho.
    expect(tipos([
      "const r = <p>{d.statusId} {d.estadoEm} {d.tipoNome} {d.motivoDecisao} {d.decisaoId} {p.produtoDestino}</p>;",
      'const s = x.replace(/a_b/g, " ");',
    ].join("\n"))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// (i) enum cru na tela — por renderização: cada tela com cada valor dos seus enums
// ---------------------------------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  avisos: vi.fn(), envios: vi.fn(), preferencia: vi.fn(), cancelamento: vi.fn(), quantidade: vi.fn(), segundas: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn(async () => ({ id: "u" })) }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/comunicacoes-agenda/consultas", () => ({ consultarAvisosAlteracaoAgenda: mocks.avisos }));
vi.mock("@/app/(app)/secretaria/avisos-agenda/ReconferirPendencia", () => ({ ReconferirPendencia: () => null }));
vi.mock("@/server/portal-aluno/fila-envios", () => ({ consultarFilaEnviosPortalAluno: mocks.envios }));
vi.mock("@/app/(app)/secretaria/envios-portal/ConciliacaoEnvio", () => ({ ConciliacaoEnvio: () => null }));
vi.mock("@/server/avaliacoes/recuperacao-agenda-cancelamento", () => ({ consultarCancelamentoAgendaRecuperacao: mocks.cancelamento }));
vi.mock("@/app/(app)/academico/avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => null }));
vi.mock("@/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/Formularios", () => ({ Propor: () => null, Decidir: () => null }));
vi.mock("@/server/agenda/modalidade-quantidade-consulta", () => ({ consultarPropostaQuantidadeAulasModalidade: mocks.quantidade }));
vi.mock("@/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas", () => ({ DecidirQuantidadeAulas: () => null }));
vi.mock("@/server/avaliacoes/segunda-chamada-docente", () => ({ listarSegundasChamadasDocente: mocks.segundas }));

import AvisosAgendaPage from "@/app/(app)/secretaria/avisos-agenda/page";
import EnviosPortalPage from "@/app/(app)/secretaria/envios-portal/page";
import CancelamentoRecuperacaoPage from "@/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/page";
import PropostaQuantidadePage from "@/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/page";
import MinhasSegundasChamadasPage from "@/app/(app)/academico/segundas-chamadas/minhas/page";

const instante = new Date("2026-10-01T03:30:00.000Z");
type Campos = Record<string, string>;
type Tela = { renderizar: (c: Campos) => Promise<string>; enums: { campo: string; valores: readonly string[]; mapa: Readonly<Record<string, string>>; fixo: string }[] };

const TELAS: Record<string, Tela> = {
  "/secretaria/avisos-agenda": {
    renderizar: async (c) => {
      mocks.avisos.mockResolvedValue({ ok: true, dado: {
        itens: [{ id: "a", alunoNome: "Ana", canal: c.canal, situacao: c.situacao, atualizadoEm: instante }],
        pendencias: [{ id: "p", matriculaId: "m", matriculaCodigo: "M-1", alunoNome: "Ana", motivo: c.motivo, situacao: "PENDENTE", criadoEm: instante }],
        proximoCursor: null, proximoCursorPendencia: null,
      } });
      return renderToStaticMarkup(await AvisosAgendaPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "canal", valores: Object.values(CanalAvisoAlteracaoAgenda), mapa: L.CANAL_AVISO_ALTERACAO_AGENDA_LABEL, fixo: "EMAIL" },
      { campo: "situacao", valores: Object.values(SituacaoAvisoAlteracaoAgenda), mapa: L.SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, fixo: "PREPARADO" },
      { campo: "motivo", valores: Object.values(MotivoPendenciaAvisoAgenda), mapa: L.MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, fixo: "CONTATO_INDISPONIVEL" },
    ],
  },
  "/secretaria/envios-portal": {
    renderizar: async (c) => {
      mocks.envios.mockResolvedValue({ ok: true, dado: { proximoCursor: null, itens: [
        { id: "e", alunoNome: "Ana", finalidade: c.finalidade, situacao: c.situacao, criadoEm: instante, atualizadoEm: instante, conciliacao: null },
      ] } });
      return renderToStaticMarkup(await EnviosPortalPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "finalidade", valores: Object.values(FinalidadeTokenPortalAluno), mapa: L.FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, fixo: "CONVITE" },
      { campo: "situacao", valores: Object.values(SituacaoEnvioPortalAluno), mapa: L.SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, fixo: "PREPARADO" },
    ],
  },
  "cancelamento da recuperação pela escola": {
    renderizar: async (c) => {
      mocks.cancelamento.mockResolvedValue({ ok: true, dado: {
        identificacao: {}, estadoConferido: "a".repeat(64), podePropor: false, proximoAntesId: null, propostas: [],
        atual: { reservaId: "r", matriculaId: "m", cancelamentoId: null, itens: [{ id: "i", habilidade: c.habilidade, realizacaoId: null, inicio: "2026-01-01T02:30:00Z", fim: "2026-01-01T03:30:00Z", status: c.status, fusoOrigem: "UTC" }] },
      } });
      return renderToStaticMarkup(await CancelamentoRecuperacaoPage({ params: Promise.resolve({ reservaId: "r" }), searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "habilidade", valores: HABILIDADES, mapa: L.HABILIDADE_LABEL, fixo: "LEITURA" },
      { campo: "status", valores: Object.values(StatusEncontroAgenda), mapa: L.STATUS_ENCONTRO_LABEL, fixo: "PREVISTO" },
    ],
  },
  "revisão da quantidade de aulas": {
    renderizar: async (c) => {
      mocks.quantidade.mockResolvedValue({ ok: true, dado: {
        id: "p", modalidadeId: "m", modalidade: { nome: "Inglês" }, versao: 2, quantidadeAnterior: 2, quantidadeNova: 3, situacao: c.situacao,
        motivo: "Revisão", preparador: { nome: "Secretaria" }, decisao: null, aplicadaEm: null,
        impactos: [{ id: "i", turmaId: "t", turma: { codigo: "T-01" }, quantidadeAnterior: 2, quantidadeNova: 3, alcance: c.alcance, excecoesQ37: [], snapshot: {} }],
      } });
      return renderToStaticMarkup(await PropostaQuantidadePage({ params: Promise.resolve({ id: "m", propostaId: "p" }) }));
    },
    enums: [
      { campo: "situacao", valores: Object.values(SituacaoPropostaQuantidadeAulas), mapa: L.SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL, fixo: "APLICADA" },
      { campo: "alcance", valores: Object.values(AlcanceImpactoQuantidadeAulas), mapa: L.ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL, fixo: "AUMENTO_NAO_INICIADA" },
    ],
  },
  "/academico/segundas-chamadas/minhas": {
    renderizar: async (c) => {
      mocks.segundas.mockResolvedValue({ ok: true, dado: { proximoId: null, itens: [{
        reservaId: "r", codigoAvaliacao: "AV", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fusoOrigem: "UTC",
        status: c.status, aluno: "Ana", matriculaCodigo: "M", turma: "T", realizacao: null, podeRealizar: false,
      }] } });
      return renderToStaticMarkup(await MinhasSegundasChamadasPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [{ campo: "status", valores: Object.values(StatusReservaSegundaChamada), mapa: L.STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, fixo: "RESERVADA" }],
  },
};

/** Só o texto lido (sem tags nem atributos). */
const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&");
const ocorrencias = (t: string, trecho: string) => t.split(trecho).length - 1;
const codigoCru = (t: string, valor: string) => new RegExp(`(^|[^A-Za-z0-9_])${valor}([^A-Za-z0-9_]|$)`).test(t);

describe("(i) enum cru na tela — renderização com cada valor", () => {
  beforeEach(() => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
  });

  for (const [tela, { renderizar, enums }] of Object.entries(TELAS)) {
    for (const { campo, valores, mapa } of enums) {
      it(`${tela} · ${campo}: cada valor aparece pelo rótulo do mapa central, nunca pelo código`, async () => {
        const fixos = Object.fromEntries(enums.map((e) => [e.campo, e.fixo]));
        // Linha de base com valor desconhecido: o rótulo testado tem de aparecer A MAIS, por causa do valor.
        const base = texto(await renderizar({ ...fixos, [campo]: "VALOR_DESCONHECIDO" }));
        for (const valor of valores) {
          const t = texto(await renderizar({ ...fixos, [campo]: valor }));
          expect(codigoCru(t, valor), `${tela} · ${campo}=${valor} imprimiu o código`).toBe(false);
          expect(ocorrencias(t, mapa[valor]) - ocorrencias(base, mapa[valor]), `${tela} · ${campo}=${valor} → "${mapa[valor]}"`).toBeGreaterThanOrEqual(1);
        }
      });
    }
  }

  it("autoteste: o detector de código cru no texto não confunde rótulo com código", () => {
    expect(codigoCru(texto("<p>Situação: RESERVADA.</p>"), "RESERVADA")).toBe(true);
    expect(codigoCru(texto('<p data-v="RESERVADA">Situação: Reservada.</p>'), "RESERVADA")).toBe(false);
    expect(codigoCru(texto("<p>LIBERADA_CANCELAMENTO_ESCOLA</p>"), "LIBERADA")).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------
// (ii) mapa de rótulo de enum só em src/lib/labels.ts
// ---------------------------------------------------------------------------------------------------

export type MapaLocal = { nome: string; enums: string[]; linha: number };
const CODIGO = /^[A-Z][A-Z0-9_]*$/;
const CLASSE = /(^|\s)(bg|text|border|ring|from|to)-[a-z]/;

/** Objetos literais de uma fonte com chaves de UM enum e valores de texto (rótulo) — o mapa ad-hoc. */
export function mapasDeRotulo(fonte: string, enums: Map<string, string[]>, arquivo = "x.tsx"): MapaLocal[] {
  const sf = arvore(fonte, arquivo);
  const mapas: MapaLocal[] = [];
  const consts = constantesDeTexto(sf);
  // Nomes que vêm de src/lib/labels.ts (import nomeado ou namespace) — espalhar um deles num objeto da tela
  // é reabrir o mapa central com outra redação.
  const deLabels = new Set<string>();
  for (const d of sf.statements) {
    if (!ts.isImportDeclaration(d) || !ts.isStringLiteral(d.moduleSpecifier) || !/(^|\/)labels$/.test(d.moduleSpecifier.text)) continue;
    const b = d.importClause?.namedBindings;
    if (b && ts.isNamedImports(b)) for (const e of b.elements) deLabels.add(e.name.text);
    if (b && ts.isNamespaceImport(b)) deLabels.add(b.name.text);
  }
  const ehMapaCentral = (e: ts.Expression): boolean => {
    const x = semEmbrulho(e);
    if (ts.isIdentifier(x)) return deLabels.has(x.text) || /_LABEL$/.test(x.text);
    return ts.isPropertyAccessExpression(x) && (/_LABEL$/.test(x.name.text) || (ts.isIdentifier(x.expression) && deLabels.has(x.expression.text)));
  };
  const nomeDoLiteral = (n: ts.Node) => {
    // Nome da constante só quando o literal É o valor dela (parênteses, as/satisfies, Object.freeze);
    // literal dentro de JSX ou de expressão maior é "inline".
    let no: ts.Node = n.parent;
    while (no && (ts.isParenthesizedExpression(no) || ts.isAsExpression(no) || ts.isSatisfiesExpression(no)
      || (ts.isCallExpression(no) && no.expression.getText(sf) === "Object.freeze"))) no = no.parent;
    return no && ts.isVariableDeclaration(no) && ts.isIdentifier(no.name) ? no.name.text : `(literal na linha ${linhaDe(sf, n)})`;
  };
  /** O texto do valor: literal ou constante de texto do arquivo (um só valor possível). */
  const valorDeTexto = (e: ts.Expression) => { const v = textosDe(e, consts); return v.length === 1 ? v[0] : null; };
  const ehRotulo = (valores: string[]) => valores.some((v) => /[A-Za-zÀ-ú]/.test(v)) && !valores.every((v) => CODIGO.test(v)) && !valores.some((v) => CLASSE.test(v));
  const donosDe = (chaves: string[]) => [...enums].filter(([, valores]) => chaves.every((c) => valores.includes(c))).map(([nome]) => nome);
  visitar(sf, (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      // { ...STATUS_X_LABEL, CODIGO: "Outra redação" }: espalha o mapa central e sobrescreve rótulo.
      const espalhados = n.properties.filter((p): p is ts.SpreadAssignment => ts.isSpreadAssignment(p) && ehMapaCentral(p.expression));
      if (espalhados.length) {
        const proprios = n.properties.filter(ts.isPropertyAssignment);
        if (proprios.some((p) => valorDeTexto(p.initializer) !== null)) mapas.push({ nome: nomeDoLiteral(n), enums: espalhados.map((p) => `...${p.expression.getText(sf)}`), linha: linhaDe(sf, n) });
        return;
      }
      if (n.properties.length < 2) return;
      const pares = n.properties.map((p) => {
        if (!ts.isPropertyAssignment(p)) return null;
        const chave = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
        const valor = valorDeTexto(p.initializer);
        return chave !== null && valor !== null ? { chave, valor } : null;
      });
      if (pares.some((p) => p === null)) return;
      const validos = pares as { chave: string; valor: string }[];
      if (!validos.every((p) => CODIGO.test(p.chave))) return;
      // Rótulo: há texto com letra, e os valores não são códigos (de-para entre enums) nem classes CSS.
      if (!ehRotulo(validos.map((p) => p.valor))) return;
      const donos = donosDe(validos.map((p) => p.chave));
      if (donos.length) mapas.push({ nome: nomeDoLiteral(n), enums: donos, linha: linhaDe(sf, n) });
      return;
    }
    // Mapa em ternário: x === "ATIVA" ? "Ativa" : x === "PAUSADA" ? "Pausada" : "Encerrada". Só a cabeça da
    // cadeia; cada condição compara o MESMO sujeito com um código, e todas as folhas são texto de rótulo. Uma
    // comparação só (dois valores) é frase de sim/não, não mapa: a cadeia precisa de duas ou mais.
    if (ts.isConditionalExpression(n) && !(ts.isConditionalExpression(semPai(n)) )) {
      const codigos: string[] = [], folhasTexto: (string | null)[] = [], sujeitos = new Set<string>();
      let ok = true;
      const percorrer = (e: ts.Expression) => {
        const x = semEmbrulho(e);
        if (!ts.isConditionalExpression(x)) { folhasTexto.push(valorDeTexto(x)); return; }
        const c = semEmbrulho(x.condition);
        if (!ts.isBinaryExpression(c) || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(c.operatorToken.kind)) { ok = false; return; }
        const [lado, literal] = ts.isStringLiteralLike(semEmbrulho(c.right)) ? [c.left, semEmbrulho(c.right)] : [c.right, semEmbrulho(c.left)];
        if (!ts.isStringLiteralLike(literal) || !CODIGO.test(literal.text)) { ok = false; return; }
        codigos.push(literal.text); sujeitos.add(semConversao(lado).getText(sf));
        percorrer(x.whenTrue); percorrer(x.whenFalse);
      };
      percorrer(n);
      if (!ok || codigos.length < 2 || sujeitos.size !== 1 || folhasTexto.some((v) => v === null) || !ehRotulo(folhasTexto as string[])) return;
      const donos = donosDe(codigos);
      if (donos.length) mapas.push({ nome: `ternário ${[...sujeitos][0]}`, enums: donos, linha: linhaDe(sf, n) });
    }
  });
  return mapas;
}
/** Pai sem parênteses (para saber se o ternário é ramo de outro). */
const semPai = (n: ts.Node): ts.Node => { let p = n.parent; while (p && ts.isParenthesizedExpression(p)) p = p.parent; return p; };

/** Mapas que ficam na tela: frases do fluxo (próximo passo, confirmação, dica), não o nome do valor. */
const MAPAS_DE_TELA: { arquivo: string; nome: string; motivo: string }[] = [
  { arquivo: "src/app/(app)/academico/MudancasAcademicasPainel.tsx", nome: "nomesStatus", motivo: "fila pedagógica: o texto diz o próximo passo (\"Aprovada · aguardando execução\")" },
  { arquivo: "src/app/(app)/academico/equivalencias/page.tsx", nome: "nomesEstado", motivo: "frases do fluxo de equivalência (\"Autorizada para execução\", \"Transferência efetivada\")" },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/MovimentacoesPainel.tsx", nome: "status", motivo: "fila de pausa/retomada: o texto diz o próximo passo (\"Aprovada; aplicação pendente\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/page.tsx", nome: "acoesResolucao", motivo: "frase do histórico no particípio (\"Cancelamento da solicitação registrado\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/ResolucaoRevisaoProgressao.tsx", nome: "rotulosAcao", motivo: "opção de ação no infinitivo (\"Registrar o cancelamento da solicitação\")" },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/ResolucaoRevisaoProgressao.tsx", nome: "efeitoAcao", motivo: "explicação do efeito de cada ação, não rótulo" },
  { arquivo: "src/app/(app)/configuracao/paises/PaisesPainel.tsx", nome: "CONFIRMACAO_STATUS", motivo: "mensagem de confirmação da transição (\"País ativado.\")" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx", nome: "ESTADO_HINT", motivo: "dica do efeito de cada estado da política" },
  { arquivo: "src/app/(app)/diario/reposicoes/ReposicoesEquipe.tsx", nome: "rotuloParticipacaoOrigem", motivo: "frase sobre a aula de origem (\"falta na aula de origem\")" },
  { arquivo: "src/app/(app)/inbox/InboxCliente.tsx", nome: "NOTA_POR_STATUS", motivo: "mensagem de resultado do envio (\"Mensagem enviada.\")" },
  { arquivo: "src/app/(app)/inbox/InboxCliente.tsx", nome: "ORIGEM_LABEL", motivo: "fragmento minúsculo ao lado da hora da mensagem; envio humano fica sem marca (\"\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/preparacao/page.tsx", nome: "tipos", motivo: "rotula também o regime da preparação, com a duração da hora (\"Hora particular (60 minutos)\")" },
  // Ternários (revisão R1 da #138, B2): os que eram só rótulo foram para labels.ts; ficam as frases do fluxo.
  { arquivo: "src/app/(app)/financeiro/RetomadasPainel.tsx", nome: "ternário p.status", motivo: "fila de retomada: \"Aguardando aprovação\" diz quem age (o Financeiro aprova)" },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", nome: "ternário v.status", motivo: "versão das condições de encerramento: \"Aguardando aprovação\" diz quem age" },
  { arquivo: "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx", nome: "ternário v.status", motivo: "versão das condições de horas aguarda REVISÃO da gestão (\"Aguardando revisão\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx", nome: "ternário versao.status", motivo: "versão das condições de continuidade aguarda REVISÃO da gestão (\"Aguardando revisão\")" },
  { arquivo: "src/app/(app)/matriculas/[id]/compensacoes/[cobrancaId]/CompensacaoCobertura.tsx", nome: "ternário proposta.status", motivo: "frase do direito à compensação (\"Direito aprovado\", \"Proposta rejeitada\")" },
  { arquivo: "src/app/(app)/academico/equivalencias/[propostaId]/page.tsx", nome: "ternário proposta.estado", motivo: "frases do fluxo de equivalência (\"Autorizada para execução\"), as mesmas de nomesEstado na lista" },
  { arquivo: "src/app/(app)/academico/recuperacoes/AgendaPublicada.tsx", nome: "ternário agenda.status", motivo: "frase do encontro publicado (\"Realização registrada\", \"Encontro previsto\")" },
  { arquivo: "src/app/(app)/academico/correcoes/page.tsx", nome: "ternário i.tipo", motivo: "texto do link de ação por destino (\"Conferir histórico da aula\")" },
  { arquivo: "src/app/(app)/diario/encontros/[id]/correcao/CorrecaoAula.tsx", nome: "ternário reposicao.agendaParticular.statusBeneficio", motivo: "fragmento minúsculo no meio da frase do benefício (\"benefício reservado\", \"isenção excepcional registrada\")" },
  { arquivo: "src/app/(app)/leads/[id]/FichaLead.tsx", nome: "ternário lead.temperatura", motivo: "faixa de prioridade derivada da temperatura (Alta/Média/Baixa, doc 09), não o nome da temperatura" },
];

describe("(ii) mapa de rótulo de enum só em src/lib/labels.ts", () => {
  const mapas = fontes.flatMap(({ arquivo, conteudo }) => mapasDeRotulo(conteudo, ENUMS, arquivo).map((m) => ({ arquivo, ...m })));

  it("nenhuma tela define mapa de rótulo de enum fora das exceções (use src/lib/labels.ts)", () => {
    const fora = mapas.filter((m) => !MAPAS_DE_TELA.some((e) => e.arquivo === m.arquivo && e.nome === m.nome));
    expect(fora.map((m) => `${m.arquivo}:${m.linha} ${m.nome} (${m.enums.join("|")})`)).toEqual([]);
  });

  it("cada exceção casa com exatamente um mapa (exceção sem caso sai da lista)", () => {
    for (const e of MAPAS_DE_TELA) expect(mapas.filter((m) => m.arquivo === e.arquivo && m.nome === e.nome), `${e.arquivo}#${e.nome}`).toHaveLength(1);
  });

  it("autoteste: o detector pega mapa tipado, sem tipo, inline e com aspas na chave; ignora de-para, classes e chave fora de enum", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]], ["Habilidade", ["FALA", "LEITURA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => `${m.nome}:${m.enums.join("|")}`);
    expect(nomes('const r: Record<StatusX, string> = { ATIVA: "Ativa", PAUSADA: "Pausada", ENCERRADA: "Encerrada" };')).toEqual(["r:StatusX"]);
    expect(nomes('const nomes = { FALA: "Fala", LEITURA: "Leitura" };')).toEqual(["nomes:Habilidade"]);
    expect(nomes('const x = <p>{({ ATIVA: "Ativa", PAUSADA: "Pausada" })[s]}</p>;')).toEqual(["(literal na linha 1):StatusX"]);
    expect(nomes('const r = { "ATIVA": "ativa", "PAUSADA": "pausada" } satisfies Record<string, string>;')).toEqual(["r:StatusX"]);
    expect(nomes('const de = { ATIVA: "ATIVACAO", PAUSADA: "PAUSA" };')).toEqual([]);
    expect(nomes('const cls = { ATIVA: "bg-green-100 text-green-700", PAUSADA: "bg-amber-100" };')).toEqual([]);
    expect(nomes('const m = { ATIVA: "Ativa", OUTRA: "Outra" };')).toEqual([]);
    expect(nomes('const m = { ATIVA: { label: "Ativa" }, PAUSADA: { label: "Pausada" } };')).toEqual([]);
  });

  it("autoteste (R1 da #138, B2): spread do mapa central, valor por constante e mapa em ternário", () => {
    const enums = new Map([["StatusX", ["ATIVA", "PAUSADA", "ENCERRADA"]]]);
    const nomes = (fonte: string) => mapasDeRotulo(fonte, enums).map((m) => `${m.nome}:${m.enums.join("|")}`);
    expect(nomes('import { STATUS_X_LABEL } from "@/lib/labels"; const m = { ...STATUS_X_LABEL, ATIVA: "Em vigor" };')).toEqual(["m:...STATUS_X_LABEL"]);
    expect(nomes('import * as L from "@/lib/labels"; const m = { ...L.ROTULOS, PAUSADA: "Parada" };')).toEqual(["m:...L.ROTULOS"]);
    expect(nomes('const A = "Ativa", P = "Pausada"; const m = { ATIVA: A, PAUSADA: P };')).toEqual(["m:StatusX"]);
    expect(nomes('const r = <p>{s === "ATIVA" ? "Ativa" : s === "PAUSADA" ? "Pausada" : "Encerrada"}</p>;')).toEqual(["ternário s:StatusX"]);
    expect(nomes('const r = <p>{(d.status === "ATIVA") ? "Ativa" : (d.status === "PAUSADA" ? "Pausada" : "Encerrada")}</p>;')).toEqual(["ternário d.status:StatusX"]);
    // Não acusa: sim/não (uma comparação), sujeitos diferentes, classes, folha que não é texto, spread sem sobrescrever.
    expect(nomes([
      'const a = s === "ATIVA" ? "Ativa" : "Inativa";',
      'const b = s === "ATIVA" ? "Ativa" : t === "PAUSADA" ? "Pausada" : "Encerrada";',
      'const c = s === "ATIVA" ? "bg-green-50" : s === "PAUSADA" ? "bg-amber-50" : "bg-gray-50";',
      'const d = s === "ATIVA" ? rotulo : s === "PAUSADA" ? "Pausada" : "Encerrada";',
      'import { X_LABEL } from "@/lib/labels"; const e = { ...X_LABEL };',
    ].join("\n"))).toEqual([]);
  });

  it("os mapas que as telas tinham soltos continuam fora delas (movidos para labels.ts)", () => {
    const fonte = (arquivo: string) => fontes.find((f) => f.arquivo === arquivo)?.conteudo ?? "";
    const MOVIDOS: [arquivo: string, trecho: string][] = [
      ["src/app/(app)/financeiro/FinanceiroPainel.tsx", "TIPO_APROVACAO_LABEL[a.tipo]"],
      ["src/app/(app)/configuracao/catalogo/PrecosPainel.tsx", "TIPO_COBRANCA_LABEL[p.tipoCobranca]"],
      ["src/app/(app)/configuracao/catalogo/ModalidadesPainel.tsx", "SEGMENTO_LABEL[m.segmento]"],
      ["src/components/CopilotoSugestoes.tsx", "rotular(ETAPA_LABEL, String(p.etapa))"],
      ["src/app/(app)/secretaria/avisos-agenda/page.tsx", "rotular(CANAL_AVISO_ALTERACAO_AGENDA_LABEL, i.canal)"],
      ["src/app/(app)/academico/segundas-chamadas/agendas/page.tsx", "const rotulosReserva = STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL;"],
      ["src/app/(app)/academico/avaliacoes/[alocacaoId]/page.tsx", "HABILIDADE_LABEL[h.habilidade]"],
    ];
    expect(MOVIDOS.filter(([arquivo, trecho]) => !fonte(arquivo).includes(trecho))).toEqual([]);
    // "Comunicação oral" era a redação divergente de FALA em três telas; o mapa central usa "Fala".
    expect(fontes.filter((f) => f.conteudo.includes("Comunicação oral")).map((f) => f.arquivo)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// (iii) os mapas novos de labels.ts cobrem o enum inteiro, em texto de gente
// ---------------------------------------------------------------------------------------------------

/** Siglas que ficam em maiúscula dentro de um rótulo. */
const SIGLAS = new Set(["PIX", "B2B", "CPF", "CNPJ", "PDF", "IA", "UTC", "ID", "API", "ERP"]);
export const palavrasEmCaixaAlta = (rotulo: string) => rotulo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter((p) => /^[A-ZÀ-Þ]{2,}$/.test(p) && !SIGLAS.has(p));
/** Objeto não vazio só com valores de texto, e não de classes CSS — a forma de um mapa de rótulo. */
const ehMapaDeTexto = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).length > 0
  && Object.values(v).every((x) => typeof x === "string") && !Object.values(v).some((x) => CLASSE.test(x as string));

const MAPAS_NOVOS: [nome: string, mapa: Readonly<Record<string, string>>, valores: readonly string[]][] = [
  ["HABILIDADE_LABEL", L.HABILIDADE_LABEL, HABILIDADES],
  ["STATUS_TURMA_LABEL", L.STATUS_TURMA_LABEL, Object.values(StatusTurma)],
  ["STATUS_MUDANCA_ACADEMICA_LABEL", L.STATUS_MUDANCA_ACADEMICA_LABEL, Object.values(StatusMudancaAcademica)],
  ["STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL", L.STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, Object.values(StatusReservaSegundaChamada)],
  ["SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL", L.SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL, ["OFICIALIZADA", "REJEITADA", "SUBMETIDA", "RASCUNHO"]],
  ["SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL", L.SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL, Object.values(SituacaoPropostaQuantidadeAulas)],
  ["ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL", L.ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL, Object.values(AlcanceImpactoQuantidadeAulas)],
  ["PARTICIPACAO_AULA_LABEL", L.PARTICIPACAO_AULA_LABEL, Object.values(ParticipacaoAula)],
  ["FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL", L.FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, Object.values(FinalidadeTokenPortalAluno)],
  ["SITUACAO_ENVIO_PORTAL_ALUNO_LABEL", L.SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, Object.values(SituacaoEnvioPortalAluno)],
  ["SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL", L.SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL, Object.values(SituacaoTrocaEmailPortalAluno)],
  ["CANAL_AVISO_ALTERACAO_AGENDA_LABEL", L.CANAL_AVISO_ALTERACAO_AGENDA_LABEL, Object.values(CanalAvisoAlteracaoAgenda)],
  ["SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL", L.SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, Object.values(SituacaoAvisoAlteracaoAgenda)],
  ["MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL", L.MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, Object.values(MotivoPendenciaAvisoAgenda)],
  ["STATUS_RESERVA_VAGA_LABEL", L.STATUS_RESERVA_VAGA_LABEL, Object.values(StatusReservaVaga)],
  ["STATUS_CORRECAO_CADASTRO_LABEL", L.STATUS_CORRECAO_CADASTRO_LABEL, Object.values(StatusCorrecaoCadastro)],
  ["TIPO_PAGADOR_LABEL", L.TIPO_PAGADOR_LABEL, PagadorEntradaFinanceiraHistoricaSchema.shape.tipo.options],
  ["STATUS_SOLICITACAO_ENCERRAMENTO_LABEL", L.STATUS_SOLICITACAO_ENCERRAMENTO_LABEL, Object.values(StatusSolicitacaoEncerramento)],
  ["ESTADO_DIA_COMPENSACAO_LABEL", L.ESTADO_DIA_COMPENSACAO_LABEL, Object.values(EstadoDiaCompensacao)],
  ["ESTADO_ENVIO_ASSINATURA_LABEL", L.ESTADO_ENVIO_ASSINATURA_LABEL, Object.values(EstadoEnvioAssinatura)],
  ["TIPO_MOVIMENTACAO_LABEL", L.TIPO_MOVIMENTACAO_LABEL, Object.values(TipoMovimentacao)],
  ["RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL", L.RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL, Object.values(ResultadoEnsaioVinculoMigracao)],
  ["ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL", L.ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL, Object.values(EstadoLinhaPreparacaoMigracao)],
  ["SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL", L.SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL, Object.values(SituacaoAplicacaoCadastroMigracao)],
  ["CATEGORIA_DOCUMENTO_LABEL", L.CATEGORIA_DOCUMENTO_LABEL, Object.values(CategoriaDocumento)],
  ["STATUS_FATURA_B2B_LABEL", L.STATUS_FATURA_B2B_LABEL, Object.values(StatusFaturaB2B)],
  ["TIPO_SUGESTAO_IA_LABEL", L.TIPO_SUGESTAO_IA_LABEL, Object.values(TipoSugestaoIA)],
  ["STATUS_TEMPLATE_LABEL", L.STATUS_TEMPLATE_LABEL, Object.values(StatusTemplate)],
  ["TIPO_MENSAGEM_LABEL", L.TIPO_MENSAGEM_LABEL, Object.values(TipoMensagem)],
  ["STATUS_INTENCAO_LABEL", L.STATUS_INTENCAO_LABEL, Object.values(StatusIntencao)],
  ["TIPO_APROVACAO_LABEL", L.TIPO_APROVACAO_LABEL, Object.values(TipoAprovacao)],
  ["VIGENCIA_LABEL", L.VIGENCIA_LABEL, Object.values(Vigencia)],
  ["TIPO_AJUSTE_LABEL", L.TIPO_AJUSTE_LABEL, Object.values(TipoAjuste)],
  ["TIPO_DESTINACAO_RECEBIMENTO_LABEL", L.TIPO_DESTINACAO_RECEBIMENTO_LABEL, Object.values(TipoDestinacaoRecebimento)],
  ["ESTADO_PROPOSTA_DECIDIDA_LABEL", L.ESTADO_PROPOSTA_DECIDIDA_LABEL, ["PENDENTE", "APROVADA", "REJEITADA", "APLICADA"]],
  ["STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL", L.STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL, Object.values(StatusPropostaAcertoTaxaAditivo)],
  ["STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL, Object.values(StatusPropostaConciliacaoFinanceiraMigracao)],
  ["STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL, Object.values(StatusPropostaEntradaFinanceiraHistoricaMigracao)],
  ["STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL, Object.values(StatusPropostaPresencaHistoricaMigracao)],
  ["STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL", L.STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL, Object.values(StatusConjuntoImpactosTaxaAditivo)],
  ["STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL", L.STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL, Object.values(StatusConjuntoImpactosCoberturaAditivo)],
  ["DECISAO_IMPACTO_TAXA_ADITIVO_LABEL", L.DECISAO_IMPACTO_TAXA_ADITIVO_LABEL, Object.values(DecisaoImpactoTaxaAditivo)],
  ["CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL", L.CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL, Object.values(ClassificacaoImpactoCoberturaAditivo)],
  ["MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL", L.MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL, Object.values(ModalidadeConciliacaoFinanceiraMigracao)],
  ["ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL", L.ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL, Object.values(EstadoReservaDevolucaoCredito)],
  ["ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL", L.ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL, Object.values(EstadoReconferenciaDeltaDesistencia)],
  ["UNIDADE_PERMUTA_SERVICO_LABEL", L.UNIDADE_PERMUTA_SERVICO_LABEL, Object.values(UnidadePermutaServico)],
  // Revisão R1 da #138 (B2/B4): mapas que viviam em ternário ou faltavam.
  ["STATUS_PAGAMENTO_INFORMADO_LABEL", L.STATUS_PAGAMENTO_INFORMADO_LABEL, Object.values(StatusPagamentoInformado)],
  ["AMBIENTE_ASSINATURA_LABEL", L.AMBIENTE_ASSINATURA_LABEL, ["SANDBOX", "PRODUCAO"]],
  ["TIPO_OCORRENCIA_HORAS_LABEL", L.TIPO_OCORRENCIA_HORAS_LABEL, OcorrenciaHorasSchema.innerType().shape.ocorrencia.options.map((o) => o.shape.tipo.value)],
  ["DESFECHO_OCORRENCIA_HORAS_LABEL", L.DESFECHO_OCORRENCIA_HORAS_LABEL, SaldoCompraHorasSchema.innerType().shape.reservas.element.shape.desfecho.options.filter((d) => d !== "PENDENTE")],
  ["TIPO_COBRANCA_ENTRADA_LABEL", L.TIPO_COBRANCA_ENTRADA_LABEL, ["MATRICULA", "MENSALIDADE", "HORA_PARTICULAR"]],
  ["REFERENCIA_COBERTURA_MENSAL_LABEL", L.REFERENCIA_COBERTURA_MENSAL_LABEL, Object.values(ReferenciaCoberturaMensal)],
  ["FINALIDADE_NUMERO_LABEL", L.FINALIDADE_NUMERO_LABEL, Object.values(FinalidadeNumero)],
  ["FORMA_AGENDA_OFERTA_LABEL", L.FORMA_AGENDA_OFERTA_LABEL, Object.values(FormaAgendaOferta)],
];

describe("(iii) mapas novos de labels.ts", () => {
  for (const [nome, mapa, valores] of MAPAS_NOVOS) {
    it(`${nome}: chaves = valores do enum; rótulo em texto de gente; congelado`, () => {
      expect(Object.keys(mapa).sort(), nome).toEqual([...valores].sort());
      for (const [valor, rotulo] of Object.entries(mapa)) {
        expect(rotulo.trim(), `${nome}.${valor}`).not.toBe("");
        expect(rotulo, `${nome}.${valor} repete o código`).not.toBe(valor);
        // Caixa alta disfarçada (revisão R1 da #138, B3): "EM ANDAMENTO.", "CONCLUÍDA" — exige minúscula e
        // nenhuma palavra toda em maiúscula fora das siglas; rótulo é nome, sem pontuação final.
        expect(rotulo, `${nome}.${valor} sem minúscula`).toMatch(/[a-zà-ÿ]/);
        expect(palavrasEmCaixaAlta(rotulo), `${nome}.${valor} com palavra em CAIXA ALTA`).toEqual([]);
        expect(rotulo, `${nome}.${valor} com pontuação final`).not.toMatch(/[.;:!?,]$/);
        expect(rotulo, `${nome}.${valor} com "_"`).not.toContain("_");
        expect(rotulo, `${nome}.${valor} sem maiúscula inicial (sentence case)`).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/);
      }
      expect(Object.isFrozen(mapa), `${nome} congelado`).toBe(true);
    });
  }

  it("todo mapa de texto novo de labels.ts está nesta lista, com ou sem _LABEL (mapa novo sem trava não passa)", () => {
    const ANTIGOS = new Set(["ETAPA_LABEL", "TEMPERATURA_LABEL", "SEGMENTO_LABEL", "MOTIVO_PERDA_LABEL", "STATUS_MATRICULA_LABEL", "STATUS_COBRANCA_LABEL",
      "STATUS_COMISSAO_LABEL", "STATUS_ALUNO_LABEL", "TIPO_COBRANCA_LABEL", "FORMA_PAGAMENTO_LABEL", "GENERO_LABEL", "ESCOLARIDADE_LABEL",
      "SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL", "STATUS_ENCONTRO_LABEL"]);
    // Todo mapa de texto exportado, com ou sem o sufixo _LABEL (revisão R1 da #138: `ROTULOS_TURMA` passava).
    const exportados = Object.entries(L).filter(([k, v]) => ehMapaDeTexto(v) && !ANTIGOS.has(k)).map(([k]) => k);
    expect(exportados.filter((k) => !MAPAS_NOVOS.some(([nome]) => nome === k))).toEqual([]);
  });

  it("autoteste (R1 da #138, B3): caixa alta disfarçada com pontuação ou acento; siglas passam", () => {
    expect(palavrasEmCaixaAlta("EM ANDAMENTO.")).toEqual(["EM", "ANDAMENTO"]);
    expect(palavrasEmCaixaAlta("CONCLUÍDA")).toEqual(["CONCLUÍDA"]);
    expect(palavrasEmCaixaAlta("Concluída via API, com PIX")).toEqual([]);
  });

  it("rotular devolve o rótulo e, para valor sem rótulo, o próprio valor (nunca frase inventada)", () => {
    expect(L.rotular(L.HABILIDADE_LABEL, "COMPREENSAO_ORAL")).toBe("Compreensão oral");
    // Valor vindo do banco fora do enum atual (registro antigo): tipado como string, não como literal.
    const valorAntigo: string = "VALOR_ANTIGO";
    expect(L.rotular(L.STATUS_RESERVA_VAGA_LABEL, valorAntigo)).toBe("VALOR_ANTIGO");
  });

  it("autoteste: o leitor de enums do schema separa nome e valores, ignorando comentários", () => {
    const enums = enumsDoSchema("enum StatusX {\n  ATIVA // comentário\n  PAUSADA\n}\n\nmodel M {\n  id String\n}\nenum Outro {\n  A_B\n}\n");
    expect([...enums]).toEqual([["StatusX", ["ATIVA", "PAUSADA"]], ["Outro", ["A_B"]]]);
    expect(ENUMS.get("StatusEncontroAgenda")).toEqual(Object.values(StatusEncontroAgenda));
  });
});
