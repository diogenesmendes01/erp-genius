import { describe, expect, it } from "vitest";
import { configPadrao } from "../config-schema";
import { avaliarDesconto } from "./desconto";

const pol = configPadrao().politicas; // 10 / 20, parcelas 10

describe("avaliarDesconto", () => {
  it("faixas", () => {
    expect(avaliarDesconto(10, 1, "MENSALIDADE", pol)).toBe("SEM_APROVACAO");
    expect(avaliarDesconto(10.01, 1, "MENSALIDADE", pol)).toBe("COM_APROVACAO");
    expect(avaliarDesconto(20, 1, "MENSALIDADE", pol)).toBe("COM_APROVACAO");
    expect(avaliarDesconto(21, 1, "MENSALIDADE", pol)).toBe("HANDOFF");
    expect(avaliarDesconto(0, 11, "MENSALIDADE", pol)).toBe("HANDOFF");
    expect(avaliarDesconto(-1, 1, "MATRICULA", pol)).toBe("HANDOFF");
  });
  it("parcelas no limite e valores invalidos", () => {
    expect(avaliarDesconto(0, 10, "MATRICULA", pol)).toBe("SEM_APROVACAO");
    expect(avaliarDesconto(0, 0, "MATRICULA", pol)).toBe("HANDOFF");
    expect(avaliarDesconto(Number.NaN, 1, "MATRICULA", pol)).toBe("HANDOFF");
  });
  it("usa a faixa do tipo de cobranca", () => {
    const p = { ...pol, MATRICULA: { descontoSemAprovacaoPct: 5, descontoComAprovacaoPct: 8 } };
    expect(avaliarDesconto(6, 1, "MATRICULA", p)).toBe("COM_APROVACAO");
    expect(avaliarDesconto(6, 1, "MENSALIDADE", p)).toBe("SEM_APROVACAO");
  });
});
