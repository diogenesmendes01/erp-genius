import { expect, it } from "vitest";
import { calcularAdiantamentoProposto as calcular } from "./adiantamento-proposto";
it("calcula frações de hora sem arredondar minutos", () => {
  expect(calcular("HORA_PARTICULAR", 75, "100", true)).toMatchObject({ minutos: 75, valor: "125.00" });
  expect(calcular("HORA_PARTICULAR", 61, "10", false)).toMatchObject({ minutos: 61, valor: "10.17" });
});
it("não inventa antecipação nem aceita unidades/regime inválidos", () => {
  expect(calcular("HORA_PARTICULAR", undefined, "100", false)).toBeNull();
  expect(() => calcular("HORA_PARTICULAR", undefined, "100", true)).toThrow("Informe os minutos");
  expect(() => calcular("MENSALIDADE", 60, "100", true)).toThrow("mensalidade fixa");
  for (const n of [0, -1, 0.5, Infinity]) expect(() => calcular("HORA_PARTICULAR", n, "100", true)).toThrow();
  expect(() => calcular("HORA_PARTICULAR", 1, "0", true)).toThrow("valor positivo");
  expect(() => calcular("HORA_PARTICULAR", 120, "9999999999.99", true)).toThrow("limite monetário");
});
