import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/popover", async () => {
  const React = await import("react");
  return {
    Popover: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    PopoverTrigger: ({ children }: { children?: React.ReactNode }) => children ?? null,
    PopoverAnchor: ({ children }: { children?: React.ReactNode }) => children ?? null,
    PopoverContent: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  };
});
vi.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));

import { DateTimePicker } from "@/components/ui/date-time-picker";

describe("DateTimePicker — hora e minuto", () => {
  it("não usa select nativo: hora e minuto são combobox do Select, com as listas 00–23 e 00–59", () => {
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
    const fonte = readFileSync(new URL("./date-time-picker.tsx", import.meta.url), "utf8");
    expect(fonte).not.toMatch(/<select\b/);
    expect(fonte).toContain("opcoes={HORAS}");
    expect(fonte).toContain("opcoes={MINUTOS}");
    expect(fonte).toContain("<SelectGroup>");
    expect(fonte).toContain("<SelectItem");
  });
});
