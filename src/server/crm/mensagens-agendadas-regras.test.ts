import { describe, expect, it } from "vitest";
import { respondeuDepoisDeAgendar } from "./mensagens-agendadas-regras";

const base = { origem: "HUMANO", agendadaPara: new Date("2035-01-02T15:00:00Z"), perguntarSeResponder: true, confirmadaAposRespostaEm: null, criadaEm: new Date("2035-01-01T10:00:00Z") };
const depois = new Date("2035-01-01T11:00:00Z");

describe("respondeuDepoisDeAgendar", () => {
  it("com a opção, entrada depois de agendar pede confirmação", () => {
    expect(respondeuDepoisDeAgendar(base, depois)).toBe(true);
  });
  it("entrada antes de agendar, sem entrada ou sem a opção não pede", () => {
    expect(respondeuDepoisDeAgendar(base, new Date("2035-01-01T09:00:00Z"))).toBe(false);
    expect(respondeuDepoisDeAgendar(base, null)).toBe(false);
    expect(respondeuDepoisDeAgendar({ ...base, perguntarSeResponder: false }, depois)).toBe(false);
  });
  it("só vale para agendada HUMANO", () => {
    expect(respondeuDepoisDeAgendar({ ...base, origem: "IA" }, depois)).toBe(false);
    expect(respondeuDepoisDeAgendar({ ...base, agendadaPara: null }, depois)).toBe(false);
  });
  it("depois de confirmar, só uma nova entrada volta a pedir", () => {
    const confirmada = { ...base, confirmadaAposRespostaEm: new Date("2035-01-01T12:00:00Z") };
    expect(respondeuDepoisDeAgendar(confirmada, depois)).toBe(false);
    expect(respondeuDepoisDeAgendar(confirmada, new Date("2035-01-01T13:00:00Z"))).toBe(true);
  });
});
