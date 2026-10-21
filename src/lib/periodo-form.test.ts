import { describe, expect, it, vi } from "vitest";
import { vincularInicio } from "./periodo-form";

function formFalso() {
  const ouvintes = new Set<() => void>();
  return {
    addEventListener: (_: "reset", f: () => void) => { ouvintes.add(f); },
    removeEventListener: (_: "reset", f: () => void) => { ouvintes.delete(f); },
    resetar: () => ouvintes.forEach((f) => f()),
    ouvintes,
  };
}

describe("vincularInicio", () => {
  it("ao montar, adota o valor exibido — remontagem com defaultValue não deixa o min com um valor antigo", () => {
    const definir = vi.fn();
    vincularInicio({ value: "2026-09-10", defaultValue: "2026-09-10", form: null }, definir);
    expect(definir).toHaveBeenCalledWith("2026-09-10");
  });

  it("no reset do form, volta ao valor padrão do campo (não ao último digitado)", () => {
    const form = formFalso();
    const alvo = { value: "2026-09-10", defaultValue: "", form };
    const definir = vi.fn();
    vincularInicio(alvo, definir);
    alvo.value = "2026-12-01";
    form.resetar();
    expect(definir).toHaveBeenLastCalledWith("");
  });

  it("com defaultValue pré-preenchido, o reset devolve esse padrão", () => {
    const form = formFalso();
    const definir = vi.fn();
    vincularInicio({ value: "2026-11-05", defaultValue: "2026-09-10", form }, definir);
    form.resetar();
    expect(definir).toHaveBeenLastCalledWith("2026-09-10");
  });

  it("o desligamento remove o ouvinte — campo desmontado não reage a resets posteriores", () => {
    const form = formFalso();
    const definir = vi.fn();
    const desligar = vincularInicio({ value: "", defaultValue: "", form }, definir);
    desligar();
    expect(form.ouvintes.size).toBe(0);
    definir.mockClear();
    form.resetar();
    expect(definir).not.toHaveBeenCalled();
  });
});
