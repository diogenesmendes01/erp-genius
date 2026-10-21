import { describe, expect, it, vi } from "vitest";

// global-error.tsx (#172): o "Tentar de novo" era um <button> escrito à mão, com as classes do primário copiadas.
// Agora é o <Botao> do design system, que leva o `reset` no onClick.
vi.mock("./globals.css", () => ({}));

import GlobalError from "./global-error";
import { Botao } from "@/components/Botao";
import { elementos, texto } from "@/test/tela-sem-dom";

describe("global-error: \"Tentar de novo\" é o Botao do design system", () => {
  const reset = vi.fn();
  const arvore = GlobalError({ error: new Error("detalhe técnico"), reset });
  const nos = elementos(arvore);

  it("nenhum <button> escrito à mão", () => {
    expect(nos.filter((n) => n.type === "button")).toEqual([]);
  });

  it("um Botao só, com o rótulo \"Tentar de novo\", que chama reset", () => {
    const botoes = nos.filter((n) => n.type === Botao);
    expect(botoes).toHaveLength(1);
    expect(texto(botoes[0].props.children)).toBe("Tentar de novo");
    expect(botoes[0].props.onClick).toBe(reset);
  });

  it("o erro técnico não vai para a tela", () => {
    expect(texto(arvore)).not.toContain("detalhe técnico");
  });
});
