import { z } from "zod";

const quantidade = z.number().int().positive().max(5256000);
export const SaldoCompraHorasSchema = z.object({
  compraId: z.string().min(1), matriculaId: z.string().min(1), minutosComprados: quantidade,
  reservas: z.array(z.object({ id: z.string().min(1), referenciaEncontro: z.string().min(1), minutos: quantidade,
    desfecho: z.enum(["PENDENTE", "REALIZADA", "FALTA_COBRAVEL", "CANCELAMENTO_TARDIO", "CANCELAMENTO_NO_PRAZO", "CANCELAMENTO_ESCOLA"]),
  }).strict()).max(10000),
}).strict().superRefine((d, ctx) => {
  if (new Set(d.reservas.map((r) => r.id)).size !== d.reservas.length) ctx.addIssue({ code: "custom", message: "Reserva repetida." });
  // Uma tentativa cancelada pode ter nova reserva; duas reservas vigentes do mesmo encontro não.
  const vigentes = d.reservas.filter((r) => !["CANCELAMENTO_NO_PRAZO", "CANCELAMENTO_ESCOLA"].includes(r.desfecho));
  if (new Set(vigentes.map((r) => r.referenciaEncontro)).size !== vigentes.length) ctx.addIssue({ code: "custom", message: "Encontro já possui reserva ou consumo nesta compra." });
});

export function calcularSaldoCompraHoras(input: z.input<typeof SaldoCompraHorasSchema>) {
  const d = SaldoCompraHorasSchema.parse(input);
  let reservados = 0, consumidos = 0;
  for (const r of d.reservas) {
    if (r.desfecho === "PENDENTE") reservados += r.minutos;
    else if (["REALIZADA", "FALTA_COBRAVEL", "CANCELAMENTO_TARDIO"].includes(r.desfecho)) consumidos += r.minutos;
  }
  if (reservados + consumidos > d.minutosComprados) throw new Error("Reservas e consumos excedem as horas compradas.");
  return { compraId: d.compraId, matriculaId: d.matriculaId, minutosComprados: d.minutosComprados,
    minutosReservados: reservados, minutosConsumidos: consumidos, minutosDisponiveis: d.minutosComprados - reservados - consumidos };
}

/** O chamador deve conferir agenda, autorização, prazo contratual e persistir atomicamente. */
export function reservarHorasCompradas(input: z.input<typeof SaldoCompraHorasSchema>, reserva: { id: string; referenciaEncontro: string; minutos: number }) {
  const atual = SaldoCompraHorasSchema.parse(input);
  const proximo = SaldoCompraHorasSchema.parse({ ...atual, reservas: [...atual.reservas, { ...reserva, desfecho: "PENDENTE" }] });
  return { registro: proximo, saldo: calcularSaldoCompraHoras(proximo) };
}

export function concluirReservaHoras(input: z.input<typeof SaldoCompraHorasSchema>, reservaId: string, desfecho: Exclude<z.infer<typeof SaldoCompraHorasSchema>["reservas"][number]["desfecho"], "PENDENTE">) {
  const atual = SaldoCompraHorasSchema.parse(input);
  const reserva = atual.reservas.find((r) => r.id === reservaId);
  if (!reserva) throw new Error("Reserva não encontrada nesta compra.");
  if (reserva.desfecho !== "PENDENTE" && reserva.desfecho !== desfecho) throw new Error("Reserva já concluída; não altere o histórico.");
  const proximo = SaldoCompraHorasSchema.parse({ ...atual, reservas: atual.reservas.map((r) => r.id === reservaId ? { ...r, desfecho } : r) });
  return { registro: proximo, saldo: calcularSaldoCompraHoras(proximo) };
}
