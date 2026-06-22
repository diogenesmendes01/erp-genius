import { describe, it, expect } from "vitest";
import { TIPOS_MUDAM_ETAPA, ETAPAS_MANUAIS, DatasSchema } from "./schema";

describe("TIPOS_MUDAM_ETAPA", () => {
  it("inclui a mudança manual de etapa", () => {
    expect(TIPOS_MUDAM_ETAPA).toContain("EtapaAlterada");
  });

  it("inclui as ações que avançam o funil sem 'EtapaAlterada' explícito", () => {
    // Estes eventos mudam a etapa do lead diretamente (ver acoes.ts) e por isso
    // precisam contar para o `etapaDesde` (issue #15).
    for (const tipo of [
      "ExperimentalAgendada",
      "ExperimentalRealizada",
      "NoShow",
      "PropostaEnviada",
      "LeadPerdido",
    ]) {
      expect(TIPOS_MUDAM_ETAPA).toContain(tipo);
    }
  });

  it("não contém duplicatas", () => {
    expect(new Set(TIPOS_MUDAM_ETAPA).size).toBe(TIPOS_MUDAM_ETAPA.length);
  });
});

describe("ETAPAS_MANUAIS", () => {
  it("não inclui as etapas de fluxo próprio (perdido/matriculado/no-show)", () => {
    expect(ETAPAS_MANUAIS).not.toContain("PERDIDO");
    expect(ETAPAS_MANUAIS).not.toContain("MATRICULADO");
    expect(ETAPAS_MANUAIS).not.toContain("NO_SHOW");
  });
});

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
