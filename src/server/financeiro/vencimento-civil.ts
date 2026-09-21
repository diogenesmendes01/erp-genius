import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { instanteDaGrade } from "@/server/agenda/grade";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";

type OrigemConfirmada = "EMISSAO_ENTRADA" | "EMISSAO_CONTINUIDADE" | "FECHAMENTO_HORAS" | "M01_HISTORICO" | "ADITIVO_VENCIMENTO" | "ACERTO_TAXA_ADITIVO" | "RETOMADA_REPROGRAMADA";

export type ReferenciaVencimentoCivil =
  | {
      estado: "CONFIRMADO";
      dataCivil: string;
      fuso: string | null;
      origem: OrigemConfirmada;
    }
  | { estado: "A_CONFERIR"; motivo: string };

/** Relações da própria cobrança que preservam a memória de sua emissão. */
export const incluirFonteVencimentoCivil = {
  aplicacoesAcertoTaxaAditivo: { select: { id: true, aplicadaEm: true, versaoAnterior: true, vencimentoAnterior: true, vencimentoNovo: true } },
  itemEmissaoEntrada: { select: { emissao: { select: { memoria: true } } } },
  emissaoContinuidadeGerada: { select: { snapshot: true } },
  emissaoFechamentoHoras: { select: { memoria: true } },
} satisfies Prisma.CobrancaInclude;

type FonteCobranca = {
  id: string;
  vencimento: Date;
  versao: number;
  itemEmissaoEntrada?: { emissao: { memoria: unknown } } | null;
  emissaoContinuidadeGerada?: Array<{ snapshot: unknown }>;
  emissaoFechamentoHoras?: { memoria: unknown } | null;
  aplicacoesAditivoVencimento?: Array<{ id: string; aplicadaEm: Date; versaoCobrancaDepois: number; vencimentoAnterior: Date; vencimentoNovo: Date; fuso: string }>;
  aplicacoesAcertoTaxaAditivo?: Array<{ id: string; aplicadaEm: Date; versaoAnterior: number; vencimentoAnterior: Date; vencimentoNovo: Date }>;
  aplicacoesM01?: Array<{ id: string; aplicadaEm: Date; vencimento: Date }>;
  retomadasReprogramadas?: Array<{ id: string; aplicadaEm: Date; periodos: Array<{ cobrancaId: string; vencimentoAnterior: string; vencimento: string; versaoCobrancaDepois?: number | null }> }>;
};

const memoriaEntrada = z.object({
  fusoInstitucional: FusoInstitucionalSchema,
  cobrancas: z.array(z.object({ id: z.string().min(1), vencimento: DataCivilSchema }).passthrough()),
}).passthrough();

const snapshotContinuidade = z.object({
  fusoInstitucional: FusoInstitucionalSchema,
  plano: z.object({ vencimento: DataCivilSchema }).passthrough(),
}).passthrough();

const memoriaFechamento = z.object({
  periodo: z.object({ vencimento: DataCivilSchema, fuso: FusoInstitucionalSchema }).passthrough(),
}).passthrough();

const snapshotRetomada = z.object({
  matriculas: z.array(z.object({
    periodos: z.array(z.object({ cobrancaId: z.string().min(1), vencimentoAnterior: DataCivilSchema, vencimento: DataCivilSchema, versaoCobrancaAntes: z.number().int().positive().optional() }).passthrough()),
  }).passthrough()),
}).passthrough();

const entradaRetomada = z.object({
  matriculas: z.array(z.object({
    vencimentos: z.discriminatedUnion("opcao", [
      z.object({ opcao: z.literal("MANTER_VENCIMENTOS") }).passthrough(),
      z.object({ opcao: z.literal("REPROGRAMAR_PARCELAS"), datas: z.array(z.object({ cobrancaId: z.string().min(1), vencimento: DataCivilSchema }).passthrough()) }).passthrough(),
    ]),
  }).passthrough()),
}).passthrough();

export function periodosRetomadaReprogramada(snapshot: unknown, entrada: unknown) {
  const foto = snapshotRetomada.safeParse(snapshot);
  const comando = entradaRetomada.safeParse(entrada);
  if (!foto.success || !comando.success) return [];
  const reprogramados = new Map(comando.data.matriculas.flatMap((m) => m.vencimentos.opcao === "REPROGRAMAR_PARCELAS" ? m.vencimentos.datas.map((d) => [d.cobrancaId, d.vencimento] as const) : []));
  return foto.data.matriculas.flatMap((m) => m.periodos)
    .filter((p) => reprogramados.get(p.cobrancaId) === p.vencimento)
    .map((p) => p.versaoCobrancaAntes
      ? { cobrancaId: p.cobrancaId, vencimentoAnterior: p.vencimentoAnterior, vencimento: p.vencimento, versaoCobrancaDepois: p.versaoCobrancaAntes + 1 }
      : { cobrancaId: p.cobrancaId, vencimentoAnterior: p.vencimentoAnterior, vencimento: p.vencimento });
}

