import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LinhaCampo } from "./LinhaCampo";

const html = (extra: { ia?: boolean; mono?: boolean; valor?: string } = {}) =>
  renderToStaticMarkup(createElement(LinhaCampo, {
    icone: "☎",
    valor: extra.valor ?? "+5500000000301",
    rotulo: "WhatsApp",
    ia: extra.ia,
    mono: extra.mono,
  }));

describe("LinhaCampo", () => {
  it("mostra ícone, valor e rótulo com a métrica do protótipo", () => {
    const h = html();
    for (const t of [
      "☎", "+5500000000301", "WhatsApp",
      "mt-[3px]", "shrink-0", "text-gray-500",
      "break-words", "text-[14.5px]", "font-normal", "leading-[1.3]", "text-gray-800",
      "mt-0.5", "text-[12.5px]", "leading-[1.2]", "text-gray-600",
    ]) expect(h).toContain(t);
    expect(h).not.toContain("Preenchido pela Aria");
    expect(h).not.toContain("font-mono");
  });

  it("selo ia e mono no valor", () => {
    const ia = html({ ia: true });
    expect(ia).toContain('aria-label="Preenchido pela Aria"');
    expect(ia).toContain("text-ai-700");
    expect(ia).toContain('width="11"');
    const mono = html({ mono: true, valor: "123.456.789-00" });
    expect(mono).toContain("font-mono");
    expect(mono).toContain("tabular-nums");
    expect(mono).toContain("123.456.789-00");
    expect(mono).toMatch(/font-mono tabular-nums[^"]*">123\.456\.789-00</);
  });
});
