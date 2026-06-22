import { describe, it, expect } from "vitest";
import { DatasSchema } from "./schema";

describe("DatasSchema — dataExperimental preserva horário (issue #16)", () => {
  it("aceita datetime-local e mantém a hora agendada", () => {
    const r = DatasSchema.parse({ dataExperimental: "2026-06-22T14:30" });
    const d = r.dataExperimental as Date;
    expect(d).toBeInstanceOf(Date);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it("aceita data simples (date-only) sem hora explícita → meio-dia local", () => {
    const r = DatasSchema.parse({ dataExperimental: "2026-06-22" });
    const d = r.dataExperimental as Date;
    expect(d.getHours()).toBe(12);
    expect(d.getDate()).toBe(22);
  });

  it("proximoFollowUp e dataProposta continuam date-only (meio-dia local)", () => {
    const r = DatasSchema.parse({
      proximoFollowUp: "2026-07-01",
      dataProposta: "2026-07-05",
    });
    expect((r.proximoFollowUp as Date).getHours()).toBe(12);
    expect((r.dataProposta as Date).getHours()).toBe(12);
  });

  it("campos vazios viram undefined (não sobrescrevem)", () => {
    const r = DatasSchema.parse({ dataExperimental: "", proximoFollowUp: "", dataProposta: "" });
    expect(r.dataExperimental).toBeUndefined();
    expect(r.proximoFollowUp).toBeUndefined();
    expect(r.dataProposta).toBeUndefined();
  });
});
