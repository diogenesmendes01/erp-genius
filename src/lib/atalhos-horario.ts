import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { instanteDoCampoLocal } from "@/server/operacao/fuso-entrada";
import { somarDiasDataCivil } from "@/server/crm/tarefas-regras";
export type IdAtalhoHorario = "hoje18" | "amanha9" | "amanha14" | "seg9";
export interface AtalhoHorario { id: IdAtalhoHorario; rotulo: string; valorLocal: string }
export function atalhosDeHorario(agora: Date, fuso: string): AtalhoHorario[] {
 if (!Number.isFinite(agora.getTime()) || !FusoInstitucionalSchema.safeParse(fuso).success) return [];
 const hoje = dataCivilInstitucional(agora, fuso);
 const amanha = somarDiasDataCivil(hoje, 1);
 const diaSemana = new Date(hoje + "T00:00:00Z").getUTCDay();
 const segunda = somarDiasDataCivil(hoje, (8 - diaSemana) % 7 || 7);
 const candidatos: AtalhoHorario[] = [
  { id: "hoje18", rotulo: "Hoje 18:00", valorLocal: hoje + "T18:00" },
  { id: "amanha9", rotulo: "Amanhã 09:00", valorLocal: amanha + "T09:00" },
  { id: "amanha14", rotulo: "Amanhã 14:00", valorLocal: amanha + "T14:00" },
  { id: "seg9", rotulo: "Segunda 09:00", valorLocal: segunda + "T09:00" },
 ];
 return candidatos.filter(a => { const r = instanteDoCampoLocal(a.valorLocal, fuso); return r.ok && (a.id !== "hoje18" || r.instante.getTime() > agora.getTime()); });
}
export function partesDoValorLocal(v: string): { dataCivil: string; hora: string } {
 const m = /^(\d{4}-\d{2}-\d{2})T([0-2]\d:[0-5]\d)$/.exec(v);
 if (!m || !instanteDoCampoLocal(v,"UTC").ok) throw new Error("Informe data e hora completas e válidas.");
 return { dataCivil: m[1], hora: m[2] };
}