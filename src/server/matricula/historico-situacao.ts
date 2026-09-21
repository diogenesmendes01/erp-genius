import { z } from "zod";
import { instanteDaGrade } from "@/server/agenda/grade";
import { DataCivilSchema } from "./cobertura";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";

const pausa = z.object({ dataEfetiva: DataCivilSchema, fusoInstitucional: FusoInstitucionalSchema });
const retomada = z.object({ retorno: DataCivilSchema, fusoInstitucional: FusoInstitucionalSchema });
type PropostaAplicada = { aplicadaEm: Date | null; snapshot: unknown };
export type HistoricoSituacaoMatricula = {
  status: string; ativadaEm: Date | null;
  encerramento?: { statusAnterior: string; limiteVinculo: Date } | null;
  pausas: PropostaAplicada[]; retomadas: PropostaAplicada[];
  fatosMigracao?: readonly { tipo: string; efetivoEm: Date; ordem: number }[];
};

/** Q53: reconstrução apenas com evidência temporal suficiente; nunca usa outro contrato.
 * Encerramento sem registro temporal e legado sem ativação exigem conferência própria.
 */
export function situacaoMatriculaNaAula(h: HistoricoSituacaoMatricula, instante: Date): "ATIVA" | "PAUSADA" | "ENCERRADA" | "CANCELADA" | "NAO_ATIVADA" | "A_CONFERIR" {
  if (h.fatosMigracao?.length) return situacaoHistoricaMigrada(h, instante);
  if (!Number.isFinite(instante.getTime()) || !h.ativadaEm || !Number.isFinite(h.ativadaEm.getTime())) return "A_CONFERIR";
  if (instante < h.ativadaEm) return "NAO_ATIVADA";
  let statusConferido = h.status;
  if (h.encerramento) {
    if (h.status !== "ENCERRADA" || !["ATIVA", "PAUSADA"].includes(h.encerramento.statusAnterior) || !Number.isFinite(h.encerramento.limiteVinculo.getTime()) || h.encerramento.limiteVinculo < h.ativadaEm) return "A_CONFERIR";
    if (instante >= h.encerramento.limiteVinculo) return "ENCERRADA";
    statusConferido = h.encerramento.statusAnterior;
  }
  if (statusConferido !== "ATIVA" && statusConferido !== "PAUSADA") return "A_CONFERIR";
  const movimentos: { data: string; fuso: string; estado: "ATIVA" | "PAUSADA"; aplicado: number }[] = [];
  for (const p of h.pausas) {
    const s = pausa.safeParse(p.snapshot);
    if (!s.success || !p.aplicadaEm || !Number.isFinite(p.aplicadaEm.getTime())) return "A_CONFERIR";
    movimentos.push({ data: s.data.dataEfetiva, fuso: s.data.fusoInstitucional, estado: "PAUSADA", aplicado: p.aplicadaEm.getTime() });
  }
  for (const p of h.retomadas) {
    const s = retomada.safeParse(p.snapshot);
    if (!s.success || !p.aplicadaEm || !Number.isFinite(p.aplicadaEm.getTime())) return "A_CONFERIR";
    movimentos.push({ data: s.data.retorno, fuso: s.data.fusoInstitucional, estado: "ATIVA", aplicado: p.aplicadaEm.getTime() });
  }
  if (new Set(movimentos.map((m) => m.fuso)).size > 1) return "A_CONFERIR";
  movimentos.sort((a, b) => a.data.localeCompare(b.data) || a.aplicado - b.aplicado);
  let atual: "ATIVA" | "PAUSADA" = "ATIVA", naAula: "ATIVA" | "PAUSADA" = "ATIVA";
  for (let i = 0; i < movimentos.length; i++) {
    const m = movimentos[i];
    if (m.estado === atual || (i > 0 && m.data === movimentos[i - 1].data && m.aplicado === movimentos[i - 1].aplicado)) return "A_CONFERIR";
    if (m.data < dataCivilInstitucional(h.ativadaEm, m.fuso)) return "A_CONFERIR";
    atual = m.estado;
    if (m.data <= dataCivilInstitucional(instante, m.fuso)) naAula = m.estado;
  }
  return atual === statusConferido ? naAula : "A_CONFERIR";
}


