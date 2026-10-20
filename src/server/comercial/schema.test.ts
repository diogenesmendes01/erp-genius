import { describe, it, expect } from "vitest";
import { TIPOS_MUDAM_ETAPA, ETAPAS_MANUAIS, DatasSchema as DatasSchemaBase } from "./schema";
import { comDatasDaEscola } from "@/server/_shared/validacao";

// As datas digitadas viram o meio-dia da escola (ref. #247); nas ações, o parse roda dentro de `comDatasDaEscola`.
const FUSO = "America/Sao_Paulo";
const DatasSchema = { parse: (v: unknown) => comDatasDaEscola(FUSO, () => DatasSchemaBase.parse(v)) };

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

  it("aceita data simples (date-only) sem hora explícita → meio-dia da escola", () => {
    const r = DatasSchema.parse({ dataExperimental: "2026-06-22" });
    expect(r.dataExperimental).toEqual(new Date("2026-06-22T15:00:00.000Z"));
  });

  it("proximoFollowUp e dataProposta continuam date-only (meio-dia da escola)", () => {
    const r = DatasSchema.parse({
      proximoFollowUp: "2026-07-01",
      dataProposta: "2026-07-05",
    });
    expect(r.proximoFollowUp).toEqual(new Date("2026-07-01T15:00:00.000Z"));
    expect(r.dataProposta).toEqual(new Date("2026-07-05T15:00:00.000Z"));
  });

  it("campos vazios viram undefined (não sobrescrevem)", () => {
    const r = DatasSchema.parse({ dataExperimental: "", proximoFollowUp: "", dataProposta: "" });
    expect(r.dataExperimental).toBeUndefined();
    expect(r.proximoFollowUp).toBeUndefined();
    expect(r.dataProposta).toBeUndefined();
  });
});
