import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BadgeEstado, CLASSES_TOM, PONTO_TOM, TEXTO_TOM, type PropsBadgeEstado, type TomEstado } from "./BadgeEstado";

const TONS: TomEstado[] = [
  "brand", "humano", "sucesso", "aviso", "aprovacao", "sem-resposta",
  "perigo", "handoff", "atraso", "ia", "frio", "neutro",
];

const html = (props: Partial<Parameters<typeof BadgeEstado>[0]> = {}) => {
  const { children = "Estado", ...resto } = props;
  return renderToStaticMarkup(createElement(BadgeEstado, { tom: "neutro", ...resto } as PropsBadgeEstado, children));
};

describe("BadgeEstado", () => {
  it("cobre os 12 tons com par de fundo e texto da mesma família", () => {
    expect(Object.keys(CLASSES_TOM)).toEqual(TONS);
    expect(Object.keys(PONTO_TOM)).toEqual(TONS);
    expect(Object.keys(TEXTO_TOM)).toEqual(TONS);
    const familia = (tom: TomEstado) =>
      tom === "brand" || tom === "humano" || tom === "sucesso" ? "brand"
      : tom === "aviso" || tom === "aprovacao" || tom === "sem-resposta" ? "warning"
      : tom === "perigo" || tom === "handoff" || tom === "atraso" ? "danger"
      : tom === "ia" || tom === "frio" ? "info"
      : "neutro";
    for (const tom of TONS) {
      const par = familia(tom);
      if (par === "neutro") {
        expect(CLASSES_TOM.neutro).toBe("bg-surface-muted text-gray-600");
        expect(TEXTO_TOM.neutro).toBe("text-gray-600");
        expect(PONTO_TOM.neutro).toBe("bg-gray-500");
      } else {
        expect(CLASSES_TOM[tom]).toContain(`var(--${par}-soft)`);
        expect(CLASSES_TOM[tom]).toContain(`var(--${par}-text)`);
        expect(CLASSES_TOM[tom]).not.toMatch(/var\(--(?!brand|warning|danger|info|neutral)[a-z]+-/);
      }
      expect(html({ tom })).toContain(CLASSES_TOM[tom]);
    }
    expect(TEXTO_TOM.humano).toBe("text-brand-700");
    expect(PONTO_TOM.atraso).toBe("bg-red-600");
    expect(PONTO_TOM["sem-resposta"]).toContain("bg-[var(--warning-solid)]");
    expect(PONTO_TOM.brand).toBe("bg-brand-solid");
    expect(PONTO_TOM.perigo).toBe("bg-[var(--danger-solid)]");
    expect(PONTO_TOM.ia).toBe("bg-[var(--info-solid)]");
  });

  it("ponto, tracejado, ícone, aria-label, role e className", () => {
    expect(html({ tom: "ia" })).toContain("bg-current");
    const semPonto = html({ tom: "ia", ponto: false });
    expect(semPonto).not.toContain("bg-current");
    expect(semPonto).toContain("font-semibold");
    const neutro = html({ tom: "neutro", ponto: false });
    expect(neutro).not.toContain("font-semibold");
    expect(neutro).toContain("font-normal");
    const tracejado = html({ tom: "neutro", tracejado: true, ponto: false });
    expect(tracejado).toContain("border-dashed");
    expect(tracejado).toContain("border-gray-200");
    expect(tracejado).not.toContain("bg-surface-muted");
    expect(tracejado).not.toContain("bg-[var(--brand-soft)]");
    const comIcone = html({
      tom: "atraso",
      ponto: false,
      icone: createElement("svg", { "aria-label": "Relógio" }),
      "aria-label": "Prazo estourado",
      role: "status",
      className: "ms-1",
      children: "Atraso",
    });
    expect(comIcone).toContain('aria-label="Relógio"');
    expect(comIcone).toContain('aria-label="Prazo estourado"');
    expect(comIcone).toContain('role="status"');
    expect(comIcone).toContain("ms-1");
    expect(comIcone).toContain("Atraso");
  });
});
