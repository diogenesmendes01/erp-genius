import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const { carregarFinanceiro, saldoCredito } = vi.hoisted(() => ({ carregarFinanceiro: vi.fn(), saldoCredito: vi.fn() }));
vi.mock("./desistencia-financeiro-tx", () => ({ carregarFinanceiroDesistenciaTx: carregarFinanceiro }));
vi.mock("@/server/financeiro/uso-credito-estado", () => ({ saldoCreditoTx: saldoCredito }));
import { carregarFontesReconferenciaDeltaTx } from "./desistencia-reconferencia-delta-fontes";
import { calcularReconferenciaDelta } from "./desistencia-reconferencia-delta-calculo";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";

const dinheiro = (valor: string) => new Prisma.Decimal(valor);
const memoria = { itens: [
  { cobrancaId: "cobranca-a", devido: "50.00", moeda: "BRL" },
  { cobrancaId: "cobranca-b", devido: "20.00", moeda: "USD" },
] };
const credito = (id: string, valorInicial: string, moeda: string, origens = {}) => ({
  id, valorInicial, moeda, origemDestinacaoRecebimentoId: null, origemLiberacaoId: null,
  origemAcertoId: null, origemPeriodoIntegralId: null, origemAcertoTaxaAditivoId: null,
  origemAcertoDesistenciaContratualId: null, origemReconferenciaDeltaDesistenciaId: null, ...origens,
});
function tx(base: Array<{ cobrancaId: string; valor: string; moeda: string }>, delta: typeof base) {
  return {
    creditoMatricula: { findMany: vi.fn().mockResolvedValue([]) },
    origemCreditoAcertoDesistenciaContratual: { findMany: vi.fn().mockResolvedValue(base.map(x => ({ ...x, valor: dinheiro(x.valor) }))) },
    origemCreditoReconferenciaDeltaDesistencia: { findMany: vi.fn().mockResolvedValue(delta.map(x => ({ ...x, valor: dinheiro(x.valor) }))) },
  } as unknown as Prisma.TransactionClient;
}
function foto(informesA: Array<Record<string, string>> = []) {
  return {
    matriculaId: "matricula", cobrancas: [
      { id: "cobranca-a", moeda: "BRL", valorNegociado: "50.00", saldo: "0.00", valorLiquidadoCredito: "0.00", informes: informesA,
        recebimentos: [{ id: "dest-a", recebimentoId: "receb-a", valor: "100.00", moeda: "BRL" }] },
      { id: "cobranca-b", moeda: "USD", valorNegociado: "20.00", saldo: "20.00", valorLiquidadoCredito: "0.00", informes: [], recebimentos: [] },
    ],
    creditos: [credito("externo-brl", "17.00", "BRL", { origemDestinacaoRecebimentoId: "destino-antecipacao" }), credito("q165-base", "50.00", "BRL", { origemAcertoDesistenciaContratualId: "origem-base" })],
  };
}
describe("carregarFontesReconferenciaDeltaTx", () => {
  it("mantém duas cobranças isoladas e soma origens Q165 base e delta na cobrança correspondente", async () => {
    saldoCredito.mockImplementation(async (_tx: unknown, creditoId: string) => dinheiro(creditoId === "externo-brl" ? "12.00" : "50.00"));
    carregarFinanceiro.mockResolvedValue({ snapshot: foto(), resumo: {} });
    const resultado = await carregarFontesReconferenciaDeltaTx(tx(
      [{ cobrancaId: "cobranca-a", valor: "50.00", moeda: "BRL" }],
      [{ cobrancaId: "cobranca-a", valor: "10.00", moeda: "BRL" }],
    ), "matricula", memoria);
    expect(resultado.fatos).toEqual([
      expect.objectContaining({ cobrancaId: "cobranca-a", liquidado: "100.00", creditoJaApurado: "60.00" }),
      expect.objectContaining({ cobrancaId: "cobranca-b", liquidado: "0.00", creditoJaApurado: "0.00" }),
    ]);
    expect(resultado.creditosExternos).toEqual([{ id: "externo-brl", saldoDisponivel: "12.00", moeda: "BRL" }]);
    expect(resultado.creditosDoAcerto).toEqual([{ id: "q165-base", saldoDisponivel: "50.00", moeda: "BRL" }]);
  });

  it("mantém caixa destinado quando o informe é rejeitado", async () => {
    saldoCredito.mockResolvedValue(dinheiro("0.00"));
    carregarFinanceiro.mockResolvedValue({ snapshot: foto([{ id: "informe", status: "REJEITADO", valor: "100.00", moeda: "BRL" }]), resumo: {} });
    const resultado = await carregarFontesReconferenciaDeltaTx(tx([], []), "matricula", memoria);
    expect(resultado.fatos[0]).toMatchObject({ liquidado: "100.00", informePendente: false });
  });

  it("carrega informe pendente como bloqueio sem apagar a destinação real", async () => {
    saldoCredito.mockResolvedValue(dinheiro("0.00"));
    carregarFinanceiro.mockResolvedValue({ snapshot: foto([{ id: "informe", status: "A_CONFERIR", valor: "100.00", moeda: "BRL" }]), resumo: {} });
    const resultado = await carregarFontesReconferenciaDeltaTx(tx([], []), "matricula", memoria);
    expect(resultado.fatos[0]).toMatchObject({ liquidado: "100.00", informePendente: true });
    expect(calcularReconferenciaDelta(resultado.fatos, resultado.obrigacoes, "a".repeat(64), "b".repeat(64))).toMatchObject({ tipo: "PENDENCIA" });
  });

  it("separa créditos externos por ID e rejeita moeda divergente", async () => {
    const fotografia = foto();
    fotografia.creditos.push(credito("externo-usd", "3.00", "USD", { origemDestinacaoRecebimentoId: "destino-usd" }));
    saldoCredito.mockResolvedValue(dinheiro("3.00"));
    carregarFinanceiro.mockResolvedValue({ snapshot: fotografia, resumo: {} });
    await expect(carregarFontesReconferenciaDeltaTx(tx([], []), "matricula", memoria)).resolves.toMatchObject({
      creditosExternos: [{ id: "externo-brl", saldoDisponivel: "3.00" }, { id: "externo-usd", saldoDisponivel: "3.00" }],
    });
    await expect(carregarFontesReconferenciaDeltaTx(tx([{ cobrancaId: "cobranca-a", valor: "1.00", moeda: "USD" }], []), "matricula", memoria)).rejects.toThrow("Moeda da origem");
  });

  it("inclui saldo disponível na fotografia 249 e invalida a reserva posterior", async () => {
    carregarFinanceiro.mockResolvedValue({ snapshot: foto(), resumo: {} });
    saldoCredito.mockResolvedValueOnce(dinheiro("12.00")).mockResolvedValueOnce(dinheiro("50.00"));
    const antes = await carregarFontesReconferenciaDeltaTx(tx([], []), "matricula", memoria);
    saldoCredito.mockResolvedValueOnce(dinheiro("7.00")).mockResolvedValueOnce(dinheiro("50.00"));
    const depois = await carregarFontesReconferenciaDeltaTx(tx([], []), "matricula", memoria);
    expect((antes.fotografia as any).creditos).toEqual(expect.arrayContaining([expect.objectContaining({ id: "externo-brl", saldoDisponivel: "12.00" })]));
    expect(hashSubstituicao(depois.fotografia)).not.toBe(hashSubstituicao(antes.fotografia));
  });
});


