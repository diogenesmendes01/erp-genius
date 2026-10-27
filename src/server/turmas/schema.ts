import { z } from "zod";
import { dataObrigatoria, dataOpcional } from "@/server/_shared/validacao";

const HORARIO_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function emMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function duracaoIntervaloEmMinutos(horarioInicio: string, horarioFim: string): number {
  const inicio = emMinutos(horarioInicio);
  const fim = emMinutos(horarioFim);
  return (fim - inicio + 24 * 60) % (24 * 60);
}

export function horarioFimPorDuracao(horarioInicio: string, duracaoMinutos: number): {
  horarioFim: string;
  atravessaDia: boolean;
} {
  const inicio = emMinutos(horarioInicio);
  const total = inicio + duracaoMinutos;
  const fim = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return {
    horarioFim: `${String(Math.floor(fim / 60)).padStart(2, "0")}:${String(fim % 60).padStart(2, "0")}`,
    atravessaDia: total >= 24 * 60,
  };
}

export const TurmaSchema = z
  .object({
    nome: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().optional()),
    modalidadeId: z.string().min(1, "Selecione a modalidade"),
    nivelId: z.string().min(1, "Selecione o nível"),
    professorId: z.string().optional(),
    diasSemana: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Selecione os dias da semana"),
    horarioInicio: z.string().regex(HORARIO_RE, "Informe o horário de início (HH:MM)"),
    horarioFim: z.string().regex(HORARIO_RE, "Informe o horário de fim (HH:MM)"),
    dataInicio: dataObrigatoria,
    dataFim: dataOpcional,
    capacidade: z.coerce.number().int().positive("Capacidade deve ser ≥ 1").default(12),
    rolling: z.boolean().optional().default(false),
  })
  .refine((d) => !d.dataFim || d.dataFim > d.dataInicio, {
    message: "A data de fim deve ser depois da data de início",
    path: ["dataFim"],
  })
  .refine((d) => duracaoIntervaloEmMinutos(d.horarioInicio, d.horarioFim) > 0, {
    message: "O intervalo da aula deve ter duração positiva",
    path: ["horarioFim"],
  });

export type TurmaInput = z.input<typeof TurmaSchema>;

export function diasPorSemanaDaFrequencia(frequencia: string): number | null {
  const m = /(\d+)\s*x/i.exec(frequencia);
  return m ? Number(m[1]) : null;
}

const DIAS_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function rotuloDiasHorario(diasSemana: number[], horarioInicio: string, horarioFim: string): string {
  const dias = [...diasSemana]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => DIAS_ABREV[d])
    .join(", ");
  const faixa = [horarioInicio, horarioFim].filter(Boolean).join("–");
  return faixa ? `${dias} · ${faixa}` : dias;
}
