import { describe, it, expect } from "vitest";
import { celulaSegura, gerarCsv } from "./csv";

describe("csv dos relatórios", () => {
  it("csv_neutraliza_formula", () => {
    for (const v of ["=HYPERLINK(\"x\")", "+5511999", "-2+3", "@SUM(A1)", "\tx", "\rx"]) expect(celulaSegura(v).startsWith("'")).toBe(true);
    expect(celulaSegura("Ana")).toBe("Ana");
    expect(celulaSegura(null)).toBe("");
    expect(celulaSegura(-3)).toBe("-3");
  });
  it("csv_separador_bom_e_aspas", () =>
    expect(gerarCsv(["Nome", "Valor"], [["Ana; Silva", 700], ['Diz "oi"', null]])).toBe('﻿Nome;Valor\r\n"Ana; Silva";700\r\n"Diz ""oi""";\r\n'));
  it("csv_neutraliza_antes_de_citar", () => expect(gerarCsv(["A"], [["=1;2"]])).toBe("﻿A\r\n\"'=1;2\"\r\n"));
});
