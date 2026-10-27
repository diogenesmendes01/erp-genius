import { describe, it, expect } from "vitest";
import { classificarRespostaExperimental } from "./captura";

describe("classificarRespostaExperimental", () => {
  it("keywords genéricas NÃO confirmam (conjunto conservador)", () => {
    for (const corpo of ["ok", "si", "confirmar", "confirmado"]) {
      expect(classificarRespostaExperimental(corpo), corpo).toBeNull();
    }
  });

  it("só o que o template pede confirma — com trim e caixa indiferentes", () => {
    expect(classificarRespostaExperimental("sim")).toBe("confirmada");
    expect(classificarRespostaExperimental("SIM ")).toBe("confirmada");
    expect(classificarRespostaExperimental("Confirmo")).toBe("confirmada");
  });

  it("pedido de reagendamento é reconhecido", () => {
    expect(classificarRespostaExperimental("reagendar")).toBe("reagendar");
  });

  it("frase que CONTÉM a keyword não vale (match exato, não substring)", () => {
    expect(classificarRespostaExperimental("sim, claro")).toBeNull();
  });

  it("corpo vazio/ausente (mídia, sticker) não classifica nada", () => {
    expect(classificarRespostaExperimental(null)).toBeNull();
    expect(classificarRespostaExperimental("")).toBeNull();
  });
});
