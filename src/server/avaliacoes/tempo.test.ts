import { expect, it } from "vitest";
import { dataHoraAvaliacaoLocal, instanteAvaliacaoLocal } from "./tempo";

it.each(["America/Sao_Paulo", "America/Costa_Rica", "Asia/Kathmandu", "UTC"])("preserva instante, segundos e milissegundos em %s", fuso => {
  const original = new Date("2026-01-01T01:02:03.456Z");
  expect(instanteAvaliacaoLocal(dataHoraAvaliacaoLocal(original, fuso), fuso)).toEqual(original);
});
it("converte a data civil do fuso escolhido, inclusive no dia anterior", () => {
  expect(instanteAvaliacaoLocal("2025-12-31T19:02:03.456", "America/Costa_Rica").toISOString()).toBe("2026-01-01T01:02:03.456Z");
});
it.each(["2026-03-08T02:30:01", "2026-11-01T01:30:01"])("não escolhe horário ambíguo ou inexistente %s", local => {
  expect(() => instanteAvaliacaoLocal(local, "America/New_York")).toThrow();
});
it.each(["2026-02-30T12:00", "2026-01-01T25:00", "2026-01-01T12:00:60"])("rejeita data local inválida %s", local => {
  expect(() => instanteAvaliacaoLocal(local, "UTC")).toThrow();
});
