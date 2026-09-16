import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { PeriodosCalendarioSchema } from "./calendario-schema";
import { conferirDiasNaoLetivos } from "./calendario-intervalo";

const horario = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const GradeEncontrosSchema = z.object({
  dataInicial: DataCivilSchema, diasSemana: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine((d) => new Set(d).size === d.length, "Dia da semana repetido."),
  horario, duracaoMinutos: z.number().int().positive().max(1440), quantidadeAulas: z.number().int().positive().max(1000),
  fusoOrigem: FusoInstitucionalSchema, fusoEscola: FusoInstitucionalSchema, periodos: PeriodosCalendarioSchema,
}).strict();

/** Resolve horário local sem escolher silenciosamente um dos instantes de uma dobra DST. */
export function instanteDaGrade(data: string, hora: string, fuso: string) {
  DataCivilSchema.parse(data); horario.parse(hora); FusoInstitucionalSchema.parse(fuso);
  const nominal = Date.parse(`${data}T${hora}:00Z`);
  const formato = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const local = (instante: number) => {
    const partes = formato.formatToParts(new Date(instante));
    const p = (tipo: string) => partes.find((x) => x.type === tipo)!.value;
    return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}`;
  };
  const offsets = new Set<number>();
  for (let h = -48; h <= 48; h += 6) {
    const instante = nominal + h * 3600000;
    offsets.add(Date.parse(`${local(instante)}Z`) - instante);
  }
  const candidatos = [...offsets].map((offset) => nominal - offset).filter((instante) => local(instante) === `${data}T${hora}:00`);
  if (candidatos.length !== 1) throw new Error(`Horário ${data} ${hora} em ${fuso} ${candidatos.length ? "ambíguo" : "inexistente"}; requer revisão da grade.`);
  return new Date(candidatos[0]);
}

/** Prévia de grade: não publica nem presume disponibilidade do professor. */
export function gerarGradeEncontros(input: z.input<typeof GradeEncontrosSchema>) {
  const d = GradeEncontrosSchema.parse(input), inicio = Date.parse(`${d.dataInicial}T00:00:00Z`);
  const periodos = d.periodos.map((p) => ({ id: p.id, inicio: p.inicio, fim: p.fim }));
  const encontros: { inicio: string; fim: string; dataOrigem: string }[] = [];
  for (let dias = 0; dias < 20000 && encontros.length < d.quantidadeAulas; dias++) {
    const dia = new Date(inicio + dias * 86400000);
    if (!d.diasSemana.includes(dia.getUTCDay())) continue;
    const dataOrigem = dia.toISOString().slice(0, 10), comeco = instanteDaGrade(dataOrigem, d.horario, d.fusoOrigem);
    const fim = new Date(comeco.getTime() + d.duracaoMinutos * 60000);
    const encontro = { inicio: comeco.toISOString(), fim: fim.toISOString(), dataOrigem };
    if (conferirDiasNaoLetivos({ inicio: encontro.inicio, fim: encontro.fim, fusoEscola: d.fusoEscola, periodos }).periodosAfetados.length) continue;
    encontros.push(encontro);
  }
  if (encontros.length !== d.quantidadeAulas) throw new Error("Não foi possível completar a grade no horizonte de planejamento; revise o calendário.");
  return { dataInicialInformada: d.dataInicial, primeiraAula: encontros[0].inicio, previsaoTermino: encontros[encontros.length - 1].fim,
    fusoOrigem: d.fusoOrigem, encontros, publicada: false as const };
}
