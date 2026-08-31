import { describe, expect, it } from "vitest";
import { EtapaLead, Segmento, Temperatura } from "@prisma/client";
import { driverSimulado } from "./driver-simulado";
import type { ContextoAnalise } from "./tipos";

// Driver SIMULADO (C3): heurística determinística — o contrato importante é ser
// CONSERVADOR (sem evidência → null) e nunca sugerir o que já está igual no CRM.

function ctxBase(over: Partial<ContextoAnalise["lead"]> = {}, mensagens: ContextoAnalise["mensagens"] = []): ContextoAnalise {
  return {
    lead: {
      nome: "Ana",
      etapa: EtapaLead.NOVO,
      temperatura: Temperatura.MORNO,
      segmento: Segmento.ADULTO,
      b2b: false,
      criadoEmISO: new Date().toISOString(),
      dataExperimentalISO: null,
      resumoAtual: { interesse: null, objetivo: null, urgencia: null, orcamento: null, objecao: null, proximaAcao: null },
      etapasPermitidas: [EtapaLead.EM_ATENDIMENTO],
      ...over,
    },
    mensagens,
    notasInternas: [],
  };
}

const agora = () => new Date().toISOString();

describe("driverSimulado", () => {
  it("sem mensagens → nada a sugerir (conservador)", async () => {
    const a = await driverSimulado.analisar(ctxBase());
    expect(a.resumo).toBeNull();
    expect(a.temperatura).toBeNull();
    expect(a.segmento).toBeNull();
    expect(a.etapaSugerida).toBeNull();
  });

  it("menção a filho → segmento KIDS; preço → orçamento no resumo", async () => {
    const a = await driverSimulado.analisar(
      ctxBase({}, [
        { direcao: "ENTRADA", corpo: "Quero aula para meu filho. Quanto custa?", quandoISO: agora() },
      ]),
    );
    expect(a.segmento).toBe(Segmento.KIDS);
    expect(a.resumo?.orcamento).toContain("preço");
  });

  it("não sugere temperatura igual à atual", async () => {
    const a = await driverSimulado.analisar(
      ctxBase({ temperatura: Temperatura.MORNO }, [
        { direcao: "ENTRADA", corpo: "Oi!", quandoISO: agora() },
      ]),
    );
    expect(a.temperatura).toBeNull(); // 1 entrada recente = MORNO = atual → null
  });

  it("NOVO + escola já respondeu → sugere EM_ATENDIMENTO (dentro dos destinos permitidos)", async () => {
    const a = await driverSimulado.analisar(
      ctxBase({}, [
        { direcao: "ENTRADA", corpo: "Olá!", quandoISO: agora() },
        { direcao: "SAIDA", corpo: "Oi! Como posso ajudar?", quandoISO: agora() },
      ]),
    );
    expect(a.etapaSugerida).toBe(EtapaLead.EM_ATENDIMENTO);
  });

  it("etapa fora dos destinos permitidos nunca é sugerida", async () => {
    const a = await driverSimulado.analisar(
      ctxBase({ etapasPermitidas: [] }, [
        { direcao: "ENTRADA", corpo: "Olá!", quandoISO: agora() },
        { direcao: "SAIDA", corpo: "Oi!", quandoISO: agora() },
      ]),
    );
    expect(a.etapaSugerida).toBeNull();
  });
});
