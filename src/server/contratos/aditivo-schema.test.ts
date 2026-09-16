import { describe, expect, it } from "vitest";
import { PrepararAditivoContratualSchema } from "./aditivo-schema";

const base = { matriculaId: "m1", conclusaoOriginalId: "c1", conclusaoHashEsperado: "a".repeat(64), modeloId: "modelo1", modeloHashEsperado: "b".repeat(64), vigenciaInicio: "2027-01-01T00:00:00.000Z", motivo: "Motivo suficiente", chaveIdempotencia: "chave-123" };

describe("PrepararAditivoContratualSchema", () => {
  it("preserva alteração legada sem valor estruturado", () => {
    const d = PrepararAditivoContratualSchema.parse({ ...base, alteracoes: [{ origem: "ALUNO_NOME", novo: "Ana" }] });
    expect(d.alteracoes[0]).not.toHaveProperty("valorEstruturado");
  });

  it("exige texto novo canônico quando há valor estruturado", () => {
    expect(PrepararAditivoContratualSchema.parse({ ...base, alteracoes: [{ origem: "TAXA_VALOR", novo: "12.50 BRL", valorEstruturado: { tipo: "DINHEIRO", valor: "12.5", moeda: "BRL" } }] }).alteracoes[0]?.novo).toBe("12.50 BRL");
    expect(() => PrepararAditivoContratualSchema.parse({ ...base, alteracoes: [{ origem: "TAXA_VALOR", novo: "R$ 12,50", valorEstruturado: { tipo: "DINHEIRO", valor: "12.5", moeda: "BRL" } }] })).toThrow(/representação canônica/);
  });

  it("não aceita agenda tipada enquanto a referência não está integrada", () => {
    expect(() => PrepararAditivoContratualSchema.parse({ ...base, alteracoes: [{ origem: "AGENDA_PARTICULAR", novo: "Agenda", valorEstruturado: { tipo: "AGENDA", propostaAgendaId: "p1" } }] })).toThrow(/integração própria/);
  });
});
