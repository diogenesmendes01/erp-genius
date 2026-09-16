import { describe, expect, it } from "vitest";
import {
  ajustarVencimentoDiaUtil,
  CalendarioFinanceiroSchema,
  ErroConferenciaVencimento,
} from "./vencimento-dia-util";

const calendario = {
  id: "financeiro-br-2026",
  versao: 4,
  referencia: "Resolução financeira 2026, revisão 4",
  inicioVigencia: "2026-01-01",
  fimVigencia: "2026-12-31",
  diasSemanaUteis: [1, 2, 3, 4, 5],
  feriados: [],
};

describe("ajustarVencimentoDiaUtil", () => {
  it("atravessa o mês preservando o vencimento calculado por Q90", () => {
    expect(ajustarVencimentoDiaUtil({
      dataCalculada: "2026-02-28",
      regra: { regra: "PROXIMO_DIA_UTIL", calendario },
    })).toMatchObject({ dataCalculada: "2026-02-28", dataAjustada: "2026-03-02" });
  });

  it("não ultrapassa o último dia persistível quando não houver dia útil", () => {
    expect(() => ajustarVencimentoDiaUtil({
      dataCalculada: "9999-12-31",
      regra: { regra: "PROXIMO_DIA_UTIL", calendario: {
        ...calendario, inicioVigencia: "9999-12-31", fimVigencia: "9999-12-31", feriados: ["9999-12-31"],
      } },
    })).toThrow(/não há dia útil financeiro/);
  });
  it("avança por fim de semana e feriados consecutivos, mantendo a referência aplicada", () => {
    const resultado = ajustarVencimentoDiaUtil({
      dataCalculada: "2026-04-04", // sábado
      regra: {
        regra: "PROXIMO_DIA_UTIL",
        calendario: { ...calendario, feriados: ["2026-04-06", "2026-04-07"] },
      },
    });

    expect(resultado).toEqual({
      dataCalculada: "2026-04-04",
      dataAjustada: "2026-04-08",
      regraAplicada: "PROXIMO_DIA_UTIL",
      referenciaCalendarioAplicada: {
        id: "financeiro-br-2026",
        versao: 4,
        referencia: "Resolução financeira 2026, revisão 4",
      },
    });
  });

  it("preserva uma data que já é útil", () => {
    expect(ajustarVencimentoDiaUtil({
      dataCalculada: "2026-04-08",
      regra: { regra: "PROXIMO_DIA_UTIL", calendario },
    }).dataAjustada).toBe("2026-04-08");
  });

  it("mantém a data quando a regra contratual assim determina", () => {
    expect(ajustarVencimentoDiaUtil({
      dataCalculada: "2026-04-04",
      regra: { regra: "MANTER_DATA" },
    })).toMatchObject({
      dataCalculada: "2026-04-04",
      dataAjustada: "2026-04-04",
      regraAplicada: "MANTER_DATA",
      referenciaCalendarioAplicada: null,
    });
  });

  it("exige calendário na regra de próximo dia útil", () => {
    expect(() => ajustarVencimentoDiaUtil({
      dataCalculada: "2026-04-08",
      regra: { regra: "PROXIMO_DIA_UTIL" } as never,
    })).toThrow(ErroConferenciaVencimento);
  });

  it("requer conferência para data fora da vigência ou sem dia útil até o limite", () => {
    expect(() => ajustarVencimentoDiaUtil({
      dataCalculada: "2027-01-01",
      regra: { regra: "PROXIMO_DIA_UTIL", calendario },
    })).toThrow(/Conferência necessária/);

    expect(() => ajustarVencimentoDiaUtil({
      dataCalculada: "2026-12-31",
      regra: {
        regra: "PROXIMO_DIA_UTIL",
        calendario: { ...calendario, diasSemanaUteis: [1], fimVigencia: "2026-12-31" },
      },
    })).toThrow(/não há dia útil financeiro/);
  });

  it("não presume sábado e domingo como a semana financeira", () => {
    const resultado = ajustarVencimentoDiaUtil({
      dataCalculada: "2026-04-03", // sexta-feira
      regra: {
        regra: "PROXIMO_DIA_UTIL",
        calendario: { ...calendario, diasSemanaUteis: [0, 1, 2, 3, 4] },
      },
    });
    expect(resultado.dataAjustada).toBe("2026-04-05"); // domingo
  });

  it("valida datas reais persistíveis, vigência, feriados e dias úteis sem repetição", () => {
    expect(CalendarioFinanceiroSchema.safeParse({ ...calendario, inicioVigencia: "0000-01-01" }).success).toBe(false);
    expect(CalendarioFinanceiroSchema.safeParse({ ...calendario, inicioVigencia: "2024-02-29" }).success).toBe(true);
    expect(CalendarioFinanceiroSchema.safeParse({ ...calendario, inicioVigencia: "2026-02-29" }).success).toBe(false);
    expect(CalendarioFinanceiroSchema.safeParse({ ...calendario, inicioVigencia: "2026-12-31", fimVigencia: "2026-01-01" }).success).toBe(false);
    expect(CalendarioFinanceiroSchema.safeParse({ ...calendario, feriados: ["2025-12-31"] }).success).toBe(false);
    expect(CalendarioFinanceiroSchema.safeParse({ ...calendario, feriados: ["2026-01-01", "2026-01-01"] }).success).toBe(false);
    expect(CalendarioFinanceiroSchema.safeParse({ ...calendario, diasSemanaUteis: [1, 1] }).success).toBe(false);
  });
});