type EstadoMigrado = "ATIVA" | "PAUSADA" | "ENCERRADA" | "CANCELADA";
/** Fatos importados são evidências próprias; não simulam o aceite ou a ativação comercial. */
function situacaoHistoricaMigrada(h: HistoricoSituacaoMatricula, instante: Date): EstadoMigrado | "NAO_ATIVADA" | "A_CONFERIR" {
  if (!Number.isFinite(instante.getTime())) return "A_CONFERIR";
  const fatos = [...h.fatosMigracao!].sort((a, b) => a.ordem - b.ordem);
  const movimentos: { em: number; estado: EstadoMigrado; aplicado: number; anterior?: string }[] = [];
  const estados: Record<string, EstadoMigrado> = { ATIVACAO: "ATIVA", PAUSA: "PAUSADA", ENCERRAMENTO: "ENCERRADA", CANCELAMENTO: "CANCELADA" };
  for (const [i, f] of fatos.entries()) {
    const em = f.efetivoEm.getTime(), estado = estados[f.tipo];
    if (f.ordem !== i + 1 || !estado || !Number.isFinite(em) || (i === 0 && f.tipo !== "ATIVACAO") || (i > 0 && em <= movimentos[i - 1].em)) return "A_CONFERIR";
    movimentos.push({ em, estado, aplicado: 0 });
  }
  const inicio = movimentos[0].em, ultimoImportado = movimentos.at(-1)!.em;
  if (h.ativadaEm && h.ativadaEm.getTime() !== inicio) return "A_CONFERIR";
  for (const [propostas, schema, estado] of [[h.pausas, pausa, "PAUSADA"], [h.retomadas, retomada, "ATIVA"]] as const) {
    for (const p of propostas) {
      const parsed = schema.safeParse(p.snapshot);
      if (!parsed.success || !p.aplicadaEm || !Number.isFinite(p.aplicadaEm.getTime())) return "A_CONFERIR";
      const s = parsed.data;
      const civil = "dataEfetiva" in s ? s.dataEfetiva : s.retorno;
      // PostgreSQL date não representa ano zero: não produzir estado divergente do banco.
      if (civil.startsWith("0000-")) return "A_CONFERIR";
      let em: number;
      try { em = instanteDaGrade(civil, "00:00", s.fusoInstitucional).getTime(); } catch { return "A_CONFERIR"; }
      if (em <= ultimoImportado) return "A_CONFERIR";
      movimentos.push({ em, estado, aplicado: p.aplicadaEm.getTime() });
    }
  }
  if (h.encerramento) {
    const em = h.encerramento.limiteVinculo.getTime();
    if (!Number.isFinite(em) || em <= ultimoImportado || h.status !== "ENCERRADA") return "A_CONFERIR";
    movimentos.push({ em, estado: "ENCERRADA", aplicado: Number.MAX_SAFE_INTEGER, anterior: h.encerramento.statusAnterior });
  }
  movimentos.sort((a, b) => a.em - b.em || a.aplicado - b.aplicado);
  let atual: EstadoMigrado | null = null;
  let naAula: EstadoMigrado | "NAO_ATIVADA" = "NAO_ATIVADA";
  for (let i = 0; i < movimentos.length; i++) {
    const m = movimentos[i];
    if (atual === "ENCERRADA" || atual === "CANCELADA" || atual === m.estado || (m.anterior && m.anterior !== atual)
      || (i > 0 && m.em === movimentos[i - 1].em && m.aplicado === movimentos[i - 1].aplicado)) return "A_CONFERIR";
    atual = m.estado;
    if (m.em <= instante.getTime()) naAula = atual;
  }
  return atual === h.status ? naAula : "A_CONFERIR";
}