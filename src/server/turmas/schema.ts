import { z } from "zod";
import { dataObrigatoria, dataOpcional } from "@/server/_shared/validacao";

// Turma = modalidade × nível × AGENDA (dias da semana + horário) × período (início→fim).
// Cohort online (docs 06, 09). A agenda é um calendário real: o nº de dias deve casar com
// a frequência da modalidade; o fim da aula pode atravessar a meia-noite e a data final
// é apenas uma referência histórica opcional.
const HORARIO_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" → minutos desde a meia-noite (comparação robusta de horários). */
export function emMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Duração circular de uma aula. 22:00–01:00 corresponde a três horas. */
export function duracaoIntervaloEmMinutos(horarioInicio: string, horarioFim: string): number {
  const inicio = emMinutos(horarioInicio);
  const fim = emMinutos(horarioFim);
  return (fim - inicio + 24 * 60) % (24 * 60);
}

/** Fim que a duração aprovada pela modalidade determina a partir do início. */
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
    // Dias da semana (0=Dom … 6=Sáb). A quantidade é revalidada contra a frequência da
    // modalidade na ação (que conhece a modalidade) — ver `diasPorSemanaDaFrequencia`.
    diasSemana: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Selecione os dias da semana"),
    horarioInicio: z.string().regex(HORARIO_RE, "Informe o horário de início (HH:MM)"),
    horarioFim: z.string().regex(HORARIO_RE, "Informe o horário de fim (HH:MM)"),
    dataInicio: dataObrigatoria,
    // A vigência final não é pré-requisito para criar a turma: a agenda publicada
    // é a fonte do período operacional. Em edição, ausência preserva o legado.
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

// Frequência da modalidade ("3x/semana") → nº de dias por semana. `null` = sem nº fixo
// (ex.: Particular "critério do aluno") → exige ≥ 1 dia, sem contagem exata.
export function diasPorSemanaDaFrequencia(frequencia: string): number | null {
  const m = /(\d+)\s*x/i.exec(frequencia);
  return m ? Number(m[1]) : null;
}

const DIAS_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Rótulo derivado para exibição: "Seg, Qua, Sex · 19:00–21:00". */
export function rotuloDiasHorario(diasSemana: number[], horarioInicio: string, horarioFim: string): string {
  const dias = [...diasSemana]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => DIAS_ABREV[d])
    .join(", ");
  const faixa = [horarioInicio, horarioFim].filter(Boolean).join("–");
  return faixa ? `${dias} · ${faixa}` : dias;
}
