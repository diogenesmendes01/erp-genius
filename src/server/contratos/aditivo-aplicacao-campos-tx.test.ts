import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { carregarAplicacoesCamposTx } from "./aditivo-aplicacao-campos-tx";
import { hashSubstituicao } from "./substituicao-estado";

function contexto(inicio = "2027-02-01", fim = "2027-02-28") {
  const ciclo = { escolha: "PRESERVAR_REFERENCIA" };
  const snapshot = { entrada: {
    matriculaId: "m", conclusaoOriginalId: "c", conclusaoHashEsperado: "a".repeat(64),
    modeloId: "x", modeloHashEsperado: "b".repeat(64), vigenciaInicio: "2027-01-01T00:00:00.000Z",
    motivo: "Correção contratual justificada", chaveIdempotencia: "chave-123", cicloCoberturaFutura: ciclo,
    alteracoes: [
      { origem: "COBERTURA_INICIO", novo: "2027-02-01", valorEstruturado: { tipo: "DATA", data: "2027-02-01" } },
      { origem: "COBERTURA_FIM", novo: "2027-02-28", valorEstruturado: { tipo: "DATA", data: "2027-02-28" } },
    ],
  } };
  const impacto = {
    id: "i", classificacao: "AFETADA", coberturaInicioAnterior: new Date("2027-01-01"),
    coberturaFimAnterior: new Date("2027-01-31"), coberturaInicioNova: new Date(inicio),
    coberturaFimNova: new Date(fim), aplicacao: { id: "ap", fotografiaHash: "foto", aplicadaEm: new Date("2027-01-01") },
  };
  const versao = {
    id: "v", versao: 1, propostaId: "p", proposta: { snapshot, entradaHash: hashSubstituicao(snapshot), matriculaId: "m" },
    conjuntosImpactosTaxa: [], propostasVencimento: [], propostasAdiantamento: [], aplicacao: null,
    conjuntosImpactosCobertura: [{
      id: "conjunto", propostaAditivoId: "p", preparadorId: "fin1", hashFormalizado: hashSubstituicao(snapshot),
      fotografiaHash: "foto", cicloFuturo: ciclo,
      decisao: { id: "dec", aprovada: true, decisorId: "fin2", fotografiaHash: "foto" }, impactos: [impacto],
    }],
  };
  const tx = { versaoCondicoesAditivo: { findMany: vi.fn().mockResolvedValue([versao]) } } as unknown as Prisma.TransactionClient;
  return { tx, versao };
}

describe("prova de cobertura consumida pela cadeia contratual", () => {
  it("reconhece conjunto completo correspondente ao intervalo assinado", async () => {
    const { tx } = contexto();
    expect(await carregarAplicacoesCamposTx(tx, "m")).toEqual([expect.objectContaining({ conjuntoCoberturaCompletoId: "conjunto" })]);
  });

  it("recusa prova aparentemente completa que aplicou outro intervalo", async () => {
    const { tx } = contexto("2027-03-01", "2027-03-31");
    await expect(carregarAplicacoesCamposTx(tx, "m")).rejects.toThrow("não aplica a cobertura formalizada");
  });

  it("recusa sobreposição preservada mesmo quando há aplicação e aprovação", async () => {
    const { tx, versao } = contexto();
    const conjunto = versao.conjuntosImpactosCobertura[0];
    conjunto.impactos.push({ ...conjunto.impactos[0], id: "i2", classificacao: "PRESERVADA", aplicacao: null as never });
    await expect(carregarAplicacoesCamposTx(tx, "m")).rejects.toThrow("sobreposição");
  });
});
