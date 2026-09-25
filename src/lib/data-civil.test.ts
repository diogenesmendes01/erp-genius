import { describe, expect, it } from "vitest";
import { formatarCompetencia, formatarDataCivil } from "./data-civil";

describe("datas civis e competências (E5)", () => {
  it("data civil ISO → dd/mm/aaaa, sem passar por instante (não muda de dia com o fuso)", () => {
    expect(formatarDataCivil("2026-10-15")).toBe("15/10/2026");
    expect(formatarDataCivil("2026-01-01")).toBe("01/01/2026");
  });

  it("competência aaaa-mm → mm/aaaa", () => {
    expect(formatarCompetencia("2026-10")).toBe("10/2026");
  });

  it("ausente vira \"—\"; texto de outra forma volta como está (nunca inventa uma data)", () => {
    for (const f of [formatarDataCivil, formatarCompetencia]) {
      expect(f(null)).toBe("—");
      expect(f(undefined)).toBe("—");
      expect(f("")).toBe("—");
      expect(f("pendente")).toBe("pendente");
    }
    expect(formatarDataCivil("2026-10")).toBe("2026-10");
    expect(formatarCompetencia("2026-10-15")).toBe("2026-10-15");
    expect(formatarDataCivil("2026-10-15T03:00:00.000Z")).toBe("2026-10-15T03:00:00.000Z");
  });
});
