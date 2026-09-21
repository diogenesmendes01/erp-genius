import { expect, it } from "vitest";
import { classificarOcorrenciaHoras, concluirReservaPorOcorrencia } from "./ocorrencia-horas";
const base = () => ({ matriculaId: "m1", referenciaEncontro: "e1", contratoVersaoId: "v1", inicio: "2026-09-15T20:00:00-03:00", fim: "2026-09-15T21:00:00-03:00", registradoEm: "2026-09-16T01:00:00Z", evidencia: "Ocorrência conferida pelo responsável" });
it("comunicação exatamente no limite libera; um milissegundo depois consome", () => {
  const o = { ...base(), ocorrencia: { tipo: "CANCELAMENTO_ALUNO" as const, comunicadoEm: "2026-09-15T22:00:00Z", antecedenciaMinutos: 60 } };
  expect(classificarOcorrenciaHoras(o)).toMatchObject({ desfecho: "CANCELAMENTO_NO_PRAZO", consomeHoras: false, limiteCancelamento: "2026-09-15T22:00:00.000Z" });
  expect(classificarOcorrenciaHoras({ ...o, ocorrencia: { ...o.ocorrencia, comunicadoEm: "2026-09-15T22:00:00.001Z" } }).desfecho).toBe("CANCELAMENTO_TARDIO");
});
it("não presume antecedência nem aceita registro anterior à comunicação", () => {
  expect(() => classificarOcorrenciaHoras({ ...base(), ocorrencia: { tipo: "CANCELAMENTO_ALUNO", comunicadoEm: "2026-09-15T22:00:00Z" } } as never)).toThrow();
  expect(() => classificarOcorrenciaHoras({ ...base(), ocorrencia: { tipo: "CANCELAMENTO_ESCOLA", comunicadoEm: "2026-09-17T22:00:00Z" } })).toThrow(/posterior/);
});
it("escola libera horas; falta só é conferida após o encontro e não conclui diário", () => {
  expect(classificarOcorrenciaHoras({ ...base(), ocorrencia: { tipo: "CANCELAMENTO_ESCOLA", comunicadoEm: "2026-09-15T23:00:00Z" } }).consomeHoras).toBe(false);
  expect(() => classificarOcorrenciaHoras({ ...base(), registradoEm: "2026-09-15T23:30:00Z", ocorrencia: { tipo: "FALTA_ALUNO" } })).toThrow(/término/);
  expect(classificarOcorrenciaHoras({ ...base(), ocorrencia: { tipo: "FALTA_ALUNO" } })).toMatchObject({ desfecho: "FALTA_COBRAVEL", consomeHoras: true, concluiDiario: false });
});
it("aplica somente à reserva correspondente e preserva o tempo contratado", () => {
  const saldo = { compraId: "c1", matriculaId: "m1", minutosComprados: 180, reservas: [{ id: "r1", referenciaEncontro: "e1", minutos: 75, desfecho: "PENDENTE" as const }] };
  const ocorrencia = { ...base(), ocorrencia: { tipo: "REALIZADA" as const } };
  expect(concluirReservaPorOcorrencia(saldo, "r1", ocorrencia).saldo).toMatchObject({ minutosConsumidos: 75, minutosDisponiveis: 105 });
  expect(() => concluirReservaPorOcorrencia(saldo, "r1", { ...ocorrencia, matriculaId: "m2" })).toThrow(/incompatível/);
  expect(() => concluirReservaPorOcorrencia(saldo, "r1", { ...ocorrencia, referenciaEncontro: "e2" })).toThrow(/incompatível/);
});
