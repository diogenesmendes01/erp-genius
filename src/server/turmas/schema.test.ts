import { describe, it, expect } from "vitest";
import {
  TurmaSchema,
  diasPorSemanaDaFrequencia,
  duracaoIntervaloEmMinutos,
  horarioFimPorDuracao,
  rotuloDiasHorario,
  emMinutos,
} from "./schema";

const base = {
  modalidadeId: "m1",
  nivelId: "n1",
  diasSemana: [1, 3],
  horarioInicio: "19:00",
  horarioFim: "21:00",
  dataInicio: "2026-09-01",
  dataFim: "2026-12-01",
};

describe("TurmaSchema — agenda estruturada", () => {
  it("aceita turma completa (dias + horário + período)", () => {
    const r = TurmaSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("exige modalidade e nível", () => {
    expect(TurmaSchema.safeParse({ ...base, modalidadeId: "" }).success).toBe(false);
    expect(TurmaSchema.safeParse({ ...base, nivelId: "" }).success).toBe(false);
  });

  it("exige ao menos um dia da semana", () => {
    expect(TurmaSchema.safeParse({ ...base, diasSemana: [] }).success).toBe(false);
  });

  it("valida o formato dos horários (HH:MM)", () => {
    expect(TurmaSchema.safeParse({ ...base, horarioInicio: "19h" }).success).toBe(false);
    expect(TurmaSchema.safeParse({ ...base, horarioFim: "25:00" }).success).toBe(false);
    expect(TurmaSchema.safeParse({ ...base, horarioInicio: "09:30", horarioFim: "11:00" }).success).toBe(true);
  });

  it("aceita aula que atravessa meia-noite e rejeita duração zero", () => {
    expect(TurmaSchema.safeParse({ ...base, horarioInicio: "22:00", horarioFim: "01:00" }).success).toBe(true);
    expect(TurmaSchema.safeParse({ ...base, horarioInicio: "19:00", horarioFim: "19:00" }).success).toBe(false);
  });

  it("exige início, mas permite ausência de data final e rejeita referência anterior", () => {
    expect(TurmaSchema.safeParse({ ...base, dataInicio: "" }).success).toBe(false);
    expect(TurmaSchema.safeParse({ ...base, dataFim: "" }).success).toBe(true);
    expect(TurmaSchema.safeParse({ ...base, dataFim: "2026-08-01" }).success).toBe(false);
  });
});

describe("frequência → dias por semana", () => {
  it("extrai o número da frequência", () => {
    expect(diasPorSemanaDaFrequencia("1x/semana")).toBe(1);
    expect(diasPorSemanaDaFrequencia("3x/semana")).toBe(3);
    expect(diasPorSemanaDaFrequencia("5x/semana")).toBe(5);
  });
  it("retorna null quando não há número (ex.: Particular)", () => {
    expect(diasPorSemanaDaFrequencia("critério do aluno")).toBeNull();
  });
});

describe("rótulo derivado dias/horário", () => {
  it("ordena os dias e anexa o intervalo de horário", () => {
    expect(rotuloDiasHorario([3, 1, 5], "19:00", "21:00")).toBe("Seg, Qua, Sex · 19:00–21:00");
  });
  it("emMinutos converte HH:MM", () => {
    expect(emMinutos("21:00")).toBe(1260);
    expect(emMinutos("09:30")).toBe(570);
  });
  it("deriva o fim e duração circular de uma aula noturna", () => {
    expect(duracaoIntervaloEmMinutos("22:00", "01:00")).toBe(180);
    expect(horarioFimPorDuracao("22:00", 180)).toEqual({ horarioFim: "01:00", atravessaDia: true });
  });
});
