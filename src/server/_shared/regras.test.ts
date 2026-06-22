import { describe, it, expect } from "vitest";
import { EtapaLead, Papel } from "@prisma/client";
import {
  calcularComissao,
  vencimentoMensalidade,
  ehEtapaManual,
  podeAtribuirOutroDono,
  resolverDonoLead,
} from "./regras";

describe("calcularComissao", () => {
  it("é a porcentagem da taxa", () => {
    expect(calcularComissao(299, 20)).toBeCloseTo(59.8);
    expect(calcularComissao(20000, 20)).toBe(4000);
    expect(calcularComissao(1000, 0)).toBe(0);
  });
});

describe("vencimentoMensalidade", () => {
  const base = new Date(2026, 5, 18); // junho/2026

  it("usa o dia escolhido no mês atual (offset 0)", () => {
    const { data, competencia } = vencimentoMensalidade(5, 0, base);
    expect(data.getDate()).toBe(5);
    expect(competencia).toBe("2026-06");
  });

  it("avança meses com o offset (vira o ano)", () => {
    expect(vencimentoMensalidade(10, 1, base).competencia).toBe("2026-07");
    expect(vencimentoMensalidade(10, 7, base).competencia).toBe("2027-01");
  });
});

describe("ehEtapaManual", () => {
  it("aceita etapas do funil normal", () => {
    expect(ehEtapaManual(EtapaLead.NOVO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.PROPOSTA)).toBe(true);
  });
  it("recusa etapas de fluxo próprio (Perdido / Matriculado)", () => {
    expect(ehEtapaManual(EtapaLead.PERDIDO)).toBe(false);
    expect(ehEtapaManual(EtapaLead.MATRICULADO)).toBe(false);
  });
});

describe("podeAtribuirOutroDono", () => {
  it("permite gerente comercial e admin", () => {
    expect(podeAtribuirOutroDono([Papel.GERENTE_COMERCIAL])).toBe(true);
    expect(podeAtribuirOutroDono([Papel.ADMINISTRADOR])).toBe(true);
  });
  it("nega vendedor", () => {
    expect(podeAtribuirOutroDono([Papel.VENDEDOR])).toBe(false);
    expect(podeAtribuirOutroDono([])).toBe(false);
  });
});

describe("resolverDonoLead", () => {
  it("vendedor sempre vira o próprio dono, ignorando o id enviado", () => {
    const autor = { id: "v1", papeis: [Papel.VENDEDOR] };
    expect(resolverDonoLead(autor, "v2")).toBe("v1");
    expect(resolverDonoLead(autor, undefined)).toBe("v1");
    expect(resolverDonoLead(autor, "")).toBe("v1");
  });
  it("gerente atribui ao vendedor escolhido (ou nenhum)", () => {
    const autor = { id: "g1", papeis: [Papel.GERENTE_COMERCIAL] };
    expect(resolverDonoLead(autor, "v2")).toBe("v2");
    expect(resolverDonoLead(autor, undefined)).toBeNull();
  });
  it("admin atribui ao vendedor escolhido", () => {
    const autor = { id: "a1", papeis: [Papel.ADMINISTRADOR] };
    expect(resolverDonoLead(autor, "v2")).toBe("v2");
    expect(resolverDonoLead(autor, undefined)).toBeNull();
  });
  it("vendedor que também é gerente pode atribuir a outro", () => {
    const autor = { id: "g1", papeis: [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] };
    expect(resolverDonoLead(autor, "v2")).toBe("v2");
  });
});
