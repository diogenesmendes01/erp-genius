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
  TipoSugestaoIA, UnidadePermutaServico, Vigencia, StatusEncontroAgenda,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as L from "@/lib/labels";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { PagadorEntradaFinanceiraHistoricaSchema } from "@/server/migracao/entrada-financeira-historica-schema";

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
/** Atributos JSX que são texto lido pela pessoa (os demais — key, href, name, value… — não são). */
const ATRIBUTOS_TEXTO = new Set(["title", "aria-label", "placeholder", "alt", "aria-description"]);

const semEmbrulho = (e: ts.Expression): ts.Expression => {
  let atual = e;
  while (ts.isParenthesizedExpression(atual) || ts.isNonNullExpression(atual) || ts.isAsExpression(atual)) atual = atual.expression;
  return atual;
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
const campoEnum = (e: ts.Expression) => {
  const x = semEmbrulho(e);
  return ts.isPropertyAccessExpression(x) && CAMPOS_ENUM.has(x.name.text) ? x : null;
};
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
  visitar(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text, [a, b] = n.arguments;
      // x.replaceAll("_", " "), x.replace(/_/g, " "), x.replace("_", " "), x.split("_").join(" ")
      const sublinhado = (arg?: ts.Expression) => !!arg && ((ts.isStringLiteralLike(arg) && arg.text === "_") || (ts.isRegularExpressionLiteral(arg) && /^\/_\/[gimsuy]*$/.test(arg.text)));
      if ((metodo === "replaceAll" || metodo === "replace") && sublinhado(a) && !!b && ts.isStringLiteralLike(b) && b.text === " ") achar("sublinhado", n);
      if (metodo === "join" && a && ts.isStringLiteralLike(a) && a.text === " ") {
        const alvo = semEmbrulho(n.expression.expression);
        if (ts.isCallExpression(alvo) && ts.isPropertyAccessExpression(alvo.expression) && alvo.expression.name.text === "split" && sublinhado(alvo.arguments[0])) achar("sublinhado", n);
      }
      // x.status.toLowerCase(): o código em minúscula não é rótulo ("a agenda está cancelado")
      if (/^to(Locale)?(Lower|Upper)Case$/.test(metodo) && campoEnum(n.expression.expression)) achar("caixa", n);
    }
    // {x.status} (ou {cond ? x.status : …}, {x.status ?? "—"}) como texto do JSX
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      for (const folha of folhas(n.expression)) if (campoEnum(folha)) achar("texto", folha);
    }
    // `Situação: ${x.status}` em texto do JSX
    if (ts.isTemplateExpression(n) && templateEmTexto(n)) {
      for (const span of n.templateSpans) for (const folha of folhas(span.expression)) if (campoEnum(folha)) achar("texto", folha);
    }
  });
  return achados;
}

