import { describe, it, expect } from "vitest";
import { EtapaLead } from "@prisma/client";
import {
  calcularComissao,
  vencimentoMensalidade,
  ehEtapaManual,
  transicaoManualPermitida,
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
  it("aceita as etapas que o vendedor controla por arraste", () => {
    expect(ehEtapaManual(EtapaLead.NOVO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.EM_ATENDIMENTO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.QUALIFICADO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.EXPERIMENTAL_AGENDADA)).toBe(true);
  });
  it("recusa etapas geradas por evento de domínio", () => {
    expect(ehEtapaManual(EtapaLead.EXPERIMENTAL_REALIZADA)).toBe(false);
    expect(ehEtapaManual(EtapaLead.PROPOSTA)).toBe(false);
    expect(ehEtapaManual(EtapaLead.AGUARDANDO_MATRICULA)).toBe(false);
  });
  it("recusa etapas de fluxo próprio (Perdido / Matriculado / No-show)", () => {
    expect(ehEtapaManual(EtapaLead.PERDIDO)).toBe(false);
    expect(ehEtapaManual(EtapaLead.MATRICULADO)).toBe(false);
    expect(ehEtapaManual(EtapaLead.NO_SHOW)).toBe(false);
  });
});

describe("transicaoManualPermitida", () => {
  it("permite o avanço passo-a-passo no trecho do vendedor", () => {
    expect(transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.EM_ATENDIMENTO)).toBe(true);
    expect(transicaoManualPermitida(EtapaLead.EM_ATENDIMENTO, EtapaLead.QUALIFICADO)).toBe(true);
    expect(
      transicaoManualPermitida(EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA),
    ).toBe(true);
  });

  it("permite correções voltando uma casa", () => {
    expect(transicaoManualPermitida(EtapaLead.QUALIFICADO, EtapaLead.EM_ATENDIMENTO)).toBe(true);
    expect(
      transicaoManualPermitida(EtapaLead.EXPERIMENTAL_AGENDADA, EtapaLead.QUALIFICADO),
    ).toBe(true);
  });

  it("trata mesma etapa como no-op permitido", () => {
    expect(transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.NOVO)).toBe(true);
  });

  it("bloqueia saltos para etapas geradas por evento", () => {
    // pular a experimental e ir direto para realizada/proposta/aguardando
    expect(
      transicaoManualPermitida(EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_REALIZADA),
    ).toBe(false);
    expect(transicaoManualPermitida(EtapaLead.QUALIFICADO, EtapaLead.PROPOSTA)).toBe(false);
    expect(
      transicaoManualPermitida(EtapaLead.EXPERIMENTAL_AGENDADA, EtapaLead.AGUARDANDO_MATRICULA),
    ).toBe(false);
  });

  it("bloqueia saltos para saídas paralelas e matrícula", () => {
    expect(transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.PERDIDO)).toBe(false);
    expect(transicaoManualPermitida(EtapaLead.PROPOSTA, EtapaLead.MATRICULADO)).toBe(false);
    expect(transicaoManualPermitida(EtapaLead.EXPERIMENTAL_AGENDADA, EtapaLead.NO_SHOW)).toBe(
      false,
    );
  });

  it("bloqueia pular etapas para frente (Novo → Qualificado)", () => {
    expect(transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.QUALIFICADO)).toBe(false);
    expect(
      transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.EXPERIMENTAL_AGENDADA),
    ).toBe(false);
  });

  it("permite retomar o trabalho manual após etapas de evento", () => {
    // pós no-show ou pós-experimental, o vendedor reagenda ou requalifica
    expect(
      transicaoManualPermitida(EtapaLead.NO_SHOW, EtapaLead.EXPERIMENTAL_AGENDADA),
    ).toBe(true);
    expect(
      transicaoManualPermitida(EtapaLead.EXPERIMENTAL_REALIZADA, EtapaLead.QUALIFICADO),
    ).toBe(true);
    // mas nunca avançar para outra etapa de evento manualmente
    expect(
      transicaoManualPermitida(EtapaLead.PROPOSTA, EtapaLead.AGUARDANDO_MATRICULA),
    ).toBe(false);
  });
});