type ClienteConsultaVencimento = Prisma.TransactionClient | PrismaClient;

/**
 * Carrega as trilhas append-only que não estão navegáveis a partir de Cobranca.
 * O chamador inclui `incluirFonteVencimentoCivil` na consulta da cobrança e junta
 * o resultado deste mapa antes de chamar `referenciaVencimentoCivil`.
 */
export async function carregarTrilhasVencimentoCivil(cliente: ClienteConsultaVencimento, cobrancaIds: string[], matriculaIds: string[]) {
  const vazio = () => ({ m01PorCobranca: new Map<string, Array<{ id: string; aplicadaEm: Date; vencimento: Date }>>(), vencimentosPorCobranca: new Map<string, Array<{ id: string; aplicadaEm: Date; versaoCobrancaDepois: number; vencimentoAnterior: Date; vencimentoNovo: Date; fuso: string }>>(), retomadasReprogramadas: [] as Array<{ id: string; aplicadaEm: Date; periodos: Array<{ cobrancaId: string; vencimentoAnterior: string; vencimento: string; versaoCobrancaDepois: number | null }> }> });
  if (!cobrancaIds.length) return vazio();
  const [aplicacoesM01, aplicacoesVencimento, retomadas] = await Promise.all([
    cliente.aplicacaoEntradaFinanceiraHistoricaMigracao.findMany({ where: { cobrancaId: { in: cobrancaIds } }, select: { id: true, cobrancaId: true, propostaId: true, aplicadaEm: true } }),
    cliente.aplicacaoVencimentoAditivo.findMany({ where: { decisao: { proposta: { cobrancaId: { in: cobrancaIds } } } }, select: { id: true, aplicadaEm: true, versaoCobrancaDepois: true, vencimentoAnterior: true, vencimentoNovo: true, decisao: { select: { proposta: { select: { cobrancaId: true, fuso: true } } } } } }),
    cliente.propostaRetomadaMatriculas.findMany({ where: { status: "APLICADA", itens: { some: { matriculaId: { in: matriculaIds } } } }, select: { id: true, aplicadaEm: true, entrada: true, snapshot: true } }),
  ]);
  const propostasM01 = await cliente.propostaEntradaFinanceiraHistoricaMigracao.findMany({ where: { id: { in: aplicacoesM01.map((a) => a.propostaId) }, status: "APLICADA" }, select: { id: true, vencimento: true } });
  const m01PorProposta = new Map(propostasM01.map((p) => [p.id, p]));
  const m01PorCobranca = new Map<string, Array<{ id: string; aplicadaEm: Date; vencimento: Date }>>();
  for (const aplicacao of aplicacoesM01) {
    const proposta = m01PorProposta.get(aplicacao.propostaId);
    if (proposta) m01PorCobranca.set(aplicacao.cobrancaId, [...(m01PorCobranca.get(aplicacao.cobrancaId) ?? []), { id: aplicacao.id, aplicadaEm: aplicacao.aplicadaEm, vencimento: proposta.vencimento }]);
  }
  const vencimentosPorCobranca = new Map<string, Array<{ id: string; aplicadaEm: Date; versaoCobrancaDepois: number; vencimentoAnterior: Date; vencimentoNovo: Date; fuso: string }>>();
  for (const aplicacao of aplicacoesVencimento) {
    const cobrancaId = aplicacao.decisao.proposta.cobrancaId;
    vencimentosPorCobranca.set(cobrancaId, [...(vencimentosPorCobranca.get(cobrancaId) ?? []), { id: aplicacao.id, aplicadaEm: aplicacao.aplicadaEm, versaoCobrancaDepois: aplicacao.versaoCobrancaDepois, vencimentoAnterior: aplicacao.vencimentoAnterior, vencimentoNovo: aplicacao.vencimentoNovo, fuso: aplicacao.decisao.proposta.fuso }]);
  }
  return {
    m01PorCobranca,
    vencimentosPorCobranca,
    retomadasReprogramadas: retomadas.flatMap((r) => r.aplicadaEm ? [{ id: r.id, aplicadaEm: r.aplicadaEm, periodos: periodosRetomadaReprogramada(r.snapshot, r.entrada) }] : []),
  };
}

