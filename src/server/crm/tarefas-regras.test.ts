import { describe, expect, it } from "vitest";
import { grupoDaTarefa } from "./tarefas-regras";

const CR = "America/Costa_Rica";

describe("grupoDaTarefa", () => {
  it("usa a data civil do fuso institucional perto da meia-noite", () => {
    const agora = new Date("2026-10-16T05:00:00Z"); // 23:00 de 15/10 em CR
    expect(grupoDaTarefa({ dataCivil: "2026-10-15", inicioEm: new Date("2026-10-16T05:30:00Z"), status: "ABERTA" }, agora, CR)).toBe("HOJE");
    expect(grupoDaTarefa({ dataCivil: "2026-10-16", inicioEm: null, status: "ABERTA" }, agora, CR)).toBe("AMANHA");
  });
  it("atrasada é consistente: dia anterior ou hoje com horário passado", () => {
    const agora = new Date("2026-10-15T18:00:00Z");
    expect(grupoDaTarefa({ dataCivil: "2026-10-15", inicioEm: new Date("2026-10-15T15:00:00Z"), status: "ABERTA" }, agora, CR)).toBe("ATRASADAS");
    expect(grupoDaTarefa({ dataCivil: "2026-10-14", inicioEm: null, status: "ABERTA" }, agora, CR)).toBe("ATRASADAS");
    expect(grupoDaTarefa({ dataCivil: null, inicioEm: null, status: "ABERTA" }, agora, CR)).toBe("SEM_DATA");
    expect(grupoDaTarefa({ dataCivil: "2026-10-14", inicioEm: null, status: "CONCLUIDA" }, agora, CR)).toBe("CONCLUIDAS");
    expect(grupoDaTarefa({ dataCivil: "2026-10-22", inicioEm: null, status: "ABERTA" }, agora, CR)).toBe("PROXIMOS_7");
    expect(grupoDaTarefa({ dataCivil: "2026-10-23", inicioEm: null, status: "ABERTA" }, agora, CR)).toBe("DEPOIS");
  });
  it("hoje sem horário, hoje com horário futuro e cancelada", () => {
    const agora = new Date("2026-10-15T18:00:00Z");
    expect(grupoDaTarefa({ dataCivil: "2026-10-15", inicioEm: null, status: "ABERTA" }, agora, CR)).toBe("HOJE");
    expect(grupoDaTarefa({ dataCivil: "2026-10-15", inicioEm: new Date("2026-10-15T20:00:00Z"), status: "ABERTA" }, agora, CR)).toBe("HOJE");
    expect(grupoDaTarefa({ dataCivil: "2026-10-17", inicioEm: null, status: "ABERTA" }, agora, CR)).toBe("PROXIMOS_7");
    expect(grupoDaTarefa({ dataCivil: "2026-10-15", inicioEm: null, status: "CANCELADA" }, agora, CR)).toBe("CONCLUIDAS");
  });
});
