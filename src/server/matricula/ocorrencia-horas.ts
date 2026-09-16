import { z } from "zod";
import { concluirReservaHoras, SaldoCompraHorasSchema } from "./saldo-horas";

const instante = z.string().datetime({ offset: true });
export const OcorrenciaHorasSchema = z.object({
  matriculaId: z.string().min(1), referenciaEncontro: z.string().min(1), contratoVersaoId: z.string().min(1),
  inicio: instante, fim: instante, registradoEm: instante, evidencia: z.string().trim().min(5).max(2000),
  ocorrencia: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("REALIZADA") }).strict(),
    z.object({ tipo: z.literal("FALTA_ALUNO") }).strict(),
    z.object({ tipo: z.literal("CANCELAMENTO_ESCOLA"), comunicadoEm: instante }).strict(),
    z.object({ tipo: z.literal("CANCELAMENTO_ALUNO"), comunicadoEm: instante, antecedenciaMinutos: z.number().int().nonnegative().max(5256000) }).strict(),
  ]),
}).strict().superRefine((d, ctx) => {
  const falha = (message: string) => ctx.addIssue({ code: "custom", message });
  if (Date.parse(d.fim) <= Date.parse(d.inicio)) falha("Intervalo do encontro inválido.");
  if ((d.ocorrencia.tipo === "REALIZADA" || d.ocorrencia.tipo === "FALTA_ALUNO") && Date.parse(d.registradoEm) < Date.parse(d.fim)) falha("Aguarde o término do encontro para conferir realização ou falta.");
  if ("comunicadoEm" in d.ocorrencia && Date.parse(d.ocorrencia.comunicadoEm) > Date.parse(d.registradoEm)) falha("Comunicação não pode ser posterior ao registro da ocorrência.");
});

/** Classificação financeira de ocorrência conferida; não conclui diário nem gera cobrança. */
export function classificarOcorrenciaHoras(input: z.input<typeof OcorrenciaHorasSchema>) {
  const d = OcorrenciaHorasSchema.parse(input);
  const o = d.ocorrencia;
  const limite = o.tipo === "CANCELAMENTO_ALUNO" ? new Date(Date.parse(d.inicio) - o.antecedenciaMinutos * 60000).toISOString() : null;
  const desfecho: Exclude<z.infer<typeof SaldoCompraHorasSchema>["reservas"][number]["desfecho"], "PENDENTE"> = o.tipo === "REALIZADA" ? "REALIZADA" : o.tipo === "FALTA_ALUNO" ? "FALTA_COBRAVEL" : o.tipo === "CANCELAMENTO_ESCOLA" ? "CANCELAMENTO_ESCOLA"
    : Date.parse(o.comunicadoEm) <= Date.parse(limite!) ? "CANCELAMENTO_NO_PRAZO" : "CANCELAMENTO_TARDIO";
  return { desfecho, consomeHoras: ["REALIZADA", "FALTA_COBRAVEL", "CANCELAMENTO_TARDIO"].includes(desfecho),
    limiteCancelamento: limite, origem: d, concluiDiario: false as const };
}

export function concluirReservaPorOcorrencia(input: z.input<typeof SaldoCompraHorasSchema>, reservaId: string, ocorrencia: z.input<typeof OcorrenciaHorasSchema>) {
  const saldo = SaldoCompraHorasSchema.parse(input);
  const resultado = classificarOcorrenciaHoras(ocorrencia);
  const reserva = saldo.reservas.find((r) => r.id === reservaId);
  if (resultado.origem.matriculaId !== saldo.matriculaId || !reserva || reserva.referenciaEncontro !== resultado.origem.referenciaEncontro) throw new Error("Ocorrência incompatível com a matrícula ou encontro da reserva.");
  return { ...concluirReservaHoras(saldo, reservaId, resultado.desfecho), ocorrencia: resultado };
}
