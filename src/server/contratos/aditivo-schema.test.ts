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

  it("aceita agenda tipada somente com referência e texto da fotografia", () => {
    expect(PrepararAditivoContratualSchema.parse({ ...base, alteracoes: [{ origem: "AGENDA_PARTICULAR", novo: "Agenda aprovada", valorEstruturado: { tipo: "AGENDA", propostaAgendaId: "p1", texto: "Agenda aprovada" } }] }).alteracoes[0]?.valorEstruturado).toMatchObject({ tipo: "AGENDA", propostaAgendaId: "p1" });
  });
});

describe("ciclo futuro de cobertura", () => {
  const alteracoesCobertura = [
    { origem: "COBERTURA_INICIO", novo: "2027-02-01", valorEstruturado: { tipo: "DATA", data: "2027-02-01" } },
    { origem: "COBERTURA_FIM", novo: "2027-02-28", valorEstruturado: { tipo: "DATA", data: "2027-02-28" } },
  ];
  it("vincula a escolha formalizada à alteração dos dois extremos", () => {
    expect(PrepararAditivoContratualSchema.parse({ ...base, alteracoes: alteracoesCobertura, cicloCoberturaFutura: { escolha: "MUDAR_REFERENCIA", referencia: "CICLO_MATRICULA", dataReferencia: "2027-03-01" } }).cicloCoberturaFutura).toMatchObject({ escolha: "MUDAR_REFERENCIA" });
    expect(() => PrepararAditivoContratualSchema.parse({ ...base, alteracoes: alteracoesCobertura })).toThrow(/referências dos ciclos futuros/);
  });
  it("não aceita a política futura fora de uma correção de cobertura", () => {
    expect(() => PrepararAditivoContratualSchema.parse({ ...base, alteracoes: [{ origem: "ALUNO_NOME", novo: "Ana" }], cicloCoberturaFutura: { escolha: "PRESERVAR_REFERENCIA" } })).toThrow(/só integra aditivo/);
  });
});
