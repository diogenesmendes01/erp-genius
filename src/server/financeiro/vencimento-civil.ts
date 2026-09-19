import { z } from "zod";
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
  retomadasReprogramadas?: Array<{ id: string; aplicadaEm: Date; periodos: Array<{ cobrancaId: string; vencimentoAnterior: string; vencimento: string }> }>;
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
    periodos: z.array(z.object({ cobrancaId: z.string().min(1), vencimentoAnterior: DataCivilSchema, vencimento: DataCivilSchema }).passthrough()),
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
  return foto.data.matriculas.flatMap((m) => m.periodos).filter((p) => reprogramados.get(p.cobrancaId) === p.vencimento);
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

type MudancaPosterior = { id: string; aplicadaEm: Date; versaoDepois: number | null; dataCivil: string; fuso: string | null; origem: OrigemConfirmada; correspondeAoAtual: boolean };

function escolherMudancaPosterior(fonte: FonteCobranca): ReferenciaVencimentoCivil | null {
  const versaoPosteriorInvalida = [
    ...(fonte.aplicacoesAditivoVencimento ?? []).map((a) => a.versaoCobrancaDepois),
    ...(fonte.aplicacoesAcertoTaxaAditivo ?? []).map((a) => a.versaoAnterior + 1),
  ].some((versao) => versao > fonte.versao);
  if (versaoPosteriorInvalida)
    return { estado: "A_CONFERIR", motivo: "A cadeia de aplicações possui versão posterior à cobrança atual." };

  const aditivos: MudancaPosterior[] = [];
  for (const aplicacao of fonte.aplicacoesAditivoVencimento ?? []) {
    if (aplicacao.vencimentoAnterior.getTime() === aplicacao.vencimentoNovo.getTime()) continue;
    try {
      aditivos.push({ id: aplicacao.id, aplicadaEm: aplicacao.aplicadaEm, versaoDepois: aplicacao.versaoCobrancaDepois, dataCivil: dataCivilInstitucional(aplicacao.vencimentoNovo, aplicacao.fuso), fuso: aplicacao.fuso, origem: "ADITIVO_VENCIMENTO", correspondeAoAtual: aplicacao.vencimentoNovo.getTime() === fonte.vencimento.getTime() });
    } catch {
      return { estado: "A_CONFERIR", motivo: "A aplicação de vencimento não preserva um fuso IANA utilizável para a apresentação." };
    }
  }

  const mudancas: MudancaPosterior[] = [
    ...aditivos,
    ...(fonte.aplicacoesAcertoTaxaAditivo ?? []).flatMap((a) => dataDaColunaCivil(a.vencimentoAnterior) === dataDaColunaCivil(a.vencimentoNovo) ? [] : [{ id: a.id, aplicadaEm: a.aplicadaEm, versaoDepois: a.versaoAnterior + 1, dataCivil: dataDaColunaCivil(a.vencimentoNovo), fuso: null, origem: "ACERTO_TAXA_ADITIVO" as const, correspondeAoAtual: dataDaColunaCivil(a.vencimentoNovo) === dataDaColunaCivil(fonte.vencimento) }]),
    ...(fonte.retomadasReprogramadas ?? []).flatMap((r) => r.periodos.filter((p) => p.cobrancaId === fonte.id && p.vencimentoAnterior !== p.vencimento).map((p) => ({ id: r.id, aplicadaEm: r.aplicadaEm, versaoDepois: null, dataCivil: p.vencimento, fuso: null, origem: "RETOMADA_REPROGRAMADA" as const, correspondeAoAtual: p.vencimento === dataDaColunaCivil(fonte.vencimento) }))),
  ].filter((m) => m.versaoDepois === null || m.versaoDepois <= fonte.versao)
    .sort((a, b) => b.aplicadaEm.getTime() - a.aplicadaEm.getTime() || b.id.localeCompare(a.id));

  const ultima = mudancas[0];
  if (!ultima) return null;
  const empatadas = mudancas.filter((m) => m.aplicadaEm.getTime() === ultima.aplicadaEm.getTime());
  if (empatadas.length > 1 && new Set(empatadas.map((m) => `${m.origem}:${m.dataCivil}:${m.fuso ?? ""}`)).size > 1)
    return { estado: "A_CONFERIR", motivo: "Aplicações de vencimento empatadas não permitem identificar a origem vigente." };
  if (!ultima.correspondeAoAtual)
    return { estado: "A_CONFERIR", motivo: "O vencimento atual diverge da última aplicação financeira registrada." };
  return { estado: "CONFIRMADO", dataCivil: ultima.dataCivil, fuso: ultima.fuso, origem: ultima.origem };
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
