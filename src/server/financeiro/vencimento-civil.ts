import { z } from "zod";
import { instanteDaGrade } from "@/server/agenda/grade";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";

export type ReferenciaVencimentoCivil =
  | {
      estado: "CONFIRMADO";
      dataCivil: string;
      fuso: string;
      origem: "EMISSAO_ENTRADA" | "EMISSAO_CONTINUIDADE" | "FECHAMENTO_HORAS";
    }
  | { estado: "A_CONFERIR"; motivo: string };

type FonteCobranca = {
  id: string;
  vencimento: Date;
  itemEmissaoEntrada?: { emissao: { memoria: unknown } } | null;
  emissaoContinuidadeGerada?: Array<{ snapshot: unknown }>;
  emissaoFechamentoHoras?: { memoria: unknown } | null;
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

function confirmado(dataCivil: string, fuso: string, hora: "00:00" | "12:00", vencimento: Date, origem: Extract<ReferenciaVencimentoCivil, { estado: "CONFIRMADO" }> ["origem"]): ReferenciaVencimentoCivil {
  try {
    if (instanteDaGrade(dataCivil, hora, fuso).getTime() !== vencimento.getTime()) {
      return { estado: "A_CONFERIR", motivo: "O instante persistido diverge da memória de vencimento." };
    }
  } catch {
    return { estado: "A_CONFERIR", motivo: "A memória de vencimento possui data ou fuso inválido." };
  }
  return { estado: "CONFIRMADO", dataCivil, fuso, origem };
}

/**
 * A data de vencimento é civil e sua interpretação pertence à emissão que criou
 * a cobrança. Não use o fuso atual, nem o navegador, para reconstruir legado.
 */
export function referenciaVencimentoCivil(fonte: FonteCobranca): ReferenciaVencimentoCivil {
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
