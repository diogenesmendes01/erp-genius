import { describe, expect, it } from "vitest";
import { DIFERENCA_MINIMA, fundosDoTailwind } from "@/test/fundo-visivel";
import config from "../../tailwind.config";

const { destaqueSobreAPagina } = fundosDoTailwind(config);

describe("nada de fundo igual ao da página sem borda (#269 e follow-up)", () => {
  it("o substituto, bg-gray-100, se destaca da página nos dois temas", () => {
    for (const tema of ["claro", "escuro"] as const) expect(destaqueSobreAPagina("bg-gray-100", tema)).toBeGreaterThanOrEqual(DIFERENCA_MINIMA);
  });
});
