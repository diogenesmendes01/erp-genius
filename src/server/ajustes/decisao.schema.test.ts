import { describe, expect, it } from "vitest";
import { DecisaoSchema } from "./schema";

const mensagem = "Informe o motivo da rejeição (mínimo de 5 caracteres) para orientar o vendedor.";

describe("DecisaoSchema", () => {
  it("aprova sem motivo", () => {
    expect(DecisaoSchema.parse({ aprovar: true })).toEqual({ aprovar: true });
  });

  it("rejeição exige motivo com pelo menos 5 caracteres", () => {
    expect(DecisaoSchema.safeParse({ aprovar: false }).success).toBe(false);
    expect(DecisaoSchema.safeParse({ aprovar: false, motivo: "não" }).error?.issues[0]?.message).toBe(mensagem);
    expect(DecisaoSchema.parse({ aprovar: false, motivo: "  curto  " }).motivo).toBe("curto");
    expect(DecisaoSchema.parse({ aprovar: false, motivo: "  preço alto " })).toMatchObject({ aprovar: false, motivo: "preço alto" });
  });
});
