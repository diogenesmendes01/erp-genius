import { describe, expect, it } from "vitest";
import { ORIGEM_VENCIMENTO_LABEL, rotuloVencimento } from "@/lib/vencimento-civil";

const CODIGO = /\b(Q\d{2,3}|M0\d|S1\d|D\d{2})\b/;

describe("códigos internos de especificação fora da tela", () => {
  it("origem do vencimento sai em texto de operação (\"M01_HISTORICO\" aparecia cru)", () => {
    for (const rotulo of Object.values(ORIGEM_VENCIMENTO_LABEL)) expect(rotulo, rotulo).not.toMatch(CODIGO);
    const texto = rotuloVencimento({ estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: null, origem: "M01_HISTORICO" });
    expect(texto).toBe("vence 28/02/2099 · origem: histórico da migração");
  });
});
