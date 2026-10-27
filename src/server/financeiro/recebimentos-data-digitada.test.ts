import { describe, expect, it } from "vitest";
import { diasDoMeioDiaDigitado, mesmaDataDigitadaNaEscola } from "./recebimentos";
import { analisarComDatasDaEscola, dataObrigatoria } from "@/server/_shared/validacao";
import { formatarDiaDoPagamento } from "@/server/operacao/fuso-exibicao";
import { instanteDaGrade } from "@/server/agenda/grade";

describe("FIN-04: data digitada ao meio-dia da escola", () => {
  it("05/10 digitado (qualquer navegador) vira o meio-dia da escola e exibe 05/10", () => {
    const d = analisarComDatasDaEscola(dataObrigatoria, "2026-10-05", "America/Sao_Paulo") as Date;
    expect(d.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(formatarDiaDoPagamento(d, "America/Sao_Paulo")).toBe("05/10/2026");
    expect(formatarDiaDoPagamento("2026-10-05T01:00:00.000Z", "America/Sao_Paulo")).toBe("04/10/2026");
  });
});

describe("diasDoMeioDiaDigitado (formas de uma data digitada ao meio-dia)", () => {
  it("meio-dia de D em qualquer fuso (UTC−12 a UTC+14) é D; o mesmo instante pode ser meio-dia de dois dias vizinhos", () => {
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T15:00:00.000Z"))).toEqual(["2026-10-05"]);
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T01:00:00.000Z"))).toEqual(["2026-10-05"]);
    expect(diasDoMeioDiaDigitado(new Date("2026-10-04T22:00:00.000Z"))).toEqual(["2026-10-04", "2026-10-05"]);
    expect(diasDoMeioDiaDigitado(new Date("2026-10-06T00:00:00.000Z"))).toEqual(["2026-10-05", "2026-10-06"]);
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T06:15:00.000Z"))).toEqual(["2026-10-05"]);
  });

  it("instante que não é data digitada (segundos, fora do quarto de hora) não tem dia", () => {
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T15:00:01.000Z"))).toEqual([]);
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T15:07:00.000Z"))).toEqual([]);
    expect(diasDoMeioDiaDigitado(new Date("x"))).toEqual([]);
  });
});

describe("mesmaDataDigitadaNaEscola (replay da mesma chave)", () => {
  const sp = "America/Sao_Paulo";
  const meioDia = (d: string, fuso: string) => instanteDaGrade(d, "12:00", fuso);
  it("São Paulo: meio-dia da escola e o meio-dia do navegador no fuso da escola são o mesmo dia; outro dia não", () => {
    expect(mesmaDataDigitadaNaEscola(meioDia("2026-10-05", sp), meioDia("2026-10-05", sp), sp)).toBe(true);
    expect(mesmaDataDigitadaNaEscola(meioDia("2026-10-05", sp), meioDia("2026-10-06", sp), sp)).toBe(false);
  });
  it("Pacific/Auckland: outro dia digitado com a mesma chave NÃO passa como replay (antes passava)", () => {
    const akl = "Pacific/Auckland";
    expect(meioDia("2026-10-04", akl).toISOString()).toBe("2026-10-03T23:00:00.000Z");
    expect(mesmaDataDigitadaNaEscola(meioDia("2026-10-04", akl), meioDia("2026-10-05", akl), akl)).toBe(false);
    expect(mesmaDataDigitadaNaEscola(meioDia("2026-10-04", akl), meioDia("2026-10-04", akl), akl)).toBe(true);
    expect(mesmaDataDigitadaNaEscola(meioDia("2026-10-04", "Pacific/Honolulu"), meioDia("2026-10-05", "Pacific/Honolulu"), "Pacific/Honolulu")).toBe(false);
  });
  it("formulário antigo (ISO do navegador): aceito só se puder ser o meio-dia do dia que a escola vê", () => {
    expect(mesmaDataDigitadaNaEscola(meioDia("2026-10-05", sp), new Date("2026-10-05T01:00:00.000Z"), sp)).toBe(true);
    expect(mesmaDataDigitadaNaEscola(new Date("2026-10-05T01:00:00.000Z"), meioDia("2026-10-05", sp), sp)).toBe(false);
    expect(mesmaDataDigitadaNaEscola(new Date("2026-10-05T15:00:00.000Z"), meioDia("2026-10-05", sp), sp)).toBe(true);
  });
  it("fuso da escola inválido: nunca é replay de outra convenção", () => {
    expect(mesmaDataDigitadaNaEscola(meioDia("2026-10-05", sp), meioDia("2026-10-05", sp), "Lua/Base")).toBe(false);
  });
});