function confirmado(dataCivil: string, fuso: string, hora: "00:00" | "12:00", vencimento: Date, origem: OrigemConfirmada): ReferenciaVencimentoCivil {
  try {
    if (instanteDaGrade(dataCivil, hora, fuso).getTime() !== vencimento.getTime()) {
      return { estado: "A_CONFERIR", motivo: "O instante persistido diverge da memória de vencimento." };
    }
  } catch {
    return { estado: "A_CONFERIR", motivo: "A memória de vencimento possui data ou fuso inválido." };
  }
  return { estado: "CONFIRMADO", dataCivil, fuso, origem };
}

function dataDaColunaCivil(data: Date) {
  return data.toISOString().slice(0, 10);
}

type MudancaPosterior = {
  id: string;
  aplicadaEm: Date;
  versaoDepois: number | null;
  dataCivil: string | null;
  fuso: string | null;
  origem: OrigemConfirmada;
  correspondeAoAtual: boolean;
  erro?: string;
};

function escolherMudancaPosterior(fonte: FonteCobranca): ReferenciaVencimentoCivil | null {
  const versaoPosteriorInvalida = [
    ...(fonte.aplicacoesAditivoVencimento ?? []).map((a) => a.versaoCobrancaDepois),
    ...(fonte.aplicacoesAcertoTaxaAditivo ?? []).map((a) => a.versaoAnterior + 1),
    ...(fonte.retomadasReprogramadas ?? []).flatMap((r) => r.periodos
      .filter((p) => p.cobrancaId === fonte.id)
      .flatMap((p) => p.versaoCobrancaDepois === null || p.versaoCobrancaDepois === undefined ? [] : [p.versaoCobrancaDepois])),
  ].some((versao) => versao > fonte.versao);
  if (versaoPosteriorInvalida)
    return { estado: "A_CONFERIR", motivo: "A cadeia de aplicações possui versão posterior à cobrança atual." };

  const aditivos: MudancaPosterior[] = [];
  for (const aplicacao of fonte.aplicacoesAditivoVencimento ?? []) {
    if (aplicacao.vencimentoAnterior.getTime() === aplicacao.vencimentoNovo.getTime()) continue;
    try {
      aditivos.push({ id: aplicacao.id, aplicadaEm: aplicacao.aplicadaEm, versaoDepois: aplicacao.versaoCobrancaDepois, dataCivil: dataCivilInstitucional(aplicacao.vencimentoNovo, aplicacao.fuso), fuso: aplicacao.fuso, origem: "ADITIVO_VENCIMENTO", correspondeAoAtual: aplicacao.vencimentoNovo.getTime() === fonte.vencimento.getTime() });
    } catch {
      // A cadeia é append-only. Uma memória antiga inválida não pode ocultar a
      // aplicação de versão maior que efetivamente virou a cabeça da cobrança.
      aditivos.push({ id: aplicacao.id, aplicadaEm: aplicacao.aplicadaEm, versaoDepois: aplicacao.versaoCobrancaDepois, dataCivil: null, fuso: null, origem: "ADITIVO_VENCIMENTO", correspondeAoAtual: aplicacao.vencimentoNovo.getTime() === fonte.vencimento.getTime(), erro: "A aplicação de vencimento vigente não preserva um fuso IANA utilizável para a apresentação." });
    }
  }

  const mudancas: MudancaPosterior[] = [
    ...aditivos,
    ...(fonte.aplicacoesAcertoTaxaAditivo ?? []).flatMap((a) => dataDaColunaCivil(a.vencimentoAnterior) === dataDaColunaCivil(a.vencimentoNovo) ? [] : [{ id: a.id, aplicadaEm: a.aplicadaEm, versaoDepois: a.versaoAnterior + 1, dataCivil: dataDaColunaCivil(a.vencimentoNovo), fuso: null, origem: "ACERTO_TAXA_ADITIVO" as const, correspondeAoAtual: dataDaColunaCivil(a.vencimentoNovo) === dataDaColunaCivil(fonte.vencimento) }]),
    // REPROGRAMAR é uma decisão material mesmo quando conserva a mesma data
    // civil: a execução pode normalizar o instante persistido. Ignorá-la faria
    // a referência histórica cair indevidamente em A_CONFERIR.
    ...(fonte.retomadasReprogramadas ?? []).flatMap((r) => r.periodos.filter((p) => p.cobrancaId === fonte.id).map((p) => ({ id: r.id, aplicadaEm: r.aplicadaEm, versaoDepois: p.versaoCobrancaDepois ?? null, dataCivil: p.vencimento, fuso: null, origem: "RETOMADA_REPROGRAMADA" as const, correspondeAoAtual: p.vencimento === dataDaColunaCivil(fonte.vencimento) }))),
  ].filter((m) => m.versaoDepois === null || m.versaoDepois <= fonte.versao);

  const versionadas = mudancas.filter((m) => m.versaoDepois !== null);
  const semVersao = mudancas.filter((m) => m.versaoDepois === null);
  // A versão da cobrança é a ordem material das aplicações que a alteram. Datas
  // de aplicação podem empatar ou refletir a espera de locks, portanto não são a
  // precedência entre duas aplicações versionadas.
  if (versionadas.length && semVersao.length)
    return { estado: "A_CONFERIR", motivo: "A cadeia mistura alteração de vencimento versionada e retomada sem ordem versionada verificável." };
  const ordenadas = versionadas.length
    ? [...versionadas].sort((a, b) => b.versaoDepois! - a.versaoDepois! || b.id.localeCompare(a.id))
    : [...semVersao].sort((a, b) => b.aplicadaEm.getTime() - a.aplicadaEm.getTime() || b.id.localeCompare(a.id));
  const ultima = ordenadas[0];
  if (!ultima) return null;
  const empatadas = versionadas.length
    ? ordenadas.filter((m) => m.versaoDepois === ultima.versaoDepois)
    : ordenadas.filter((m) => m.aplicadaEm.getTime() === ultima.aplicadaEm.getTime());
  if (empatadas.length > 1 && new Set(empatadas.map((m) => `${m.origem}:${m.dataCivil ?? ""}:${m.fuso ?? ""}:${m.erro ?? ""}`)).size > 1)
    return { estado: "A_CONFERIR", motivo: "Aplicações de vencimento empatadas não permitem identificar a origem vigente." };
  if (ultima.erro) return { estado: "A_CONFERIR", motivo: ultima.erro };
  if (!ultima.correspondeAoAtual)
    return { estado: "A_CONFERIR", motivo: "O vencimento atual diverge da última aplicação financeira registrada." };
  return { estado: "CONFIRMADO", dataCivil: ultima.dataCivil!, fuso: ultima.fuso, origem: ultima.origem };
}

