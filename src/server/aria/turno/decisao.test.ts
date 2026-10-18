import { describe, expect, it } from "vitest";
import { configPadrao, type ModoAcao } from "../config-schema";
import { destinoDaAcao } from "./decisao";

const c = configPadrao(); // executa >= 80, transfere < 50

describe("destinoDaAcao", () => {
  it.each([
    ["NAO_FAZ", 99, false, false, "NEGAR"],
    ["SUGERE", 99, false, false, "SUGERIR"],
    ["EXECUTA", 80, false, false, "EXECUTAR"],
    ["EXECUTA", 79, false, false, "SUGERIR"],
    ["EXECUTA", 99, true, false, "SUGERIR"],
    ["EXECUTA", 99, false, true, "SUGERIR"],
    ["SEMPRE", 10, true, true, "EXECUTAR"],
  ])("destino_%s_%i_sup%s_so%s", (modo, confianca, supervisao, soSugerir, esperado) =>
    expect(
      destinoDaAcao({
        modo: modo as ModoAcao,
        confianca: confianca as number,
        config: c,
        supervisao: supervisao as boolean,
        soSugerir: soSugerir as boolean,
      }),
    ).toBe(esperado),
  );
});
