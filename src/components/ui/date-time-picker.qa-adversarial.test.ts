// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { DateTimePicker, mensagemRestricaoDataHora } from "@/components/ui/date-time-picker";

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  }
  for (const proto of [Element.prototype, HTMLElement.prototype]) {
    const alvo = proto as Element & { scrollIntoView?: () => void; hasPointerCapture?: () => boolean; setPointerCapture?: () => void; releasePointerCapture?: () => void };
    alvo.scrollIntoView ??= () => {};
    alvo.hasPointerCapture ??= () => false;
    alvo.setPointerCapture ??= () => {};
    alvo.releasePointerCapture ??= () => {};
  }
});

afterEach(() => { cleanup(); });

const ERRO = "Informe data e hora.";

describe("mensagemRestricaoDataHora — R1 adversarial", () => {
  it("M9: HH:mm e o mesmo instante com milissegundos continuam iguais no min e no max", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T10:00", { step: "0.001", min: "2026-12-01T10:00:00.000", max: "2026-12-01T10:00:00.000" })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T10:00:00", { step: "0.001", min: "2026-12-01T10:00:00.000", max: "2026-12-01T10:00:00.000" })).toBe("");
  });

  it("M12: a fração só vale com exatamente 3 dígitos", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:07.123", { required: true, step: "0.001" })).toBe("");
    for (const valor of [
      "2026-12-01T13:05:07.1",
      "2026-12-01T13:05:07.12",
      "2026-12-01T13:05:07.1234",
      "2026-12-01T13:05:07.123456789",
    ]) {
      expect(mensagemRestricaoDataHora(valor, { required: true, step: "0.001" }), valor).toBe(ERRO);
    }
  });

  it("M13: texto antes da data não passa", () => {
    expect(mensagemRestricaoDataHora("x2026-12-01T13:05", { required: true })).toBe(ERRO);
    expect(mensagemRestricaoDataHora("2026-12-01T13:05", { required: true })).toBe("");
  });

  it("rejeita hora maior que 23", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T24:00", { required: true })).toBe(ERRO);
    expect(mensagemRestricaoDataHora("2026-12-01T23:59", { required: true })).toBe("");
  });

  it("rejeita minuto maior que 59", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T10:60", { required: true })).toBe(ERRO);
    expect(mensagemRestricaoDataHora("2026-12-01T10:59", { required: true })).toBe("");
  });

  it("rejeita segundo maior que 59", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T10:00:60", { required: true, step: "1" })).toBe(ERRO);
    expect(mensagemRestricaoDataHora("2026-12-01T10:00:59", { required: true, step: "1" })).toBe("");
  });

  it("rejeita mês 13", () => {
    expect(mensagemRestricaoDataHora("2026-13-01T10:00", { required: true })).toBe(ERRO);
    expect(mensagemRestricaoDataHora("2026-12-01T10:00", { required: true })).toBe("");
  });

  it("rejeita dia inválido", () => {
    expect(mensagemRestricaoDataHora("2026-02-30T10:00", { required: true })).toBe(ERRO);
    expect(mensagemRestricaoDataHora("2026-04-31T10:00", { required: true })).toBe(ERRO);
    expect(mensagemRestricaoDataHora("2024-02-29T10:00", { required: true })).toBe("");
    expect(mensagemRestricaoDataHora("2026-02-28T10:00", { required: true })).toBe("");
  });
});

describe("DateTimePicker — R1 adversarial", () => {
  function formulario() {
    return createElement("form", null,
      createElement(DateTimePicker, { name: "quando", required: true, value: "", "aria-label": "Quando" }),
      createElement("button", { type: "submit" }, "Salvar"),
    );
  }

  it("M16: onInvalid do espelho revela o erro sem blur do gatilho", async () => {
    render(formulario());
    const gatilho = screen.getByRole("button", { name: "Quando" });
    expect(document.activeElement).not.toBe(gatilho);
    expect(screen.queryByRole("alert")).toBeNull();
    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("form ausente");
    form.requestSubmit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(ERRO));
    expect(document.activeElement).toBe(gatilho);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("M23: blur com relatedTarget dentro do popover não revela o erro; blur para fora revela", () => {
    render(formulario());
    const gatilho = screen.getByRole("button", { name: "Quando" });
    const popover = document.createElement("div");
    popover.setAttribute("data-seletor-data-hora", "");
    const dia = document.createElement("button");
    dia.type = "button";
    dia.textContent = "15";
    popover.appendChild(dia);
    document.body.appendChild(popover);
    fireEvent.blur(gatilho, { relatedTarget: dia });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(gatilho.hasAttribute("aria-invalid")).toBe(false);

    const fora = document.createElement("button");
    fora.type = "button";
    fora.textContent = "Fora";
    document.body.appendChild(fora);
    fireEvent.blur(gatilho, { relatedTarget: fora });
    expect(screen.getByRole("alert").textContent).toContain(ERRO);
    expect(gatilho.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    popover.remove();
    fora.remove();
  });

  it("C4: reset do form zera o erro já revelado", () => {
    render(formulario());
    const gatilho = screen.getByRole("button", { name: "Quando" });
    fireEvent.blur(gatilho, { relatedTarget: null });
    expect(screen.getByRole("alert").textContent).toContain(ERRO);
    expect(gatilho.getAttribute("aria-invalid")).toBe("true");
    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("form ausente");
    act(() => { form.reset(); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(gatilho.hasAttribute("aria-invalid")).toBe(false);
  });
});
