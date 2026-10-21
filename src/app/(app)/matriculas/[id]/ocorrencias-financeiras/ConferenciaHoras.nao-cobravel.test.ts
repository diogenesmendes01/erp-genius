import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { descreverAulaNaoCobravel } from "./ConferenciaHoras";

// C5 da R1-b #266: a tela de ocorrências avisa que o valor da conferência é histórico depois da declaração Q175.
describe("descreverAulaNaoCobravel", () => {
  it("descreve cada efeito da declaração sem esconder que o valor é histórico", () => {
    expect(descreverAulaNaoCobravel("SEM_ITEM")).toContain("fica fora do fechamento por hora");
    expect(descreverAulaNaoCobravel("REDUZ_COBRANCA_ABERTA")).toContain("retirada da cobrança em aberto");
    expect(descreverAulaNaoCobravel("GERA_CREDITO")).toContain("gerou crédito na matrícula");
    expect(descreverAulaNaoCobravel("DEVOLVE_MINUTOS")).toContain("devolveu os minutos");
    for (const efeito of ["SEM_ITEM", "GERA_CREDITO", "OUTRO"]) expect(descreverAulaNaoCobravel(efeito)).toMatch(/^Aula declarada não cobrável.*valor acima é histórico/);
  });
});
