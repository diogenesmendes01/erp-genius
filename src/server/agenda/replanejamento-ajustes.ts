import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { instanteDaGrade } from "./grade";
import { conferirDiasNaoLetivos } from "./calendario-intervalo";
import type { proporReplanejamentoGrade } from "./replanejamento-grade";

export const AjustesReplanejamentoSchema = z.array(z.object({
  encontroId: z.string().min(1), data: DataCivilSchema,
  horario: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), motivo: z.string().trim().min(5).max(2000),
}).strict()).max(10000).refine((a) => new Set(a.map((v) => v.encontroId)).size === a.length, "Encontro repetido nos ajustes.");
export type AjusteReplanejamento = z.infer<typeof AjustesReplanejamentoSchema>[number];

export function ajustarPrevisaoReplanejamento(input: {
  previsao: ReturnType<typeof proporReplanejamentoGrade>; ajustes: AjusteReplanejamento[];
  agora: Date; fusoOrigem: string; fusoEscola: string;
  periodos: { id: string; inicio: string; fim: string }[];
}) {
  const ajustes = AjustesReplanejamentoSchema.parse(input.ajustes);
  if (!Number.isFinite(input.agora.getTime())) throw new Error("Instante de conferência inválido.");
  if (ajustes.some((a) => !input.previsao.propostas.some((p) => p.encontroId === a.encontroId))) throw new Error("Ajuste fora dos encontros futuros desta revisão.");
  const propostas = input.previsao.propostas.map((p) => {
    const ajuste = ajustes.find((a) => a.encontroId === p.encontroId);
    if (!ajuste) return { ...p, motivoAjuste: null as string | null, periodosNaoLetivos: [] as string[] };
    const inicio = instanteDaGrade(ajuste.data, ajuste.horario, input.fusoOrigem);
    if (inicio <= input.agora) throw new Error("A data ajustada deve ser futura.");
    const duracao = Date.parse(p.fimAnterior) - Date.parse(p.inicioAnterior);
    if (!Number.isFinite(duracao) || duracao <= 0) throw new Error("Duração original inválida; exige conferência.");
    const fim = new Date(inicio.getTime() + duracao);
    const inicioProposto = inicio.toISOString(), fimProposto = fim.toISOString();
    const { periodosAfetados } = conferirDiasNaoLetivos({ inicio: inicioProposto, fim: fimProposto, fusoEscola: input.fusoEscola, periodos: input.periodos });
    return { ...p, inicioProposto, fimProposto, alterado: inicioProposto !== p.inicioAnterior || fimProposto !== p.fimAnterior,
      motivoAjuste: ajuste.motivo, periodosNaoLetivos: periodosAfetados };
  });
  const fins = propostas.map((p) => p.fimProposto);
  return { ...input.previsao, propostas, previsaoTermino: fins.length ? fins.reduce((a, b) => Date.parse(a) > Date.parse(b) ? a : b) : input.previsao.previsaoTermino };
}
