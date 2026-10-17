import { describe, expect, it } from "vitest";
import { motivoConfiguracaoAgendaInvalida } from "./whatsapp";

type Cfg = Parameters<typeof motivoConfiguracaoAgendaInvalida>[0];
const cfg = (n: { driver: string; providerRef?: string | null }, t: { statusMeta: string; metaTemplateId: string | null; categoria?: string; corpo?: string }): Cfg => ({
  numeroAvisosAgendaId: "n1",
  templateAvisosAgendaId: "t1",
  numeroAvisosAgenda: { id: "n1", ativo: true, finalidade: "AGENDA", driver: n.driver, providerRef: n.providerRef ?? "n1" },
  templateAvisosAgenda: { id: "t1", corpo: t.corpo ?? "Olá {nome}, aulas: {horarios}", idioma: "es", categoria: t.categoria ?? "marketing", statusMeta: t.statusMeta, metaTemplateId: t.metaTemplateId },
});

describe("motivoConfiguracaoAgendaInvalida", () => {
  it("número AGENDA MOTOR + template RASCUNHO renderizável é válido", () => {
    expect(motivoConfiguracaoAgendaInvalida(cfg({ driver: "MOTOR" }, { statusMeta: "RASCUNHO", metaTemplateId: null }), "es")).toBeNull();
  });
  it("MOTOR continua exigindo template renderizável com {horarios}", () => {
    expect(motivoConfiguracaoAgendaInvalida(cfg({ driver: "MOTOR" }, { statusMeta: "RASCUNHO", metaTemplateId: null, corpo: "Olá {nome}" }), "es")).toBe("template_agenda_incompativel");
  });
  it("META_CLOUD segue exigindo template aprovado utility", () => {
    expect(motivoConfiguracaoAgendaInvalida(cfg({ driver: "META_CLOUD" }, { statusMeta: "RASCUNHO", metaTemplateId: null }), "es")).toBe("template_agenda_incompativel");
    expect(motivoConfiguracaoAgendaInvalida(cfg({ driver: "META_CLOUD" }, { statusMeta: "APROVADO", metaTemplateId: "m1", categoria: "utility" }), "es")).toBeNull();
  });
  it("BAILEYS legado é inválido", () => {
    expect(motivoConfiguracaoAgendaInvalida(cfg({ driver: "BAILEYS" }, { statusMeta: "APROVADO", metaTemplateId: "m1", categoria: "utility" }), "es")).toBe("numero_agenda_invalido");
  });
});
