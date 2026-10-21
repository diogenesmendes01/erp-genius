import { describe, expect, it } from "vitest";
import { conferirIntervalosCoberturaAditivo } from "./aditivo-cobertura-intervalos";
const formal = { inicio: "2026-11-01", fim: "2026-11-30" };
const afetada = { id: "a", afetada: true, anterior: { inicio: "2026-10-01", fim: "2026-10-31" }, nova: formal };
const preservada = (id: string, inicio: string, fim: string) => ({ id, afetada: false, anterior: { inicio, fim }, nova: { inicio, fim } });
describe("intervalos da proposta de cobertura", () => {
  it("aceita correção ligada ao assinado e continuidade contígua", () => {
    expect(() => conferirIntervalosCoberturaAditivo([afetada, preservada("b", "2026-12-01", "2026-12-31")], formal)).not.toThrow();
  });
  it("não exige preencher lacunas históricas que a proposta não modifica", () => {
    expect(() => conferirIntervalosCoberturaAditivo([afetada, preservada("b", "2026-12-01", "2026-12-31"), preservada("c", "2027-02-01", "2027-02-28")], formal)).not.toThrow();
  });
  it("detecta sobreposição com intervalo continente mesmo com outra linha entre eles", () => {
    expect(() => conferirIntervalosCoberturaAditivo([preservada("b", "2026-01-01", "2026-12-31"), preservada("c", "2026-05-01", "2026-05-31"), afetada], formal)).toThrow("sobreposição");
  });
  it("permite explicitar efeitos colaterais contíguos sem perder o intervalo assinado", () => {
    expect(() => conferirIntervalosCoberturaAditivo([afetada, { id: "b", afetada: true, anterior: formal, nova: { inicio: "2026-12-01", fim: "2026-12-31" } }], formal)).not.toThrow();
  });
});
