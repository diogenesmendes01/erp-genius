import { expect, it } from "vitest";
import { calcularSaldoCompraHoras, concluirReservaHoras, reservarHorasCompradas } from "./saldo-horas";
const base = () => ({ compraId: "c1", matriculaId: "m1", minutosComprados: 120, reservas: [] });
const reserva = () => ({ id: "r1", referenciaEncontro: "aula1", minutos: 75 });
it("reservar reduz disponibilidade sem consumir; realização consome uma única vez", () => {
  const origem = base(); const r = reservarHorasCompradas(origem, reserva());
  expect(r.saldo).toMatchObject({ minutosDisponiveis: 45, minutosReservados: 75, minutosConsumidos: 0 });
  const concluida = concluirReservaHoras(r.registro, "r1", "REALIZADA");
  expect(concluida.saldo).toMatchObject({ minutosDisponiveis: 45, minutosReservados: 0, minutosConsumidos: 75 });
  expect(concluirReservaHoras(concluida.registro, "r1", "REALIZADA")).toEqual(concluida);
  expect(origem.reservas).toEqual([]);
});
it.each(["CANCELAMENTO_NO_PRAZO", "CANCELAMENTO_ESCOLA"] as const)("%s libera reserva sem consumo", (tipo) => {
  const r = reservarHorasCompradas(base(), reserva());
  const c = concluirReservaHoras(r.registro, "r1", tipo);
  expect(c.saldo).toMatchObject({ minutosDisponiveis: 120, minutosConsumidos: 0, minutosReservados: 0 });
  expect(reservarHorasCompradas(c.registro, { ...reserva(), id: "r2" }).saldo.minutosDisponiveis).toBe(45);
});
it.each(["FALTA_COBRAVEL", "CANCELAMENTO_TARDIO"] as const)("%s consome sem transformar em realização", (tipo) => {
  const r = concluirReservaHoras(reservarHorasCompradas(base(), reserva()).registro, "r1", tipo);
  expect(r.saldo.minutosConsumidos).toBe(75); expect(r.registro.reservas[0].desfecho).toBe(tipo);
  expect(() => concluirReservaHoras(r.registro, "r1", "REALIZADA")).toThrow(/histórico/);
});
it("recusa reserva duplicada, encontro repetido e quantidade acima do disponível", () => {
  const r = reservarHorasCompradas(base(), reserva());
  expect(() => reservarHorasCompradas(r.registro, reserva())).toThrow(/repetida/);
  expect(() => reservarHorasCompradas(r.registro, { ...reserva(), id: "r2" })).toThrow(/Encontro/);
  expect(() => reservarHorasCompradas(r.registro, { id: "r2", referenciaEncontro: "aula2", minutos: 46 })).toThrow(/excedem/);
  expect(() => calcularSaldoCompraHoras({ ...base(), minutosComprados: 0 })).toThrow();
});
