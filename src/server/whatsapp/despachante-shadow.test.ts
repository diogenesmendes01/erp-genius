import { describe, expect, it } from "vitest";
import { decidirEnvio, intencaoEmShadow, type EntradaShadow } from "./despachante";

// Revisão R1 do #208 (C1): trava unitária da decisão de shadow. A isenção do aviso de agenda
// (`!agenda`) caiu no merge da #161 e só os *.int.test.ts perceberiam — que o CI não roda.
const base: EntradaShadow = {
  live: true,
  agenda: false,
  automatica: true,
  reativa: false,
  gestao: false,
  politicaEstado: "ATIVA",
  ia: false,
  ariaEstado: "ATIVA",
};
const shadow = (parcial: Partial<EntradaShadow>) => intencaoEmShadow({ ...base, ...parcial });

describe("intencaoEmShadow", () => {
  describe("política de cobrança DESLIGADA", () => {
    it("aviso de agenda NÃO vira SIMULADA", () => {
      expect(shadow({ agenda: true, politicaEstado: "DESLIGADA" })).toBe(false);
    });

    it("aviso de agenda NÃO vira SIMULADA com a política em SHADOW", () => {
      expect(shadow({ agenda: true, politicaEstado: "SHADOW" })).toBe(false);
    });


    it("cobrança comum vira SIMULADA", () => {
      expect(shadow({ politicaEstado: "DESLIGADA" })).toBe(true);
    });

    it("cobrança comum em SHADOW também vira SIMULADA", () => {
      expect(shadow({ politicaEstado: "SHADOW" })).toBe(true);
    });


    it("origem HUMANO NÃO vira SIMULADA (decisão humana envia mesmo em ensaio)", () => {
      expect(shadow({ automatica: false, politicaEstado: "DESLIGADA" })).toBe(false);
    });
  });

  it("política ATIVA com tudo ligado: envia de verdade", () => {
    expect(shadow({})).toBe(false);
    expect(shadow({ agenda: true })).toBe(false);
    expect(shadow({ automatica: false })).toBe(false);
  });

  it("sem WHATSAPP_LIVE simula tudo, inclusive agenda, gestão, reativa e HUMANO", () => {
    for (const parcial of [{}, { agenda: true }, { gestao: true }, { reativa: true }, { automatica: false }]) {
      expect(shadow({ ...parcial, live: false })).toBe(true);
    }
  });

  // Remoção do CRM antigo: a gestão (C5) e a saudação reativa perderam a configuração e o produtor. O que sobrar
  // na fila só simula (a gestão já é cancelada antes, em motivoIntencaoInvalida).
  it("gestão e reativa sem IA sempre viram SIMULADA, mesmo com a política ATIVA", () => {
    expect(shadow({ gestao: true })).toBe(true);
    expect(shadow({ reativa: true })).toBe(true);
    expect(shadow({ reativa: true, politicaEstado: "DESLIGADA" })).toBe(true);
  });

  // Revisão final da Fase 5C: a resposta da Aria (origem IA, reativa) não pode ficar presa ao
  // ensaio da saudação comercial; o ensaio dela é o estado da própria Aria.
  describe("origem IA", () => {
    const ia = { ia: true, reativa: true } as const;

    it("Aria ATIVA envia, mesmo com a política de cobrança DESLIGADA", () => {
      expect(shadow({ ...ia })).toBe(false);
      expect(shadow({ ...ia, politicaEstado: "DESLIGADA" })).toBe(false);
    });

    it("Aria fora de ATIVA no despacho vira SIMULADA", () => {
      expect(shadow({ ...ia, ariaEstado: "SHADOW" })).toBe(true);
      expect(shadow({ ...ia, ariaEstado: "DESLIGADA" })).toBe(true);
    });

    it("sem WHATSAPP_LIVE a Aria também só simula", () => {
      expect(shadow({ ...ia, live: false })).toBe(true);
    });

    it("ariaEstado não afeta quem não é IA", () => {
      expect(shadow({ ariaEstado: "DESLIGADA" })).toBe(false);
      expect(shadow({ agenda: true, ariaEstado: "DESLIGADA" })).toBe(false);
    });
  });
});

// Revisão R1 do #208 (C2): o cron geral também drena avisos de agenda. Com
// COMUNICACOES_AGENDA_ENVIO_ENABLED desligado o despachante retém o aviso na fila, sem
// enviar e sem transformá-lo em SIMULADA.
describe("decidirEnvio", () => {
  const decidir = (parcial: Partial<EntradaShadow & { envioAgendaHabilitado: boolean }>) =>
    decidirEnvio({ ...base, envioAgendaHabilitado: true, ...parcial });

  it("aviso de agenda com o envio de agenda desligado fica retido, nunca enviado", () => {
    expect(decidir({ agenda: true, envioAgendaHabilitado: false })).toBe("RETER_AGENDA");
  });

  it("a retenção vence o shadow: nem sem WHATSAPP_LIVE nem com a política DESLIGADA vira SIMULADA", () => {
    expect(decidir({ agenda: true, envioAgendaHabilitado: false, live: false })).toBe("RETER_AGENDA");
    expect(decidir({ agenda: true, envioAgendaHabilitado: false, politicaEstado: "DESLIGADA" })).toBe("RETER_AGENDA");
  });

  it("aviso de agenda com o envio ligado segue o shadow", () => {
    expect(decidir({ agenda: true })).toBe("ENVIAR");
    expect(decidir({ agenda: true, politicaEstado: "DESLIGADA" })).toBe("ENVIAR");
    expect(decidir({ agenda: true, live: false })).toBe("SIMULAR");
  });

  it("a flag de agenda não afeta cobrança, IA, gestão, reativa nem HUMANO", () => {
    for (const parcial of [{}, { ia: true, reativa: true }, { automatica: false }]) {
      expect(decidir({ ...parcial, envioAgendaHabilitado: false })).toBe("ENVIAR");
    }
    for (const parcial of [{ gestao: true }, { reativa: true }]) {
      expect(decidir({ ...parcial, envioAgendaHabilitado: false })).toBe("SIMULAR");
    }
    expect(decidir({ politicaEstado: "DESLIGADA", envioAgendaHabilitado: false })).toBe("SIMULAR");
  });
});
