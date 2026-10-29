// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HORAS, MINUTOS } from "@/components/ui/datas";

// Sem este cast, o tsc contextualiza a fábrica no tipo do Popover/Calendar e o heap do typecheck passa de 5120 MB.
vi.mock("@/components/ui/popover", (async () => {
  const React = await import("react");
  return {
    Popover: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    PopoverTrigger: ({ children }: { children?: React.ReactNode }) => children ?? null,
    PopoverAnchor: ({ children }: { children?: React.ReactNode }) => children ?? null,
    PopoverContent: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  };
}) as () => Promise<Record<string, unknown>>);
vi.mock("@/components/ui/calendar", (() => ({ Calendar: () => null })) as () => Record<string, unknown>);

import { DateTimePicker } from "@/components/ui/date-time-picker";

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

describe("DateTimePicker — hora e minuto", () => {
  it("não usa select nativo: hora e minuto são combobox do Select", () => {
    const html = renderToStaticMarkup(createElement(DateTimePicker, { name: "quando", value: "2026-12-01T13:05", fuso: "UTC" }));
    expect(html).not.toMatch(/<select\b[^>]*aria-label="Hora"/);
    expect(html).not.toMatch(/<select\b[^>]*aria-label="Minuto"/);
    expect(html).not.toMatch(/<select\b(?![^>]*aria-hidden="true")[^>]*>/);
    expect(html).toContain(">Hora<");
    expect(html).toContain(">Minuto<");
    expect(html.match(/role="combobox"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain(">13<");
    expect(html).toContain(">05<");
    expect(html).toContain('aria-autocomplete="none"');
  });

  it("abre as listas 00–23 e 00–59 como opções do Select, sem select nativo visível", async () => {
    const user = userEvent.setup();
    render(createElement(DateTimePicker, { name: "quando", value: "2026-12-01T13:05", fuso: "UTC" }));
    for (const select of document.querySelectorAll("select")) {
      expect(select.getAttribute("aria-hidden")).toBe("true");
      expect(select.getAttribute("aria-label")).not.toBe("Hora");
      expect(select.getAttribute("aria-label")).not.toBe("Minuto");
    }

    await user.click(screen.getByRole("combobox", { name: "Hora" }));
    const horas = await screen.findAllByRole("option");
    expect(horas.map((opcao) => opcao.textContent)).toEqual([...HORAS]);
    expect(horas[0]?.closest("[role='group']")).toBeTruthy();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: "Minuto" }));
    const minutos = await screen.findAllByRole("option");
    expect(minutos.map((opcao) => opcao.textContent)).toEqual([...MINUTOS]);
    expect(minutos[0]?.closest("[role='group']")).toBeTruthy();
  });
});
