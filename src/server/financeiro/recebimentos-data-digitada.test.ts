import { describe, expect, it } from "vitest";
import { diasDoMeioDiaDigitado, mesmaDataDigitada } from "./recebimentos";
import { analisarComDatasDaEscola, dataObrigatoria } from "@/server/_shared/validacao";
import { formatarDiaDoPagamento } from "@/server/operacao/fuso-exibicao";

// Item A da review do #289 (lote 3 do fuso pessoal nas telas): FIN-04 gravava o meio-dia do NAVEGADOR. Agora a data
// digitada vai ao meio-dia da escola; o replay da mesma chave reconhece o mesmo dia gravado pela regra antiga.
// Expectativas fixas: passam em TZ=UTC e America/Sao_Paulo.
describe("FIN-04: data digitada ao meio-dia da escola", () => {
  it("05/10 digitado (qualquer navegador) vira o meio-dia da escola e exibe 05/10", () => {
    const d = analisarComDatasDaEscola(dataObrigatoria, "2026-10-05", "America/Sao_Paulo") as Date;
    expect(d.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(formatarDiaDoPagamento(d, "America/Sao_Paulo")).toBe("05/10/2026");
    // O valor antigo de um navegador em Sydney (05/10 12:00 +11:00) é lido como 04/10 pela escola: o bug corrigido.
    expect(formatarDiaDoPagamento("2026-10-05T01:00:00.000Z", "America/Sao_Paulo")).toBe("04/10/2026");
  });
});

describe("diasDoMeioDiaDigitado / mesmaDataDigitada (replay da mesma chave)", () => {
  it("meio-dia de D em qualquer fuso (UTC−12 a UTC+14) é D; o mesmo instante pode ser meio-dia de dois dias vizinhos", () => {
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T15:00:00.000Z"))).toEqual(["2026-10-05"]); // São Paulo
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T01:00:00.000Z"))).toEqual(["2026-10-05"]); // Sydney (+11)
    expect(diasDoMeioDiaDigitado(new Date("2026-10-04T22:00:00.000Z"))).toEqual(["2026-10-04", "2026-10-05"]); // +14 / −10
    expect(diasDoMeioDiaDigitado(new Date("2026-10-06T00:00:00.000Z"))).toEqual(["2026-10-05", "2026-10-06"]); // −12 / +12
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T06:15:00.000Z"))).toEqual(["2026-10-05"]); // Nepal (+5:45)
  });

  it("instante que não é data digitada (segundos, fora do quarto de hora) não tem dia", () => {
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T15:00:01.000Z"))).toEqual([]);
    expect(diasDoMeioDiaDigitado(new Date("2026-10-05T15:07:00.000Z"))).toEqual([]);
    expect(diasDoMeioDiaDigitado(new Date("x"))).toEqual([]);
  });

  it("mesmo dia digitado por convenções diferentes é a mesma data; dias distantes não", () => {
    expect(mesmaDataDigitada(new Date("2026-10-05T01:00:00.000Z"), new Date("2026-10-05T15:00:00.000Z"))).toBe(true);
    expect(mesmaDataDigitada(new Date("2026-10-05T15:00:00.000Z"), new Date("2026-10-07T15:00:00.000Z"))).toBe(false);
    expect(mesmaDataDigitada(new Date("2026-10-05T15:00:00.000Z"), new Date("2026-10-05T15:00:01.000Z"))).toBe(false);
  });
});
