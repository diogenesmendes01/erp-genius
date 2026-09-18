import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared/sessao";
import { dinheiro, saldoAtual } from "@/server/financeiro/regras";
import { dataRetomada, type ParcelaRetomada, type SolicitarRetomadaInput } from "./schema";

type Monetario = Prisma.Decimal | string | number;
export interface CobrancaRetomadaFonte {
  id: string; codigo: string | null; matriculaId: string; versao: number; cicloRegua: number; tipo: string; status: string;
  valorLiquidadoCredito?: Monetario;
  valorCompensadoPermuta?: Monetario;
  valorOriginal: Monetario; valorNegociado: Monetario; valorRecebido: Monetario | null; saldo: Monetario | null;
  moeda: string; vencimento: Date; competencia: string | null; pagoEm: Date | null; canceladaPorPausaId: string | null;
}
export interface MatriculaRetomadaFonte {
  id: string; codigo: string | null; leadId: string | null; status: string; moeda: string;
  mesesPlano: number; diaVencimento: number; cobrancas: CobrancaRetomadaFonte[];
}

const CobrancaSnapshotSchema = z.object({
  id: z.string(), codigo: z.string().nullable(), matriculaId: z.string(), versao: z.number().int(), cicloRegua: z.number().int().nonnegative(), tipo: z.string(), status: z.string(),
  valorLiquidadoCredito: z.string().optional(),
  valorCompensadoPermuta: z.string().optional(),
  valorOriginal: z.string(), valorNegociado: z.string(), valorRecebido: z.string().nullable(), saldo: z.string().nullable(),
  moeda: z.string(), vencimento: z.string().datetime(), competencia: z.string().nullable(), pagoEm: z.string().datetime().nullable(), canceladaPorPausaId: z.string().nullable(),
});
export const SnapshotRetomadaSchema = z.object({
  versaoFormato: z.literal(1), alunoId: z.string(), pausaId: z.string(),
  matriculas: z.array(z.object({
    id: z.string(), codigo: z.string().nullable(), leadId: z.string().nullable(), status: z.string(), moeda: z.string(),
    mesesPlano: z.number().int(), diaVencimento: z.number().int(), cobrancas: z.array(CobrancaSnapshotSchema),
  })),
  alvos: z.array(z.object({ cobrancaId: z.string(), novoVencimento: z.string().datetime() })),
});
export type SnapshotRetomada = z.infer<typeof SnapshotRetomadaSchema>;

export function estadoFinanceiroRetomada(matriculas: MatriculaRetomadaFonte[]): SnapshotRetomada["matriculas"] {
  return [...matriculas].sort((a, b) => a.id.localeCompare(b.id)).map((m) => ({
    id: m.id, codigo: m.codigo, leadId: m.leadId, status: m.status, moeda: m.moeda,
    mesesPlano: m.mesesPlano, diaVencimento: m.diaVencimento,
    cobrancas: [...m.cobrancas].sort((a, b) => a.id.localeCompare(b.id)).map((c) => ({
      id: c.id, codigo: c.codigo, matriculaId: c.matriculaId, versao: c.versao, cicloRegua: c.cicloRegua, tipo: c.tipo, status: c.status,
      ...(dinheiro(c.valorLiquidadoCredito ?? 0).gt(0) ? { valorLiquidadoCredito: dinheiro(c.valorLiquidadoCredito ?? 0).toFixed(2) } : {}),
      ...(dinheiro(c.valorCompensadoPermuta ?? 0).gt(0) ? { valorCompensadoPermuta: dinheiro(c.valorCompensadoPermuta ?? 0).toFixed(2) } : {}),
      valorOriginal: dinheiro(c.valorOriginal).toFixed(2), valorNegociado: dinheiro(c.valorNegociado).toFixed(2),
      valorRecebido: c.valorRecebido === null ? null : dinheiro(c.valorRecebido).toFixed(2),
      saldo: c.saldo === null ? null : dinheiro(c.saldo).toFixed(2), moeda: c.moeda,
      vencimento: c.vencimento.toISOString(), competencia: c.competencia, pagoEm: c.pagoEm?.toISOString() ?? null,
      canceladaPorPausaId: c.canceladaPorPausaId,
    })),
  }));
}

export function parcelasElegiveisRetomada(matriculas: MatriculaRetomadaFonte[], pausaId: string): ParcelaRetomada[] {
  return matriculas.filter((m) => m.status === "ATIVA").flatMap((m) => m.cobrancas
    .filter((c) => c.tipo === "MENSALIDADE" &&
      (c.status === "PENDENTE" || c.status === "ATRASADO" || (c.status === "CANCELADA" && c.canceladaPorPausaId === pausaId)) &&
      saldoAtual(c.valorNegociado, c.valorRecebido, c.valorLiquidadoCredito ?? 0, 0, c.valorCompensadoPermuta ?? 0).gt(0))
    .map((c) => ({
      cobrancaId: c.id, codigo: c.codigo, matriculaId: m.id, matriculaCodigo: m.codigo, moeda: c.moeda,
      status: c.status, valorNegociado: dinheiro(c.valorNegociado).toNumber(), valorRecebido: dinheiro(c.valorRecebido ?? 0).toNumber(),
      saldo: saldoAtual(c.valorNegociado, c.valorRecebido, c.valorLiquidadoCredito ?? 0, 0, c.valorCompensadoPermuta ?? 0).toNumber(), vencimento: c.vencimento.toISOString(),
      competencia: c.competencia, restaurar: c.status === "CANCELADA",
    }))).sort((a, b) => a.vencimento.localeCompare(b.vencimento) || (a.competencia ?? "").localeCompare(b.competencia ?? "") || a.cobrancaId.localeCompare(b.cobrancaId));
}

