import { describe, expect, it } from "vitest";
import { calcularReconferenciaDelta, type FatoDelta } from "./desistencia-reconferencia-delta-calculo";

const anterior = "a".repeat(64);
const atual = "b".repeat(64);
const fonte: FatoDelta = {
  cobrancaId: "taxa", moeda: "CRC", devidoAtual: "100.00", saldoAtual: "0.00",
  liquidado: "150.00", creditoJaApurado: "50.00", informePendente: false, permuta: "0.00",
};
const obrigacoes = { taxa: { devido: "100.00", moeda: "CRC" } };
const calcular = (alteracoes: Partial<FatoDelta> = {}) => calcularReconferenciaDelta([{ ...fonte, ...alteracoes }], obrigacoes, anterior, atual);

describe("reconferência financeira incremental", () => {
  it("credita apenas o recebimento adicional sem reabrir dívida pelo crédito anterior", () => {
    expect(calcular({ liquidado: "175.00" })).toMatchObject({ tipo: "APLICAR", itens: [{
      moeda: "CRC", devidoAlvo: "100.00", saldoAlvo: "0.00", ajusteDevido: "0.00", ajusteSaldo: "0.00", creditoDelta: "25.00",
    }] });
  });
  it("preserva o recebimento real quando o carregador exclui um informe rejeitado", () => {
    expect(calcular()).toMatchObject({ tipo: "APLICAR", itens: [{ creditoDelta: "0.00", reducaoCredito: "0.00", saldoAlvo: "0.00" }] });
  });
  it("reduz somente o saldo ainda devido diante de pagamento parcial", () => {
    expect(calcular({ liquidado: "60.00", creditoJaApurado: "0.00", saldoAtual: "80.00" })).toMatchObject({
      itens: [{ saldoAlvo: "40.00", ajusteSaldo: "-40.00", creditoDelta: "0.00" }],
    });
  });
  it("separa os valores de cobranças em moedas distintas sem somá-los", () => {
    const resultado = calcularReconferenciaDelta([fonte, { ...fonte, cobrancaId: "material", moeda: "USD", liquidado: "20.00", creditoJaApurado: "0.00", devidoAtual: "10.00" }], {
      ...obrigacoes, material: { devido: "10.00", moeda: "USD" },
    }, anterior, atual);
    expect(resultado).toMatchObject({ tipo: "APLICAR", itens: [{ moeda: "CRC", creditoDelta: "0.00" }, { moeda: "USD", creditoDelta: "10.00" }] });
  });
  it("não materializa redução de crédito sem operação auditável", () => {
    expect(calcular({ liquidado: "100.00" })).toMatchObject({ tipo: "PENDENCIA", itens: [{ reducaoCredito: "50.00" }] });
  });
  it("exige conferência de informe e destinação própria de permuta", () => {
    expect(calcular({ informePendente: true }).tipo).toBe("PENDENCIA");
    expect(calcular({ permuta: "1.00" }).tipo).toBe("PENDENCIA");
  });
  it("não presume obrigação ausente nem ignora cobrança faltante", () => {
    expect(calcularReconferenciaDelta([fonte], {}, anterior, atual).tipo).toBe("PENDENCIA");
    expect(calcularReconferenciaDelta([], obrigacoes, anterior, atual).tipo).toBe("PENDENCIA");
  });
  it("foto idêntica só permite ausência comprovada de efeitos", () => {
    expect(calcularReconferenciaDelta([fonte], obrigacoes, anterior, anterior).tipo).toBe("SEM_EFEITO");
    expect(() => calcularReconferenciaDelta([{ ...fonte, liquidado: "175.00" }], obrigacoes, anterior, anterior)).toThrow("contradiz");
  });
  it.each(["-1.00", "1.001", "NaN", "Infinity", "10000000000.00"])("rejeita valor inválido %s", liquidado => {
    expect(() => calcular({ liquidado })).toThrow("Valor financeiro inválido");
  });
  it("recusa duplicidade, divergência de moeda e hash ausente", () => {
    expect(() => calcularReconferenciaDelta([fonte, fonte], obrigacoes, anterior, atual)).toThrow("Fonte financeira inválida");
    expect(() => calcular({ moeda: "BRL" })).toThrow("Moeda divergente");
    expect(() => calcularReconferenciaDelta([fonte], obrigacoes, "", atual)).toThrow("Fotografia financeira inválida");
  });
});
