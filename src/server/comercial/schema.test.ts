import { describe, it, expect } from "vitest";
import { TIPOS_MUDAM_ETAPA, ETAPAS_MANUAIS } from "./schema";

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