export function impedimentoRetomada(status: string, pausaId: string | null, pausaRastreada: boolean, matriculas: MatriculaRetomadaFonte[]): string | null {
  if (status !== "PAUSADO") return "Somente aluno pausado pode receber proposta de retomada.";
  if (!pausaId) return "Não há registro da pausa atual. Solicite conferência da secretaria e do Financeiro.";
  const ativas = matriculas.filter((m) => m.status === "ATIVA");
  if (ativas.length === 0) return "Não há matrícula ativa para retomar. Solicite conferência da secretaria.";
  if (!pausaRastreada && ativas.some((m) => m.cobrancas.some((c) => c.tipo === "MENSALIDADE" && c.status === "CANCELADA" && !c.canceladaPorPausaId))) {
    return "A pausa legada possui mensalidades canceladas sem origem identificada. Concilie o calendário com o Financeiro antes de propor a retomada.";
  }
  // Um saldo armazenado divergente não pode ser normalizado silenciosamente pela retomada.
  if (ativas.some((m) => m.cobrancas.some((c) => c.tipo === "MENSALIDADE" && c.status !== "PAGO" &&
    (c.status !== "CANCELADA" || c.canceladaPorPausaId === pausaId) && c.saldo !== null &&
    !dinheiro(c.saldo).equals(saldoAtual(c.valorNegociado, c.valorRecebido, c.valorLiquidadoCredito ?? 0, 0, c.valorCompensadoPermuta ?? 0))))) {
    return "Há saldo divergente nas mensalidades. Solicite conciliação financeira antes da retomada.";
  }
  return null;
}

export function dataMinimaReprogramacao(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

export function validarDatasNaoRetroativas(alvos: SnapshotRetomada["alvos"], agora: Date) {
  const hoje = dataRetomada(dataMinimaReprogramacao(agora))!;
  hoje.setHours(0, 0, 0, 0);
  if (alvos.some((alvo) => new Date(alvo.novoVencimento) < hoje)) {
    throw new ErroRegra("A reprogramação não pode usar datas passadas. Envie uma proposta com novas datas.");
  }
}

export function montarSnapshotRetomada(alunoId: string, pausaId: string, matriculas: MatriculaRetomadaFonte[], input: SolicitarRetomadaInput, agora = new Date()): SnapshotRetomada {
  const elegiveis = parcelasElegiveisRetomada(matriculas, pausaId);
  const datas = input.novosVencimentos ?? [];
  let alvos: SnapshotRetomada["alvos"];
  if (input.opcao === "MANTER_VENCIMENTOS") {
    if (datas.length > 0) throw new ErroRegra("Manter vencimentos não permite informar novas datas.");
    alvos = elegiveis.map((p) => ({ cobrancaId: p.cobrancaId, novoVencimento: p.vencimento }));
  } else {
    const porId = new Map(datas.map((p) => [p.cobrancaId, p.vencimento]));
    if (porId.size !== datas.length || porId.size !== elegiveis.length || elegiveis.some((p) => !porId.has(p.cobrancaId))) {
      throw new ErroRegra("Informe uma única data para cada mensalidade remanescente, sem incluir outras cobranças.");
    }
    alvos = elegiveis.map((p) => {
      const vencimento = dataRetomada(porId.get(p.cobrancaId)!);
      if (!vencimento) throw new ErroRegra("Informe uma data real no formato AAAA-MM-DD.");
      return { cobrancaId: p.cobrancaId, novoVencimento: vencimento.toISOString() };
    });
    validarDatasNaoRetroativas(alvos, agora);
  }
  return { versaoFormato: 1, alunoId, pausaId, matriculas: estadoFinanceiroRetomada(matriculas), alvos: alvos.sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId)) };
}

export function exigirSnapshotRetomadaAtual(snapshot: SnapshotRetomada, alunoId: string, pausaId: string, matriculas: MatriculaRetomadaFonte[]) {
  if (snapshot.alunoId !== alunoId || snapshot.pausaId !== pausaId || JSON.stringify(snapshot.matriculas) !== JSON.stringify(estadoFinanceiroRetomada(matriculas))) {
    throw new ErroRegra("O calendário, a pausa ou a situação financeira mudou desde a proposta. Rejeite-a e solicite uma nova retomada.");
  }
  const ids = parcelasElegiveisRetomada(matriculas, pausaId).map((p) => p.cobrancaId).sort();
  if (JSON.stringify(ids) !== JSON.stringify(snapshot.alvos.map((p) => p.cobrancaId).sort())) {
    throw new ErroRegra("As parcelas da proposta não correspondem ao calendário atual. Rejeite-a e solicite uma nova retomada.");
  }
}