/** Campos com nome de enum que já chegam como texto (o servidor rotulou) ou não são enum. Cada um casa com UM achado. */
const TEXTO_JA_ROTULADO: { arquivo: string; trecho: string; motivo: string }[] = [
  { arquivo: "src/app/(app)/academico/recuperacoes/page.tsx", trecho: "item.estado", motivo: "o servidor já devolve o texto (\"Sem nota\", \"Oficializada\"…), server/avaliacoes/recuperacao-consulta.ts" },
  { arquivo: "src/app/(app)/financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx", trecho: "c.tipo", motivo: "tipo de comissão já rotulado no servidor (\"Fixa\"/\"Percentual\"), server/contratos/aditivo-acerto-taxa-consulta.ts" },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", trecho: "acerto.alcance", motivo: "frase montada por descreverAcerto (\"todas as cobranças da matrícula\"…)" },
  { arquivo: "src/app/(app)/configuracao/whatsapp/TemplatesPainel.tsx", trecho: "t.categoria", motivo: "categoria do template na Meta (utility/marketing), texto livre e não enum do schema" },
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

  it("cada exceção casa com exatamente um achado (exceção sem caso sai da lista)", () => {
    for (const e of TEXTO_JA_ROTULADO) {
      expect(achados.filter((a) => a.tipo === "texto" && a.arquivo === e.arquivo && a.trecho === e.trecho), `${e.arquivo} ${e.trecho}`).toHaveLength(1);
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
  visitar(sf, (n) => {
    if (!ts.isObjectLiteralExpression(n) || n.properties.length < 2) return;
    const pares = n.properties.map((p) => {
      if (!ts.isPropertyAssignment(p)) return null;
      const chave = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
      const valor = ts.isStringLiteralLike(p.initializer) ? p.initializer.text : null;
      return chave !== null && valor !== null ? { chave, valor } : null;
    });
    if (pares.some((p) => p === null)) return;
    const validos = pares as { chave: string; valor: string }[];
    if (!validos.every((p) => CODIGO.test(p.chave))) return;
    // Rótulo: há texto com letra, e os valores não são códigos (de-para entre enums) nem classes CSS.
    if (!validos.some((p) => /[A-Za-zÀ-ú]/.test(p.valor)) || validos.every((p) => CODIGO.test(p.valor)) || validos.some((p) => CLASSE.test(p.valor))) return;
    const chaves = validos.map((p) => p.chave);
    const donos = [...enums].filter(([, valores]) => chaves.every((c) => valores.includes(c))).map(([nome]) => nome);
    if (!donos.length) return;
    // Nome da constante só quando o literal É o valor dela (parênteses, as/satisfies, Object.freeze);
    // literal dentro de JSX ou de expressão maior é "inline".
    let no: ts.Node = n.parent;
    while (no && (ts.isParenthesizedExpression(no) || ts.isAsExpression(no) || ts.isSatisfiesExpression(no)
      || (ts.isCallExpression(no) && no.expression.getText(sf) === "Object.freeze"))) no = no.parent;
    const nome = no && ts.isVariableDeclaration(no) && ts.isIdentifier(no.name) ? no.name.text : `(literal na linha ${linhaDe(sf, n)})`;
    mapas.push({ nome, enums: donos, linha: linhaDe(sf, n) });
  });
  return mapas;
}

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
];

describe("(iii) mapas novos de labels.ts", () => {
  for (const [nome, mapa, valores] of MAPAS_NOVOS) {
    it(`${nome}: chaves = valores do enum; rótulo em texto de gente; congelado`, () => {
      expect(Object.keys(mapa).sort(), nome).toEqual([...valores].sort());
      for (const [valor, rotulo] of Object.entries(mapa)) {
        expect(rotulo.trim(), `${nome}.${valor}`).not.toBe("");
        expect(rotulo, `${nome}.${valor} repete o código`).not.toBe(valor);
        expect(rotulo, `${nome}.${valor} em CAIXA_ALTA`).not.toMatch(/^[A-Z0-9_ ]+$/);
        expect(rotulo, `${nome}.${valor} com "_"`).not.toContain("_");
        expect(rotulo, `${nome}.${valor} sem maiúscula inicial (sentence case)`).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/);
      }
      expect(Object.isFrozen(mapa), `${nome} congelado`).toBe(true);
    });
  }

  it("todo mapa *_LABEL novo de labels.ts está nesta lista (mapa novo sem trava não passa)", () => {
    const ANTIGOS = new Set(["ETAPA_LABEL", "TEMPERATURA_LABEL", "SEGMENTO_LABEL", "MOTIVO_PERDA_LABEL", "STATUS_MATRICULA_LABEL", "STATUS_COBRANCA_LABEL",
      "STATUS_COMISSAO_LABEL", "STATUS_ALUNO_LABEL", "TIPO_COBRANCA_LABEL", "FORMA_PAGAMENTO_LABEL", "GENERO_LABEL", "ESCOLARIDADE_LABEL",
      "SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL", "STATUS_ENCONTRO_LABEL"]);
    const exportados = Object.keys(L).filter((k) => k.endsWith("_LABEL") && !ANTIGOS.has(k));
    expect(exportados.filter((k) => !MAPAS_NOVOS.some(([nome]) => nome === k))).toEqual([]);
  });

  it("rotular devolve o rótulo e, para valor sem rótulo, o próprio valor (nunca frase inventada)", () => {
    expect(L.rotular(L.HABILIDADE_LABEL, "COMPREENSAO_ORAL")).toBe("Compreensão oral");
    expect(L.rotular(L.STATUS_RESERVA_VAGA_LABEL, "VALOR_ANTIGO")).toBe("VALOR_ANTIGO");
  });

  it("autoteste: o leitor de enums do schema separa nome e valores, ignorando comentários", () => {
    const enums = enumsDoSchema("enum StatusX {\n  ATIVA // comentário\n  PAUSADA\n}\n\nmodel M {\n  id String\n}\nenum Outro {\n  A_B\n}\n");
    expect([...enums]).toEqual([["StatusX", ["ATIVA", "PAUSADA"]], ["Outro", ["A_B"]]]);
    expect(ENUMS.get("StatusEncontroAgenda")).toEqual(Object.values(StatusEncontroAgenda));
  });
});
