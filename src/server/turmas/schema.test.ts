import { describe, it, expect } from "vitest";
import { TurmaSchema } from "./schema";

const base = { modalidadeId: "m1", nivelId: "n1" };

describe("TurmaSchema.diasHorario (opcional — alinhado ao Prisma/banco)", () => {
  it("aceita turma sem diasHorario (a definir)", () => {
    const r = TurmaSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.diasHorario).toBeUndefined();
  });

  it("normaliza string vazia para undefined (vira null ao persistir)", () => {
    const r = TurmaSchema.safeParse({ ...base, diasHorario: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.diasHorario).toBeUndefined();
  });

  it("preserva o horário quando informado", () => {
    const r = TurmaSchema.safeParse({ ...base, diasHorario: "Ter/Qui 20h" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.diasHorario).toBe("Ter/Qui 20h");
  });

  it("ainda exige modalidade e nível", () => {
    expect(TurmaSchema.safeParse({ nivelId: "n1" }).success).toBe(false);
    expect(TurmaSchema.safeParse({ modalidadeId: "m1" }).success).toBe(false);
  });
});