/**
 * A data de vencimento é civil e sua interpretação pertence à emissão que criou
 * a cobrança. Não use o fuso atual, nem o navegador, para reconstruir legado.
 */
export function referenciaVencimentoCivil(fonte: FonteCobranca): ReferenciaVencimentoCivil {
  const posterior = escolherMudancaPosterior(fonte);
  if (posterior) return posterior;

  const m01 = fonte.aplicacoesM01 ?? [];
  if (m01.length === 1 && dataDaColunaCivil(m01[0].vencimento) === dataDaColunaCivil(fonte.vencimento))
    return { estado: "CONFIRMADO", dataCivil: dataDaColunaCivil(m01[0].vencimento), fuso: null, origem: "M01_HISTORICO" };
  if (m01.length > 1) return { estado: "A_CONFERIR", motivo: "A cobrança possui mais de uma origem M01 aplicada." };
  if (m01.length === 1) return { estado: "A_CONFERIR", motivo: "O vencimento atual diverge da obrigação histórica M01." };

  const continuidade = fonte.emissaoContinuidadeGerada ?? [];
  const origens = [fonte.itemEmissaoEntrada, ...continuidade, fonte.emissaoFechamentoHoras].filter(Boolean);
  if (origens.length !== 1) {
    return { estado: "A_CONFERIR", motivo: origens.length ? "A cobrança possui origens de emissão conflitantes." : "A origem da cobrança não preserva fuso e data civil." };
  }

  if (fonte.itemEmissaoEntrada) {
    const memoria = memoriaEntrada.safeParse(fonte.itemEmissaoEntrada.emissao.memoria);
    const item = memoria.success && memoria.data.cobrancas.find((c) => c.id === fonte.id);
    if (!memoria.success || !item) return { estado: "A_CONFERIR", motivo: "A memória da emissão inicial não identifica o vencimento desta cobrança." };
    return confirmado(item.vencimento, memoria.data.fusoInstitucional, "12:00", fonte.vencimento, "EMISSAO_ENTRADA");
  }

  if (continuidade.length === 1) {
    const snapshot = snapshotContinuidade.safeParse(continuidade[0].snapshot);
    if (!snapshot.success) return { estado: "A_CONFERIR", motivo: "A memória da continuidade não preserva o vencimento civil." };
    return confirmado(snapshot.data.plano.vencimento, snapshot.data.fusoInstitucional, "00:00", fonte.vencimento, "EMISSAO_CONTINUIDADE");
  }

  const memoria = memoriaFechamento.safeParse(fonte.emissaoFechamentoHoras?.memoria);
  if (!memoria.success) return { estado: "A_CONFERIR", motivo: "A memória do fechamento não preserva o vencimento civil." };
  return confirmado(memoria.data.periodo.vencimento, memoria.data.periodo.fuso, "12:00", fonte.vencimento, "FECHAMENTO_HORAS");
}
