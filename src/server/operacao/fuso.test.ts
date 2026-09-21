import { describe, expect, it } from "vitest";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "./fuso";
describe("data civil institucional", () => {
  it("mesmo instante pode ser datas diferentes no Brasil e Costa Rica", () => {
    const instante = new Date("2026-09-12T04:00:00Z");
    expect(dataCivilInstitucional(instante, "America/Sao_Paulo")).toBe("2026-09-12");
    expect(dataCivilInstitucional(instante, "America/Costa_Rica")).toBe("2026-09-11");
  });
  it("respeita regras sazonais do fuso", () => {
    expect(dataCivilInstitucional(new Date("2026-01-10T04:30:00Z"), "America/New_York")).toBe("2026-01-09");
    expect(dataCivilInstitucional(new Date("2026-07-10T04:30:00Z"), "America/New_York")).toBe("2026-07-10");
  });
  it.each(["", "Brasil", "+03:00", "America/Inexistente"])("não presume fuso para %s", (valor) => {
    expect(FusoInstitucionalSchema.safeParse(valor).success).toBe(false);
  });
});
