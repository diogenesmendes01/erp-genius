import { expect, it } from "vitest";
import { conferirOutrasCobrancasEncerramento } from "./encerramento-outras-cobrancas";
type Contexto = Parameters<typeof conferirOutrasCobrancasEncerramento>[0];
function contexto(): Contexto {
  return { matriculaId: "m1", alunoId: "a1", moeda: "BRL", status: "ATIVA", pendencias: [], condicoes: null, ajustes: [], compensacoes: [], regularizacoesPeriodoIntegral: [],
    cobrancas: [{ id: "taxa", versao: 1, tipo: "MATRICULA", status: "PAGO", moeda: "BRL", vencimento: "2026-09-01T00:00:00Z", saldo: "0.00", coberturaInicio: null, coberturaFim: null,
      valorOriginal: "100.00", valorNegociado: "100.00", valorRecebido: "100.00", conferencias: [], recebimentos: [{ id: "r1", valor: "100.00", moeda: "BRL", dataPagamento: "2026-09-01T00:00:00Z" }] }] };
}
const proposta = () => [{ cobrancaId: "taxa", versao: 1, valorDevidoProposto: "40.00", motivo: "Acerto da taxa conforme contrato", evidenciaContratual: "Cláusula contratual conferida" }];
it("preserva recebimento e apura crédito sem executar devolução", () => {
  const c = contexto(), antes = structuredClone(c);
  const r = conferirOutrasCobrancasEncerramento(c, proposta());
  expect(r.consolidado).toEqual({ moeda: "BRL", saldoDevidoSemCompensarCreditos: "0.00", creditoApurado: "60.00" });
  expect(r.parcelas[0]).toMatchObject({ alteracaoProposta: true, exigeAprovacaoIndependente: true, recebimentos: antes.cobrancas[0].recebimentos });
  expect(c).toEqual(antes);
});
it("não usa crédito de uma cobrança para quitar outra automaticamente", () => {
  const c = contexto(); c.cobrancas.push({ ...c.cobrancas[0], id: "material", tipo: "MATERIAL", status: "PENDENTE", valorRecebido: null, recebimentos: [], saldo: null });
  const r = conferirOutrasCobrancasEncerramento(c, [...proposta(), { ...proposta()[0], cobrancaId: "material", valorDevidoProposto: "100" }]);
  expect(r.consolidado).toMatchObject({ saldoDevidoSemCompensarCreditos: "100.00", creditoApurado: "60.00" });
});
it("marca ausência de conferência e rejeita omissões, duplicatas, versão antiga e moeda diferente", () => {
  expect(conferirOutrasCobrancasEncerramento(contexto()).consolidado).toBeNull();
  expect(() => conferirOutrasCobrancasEncerramento(contexto(), [])).toThrow(/todas/);
  expect(() => conferirOutrasCobrancasEncerramento(contexto(), [...proposta(), ...proposta()])).toThrow(/todas/);
  expect(() => conferirOutrasCobrancasEncerramento(contexto(), [{ ...proposta()[0], versao: 0 }])).toThrow(/mudou/);
  const c = contexto(); c.cobrancas[0].moeda = "CRC";
  expect(() => conferirOutrasCobrancasEncerramento(c, proposta())).toThrow(/Concilie/);
});
it("recusa recebimentos divergentes e pendências financeiras", () => {
  const c = contexto(); c.cobrancas[0].recebimentos[0].valor = "90.00";
  expect(() => conferirOutrasCobrancasEncerramento(c, proposta())).toThrow(/conciliação/);
  c.cobrancas[0].conferencias = ["Comprovante a conferir"];
  expect(() => conferirOutrasCobrancasEncerramento(c, proposta())).toThrow(/Concilie/);
});
it("sem outras cobranças produz subtotal zero sem inventar lançamentos", () => {
  const c = contexto(); c.cobrancas = [];
  expect(conferirOutrasCobrancasEncerramento(c)).toEqual({ pendencias: [], parcelas: [], consolidado: { moeda: "BRL", saldoDevidoSemCompensarCreditos: "0.00", creditoApurado: "0.00" } });
});

it("apura somente o excedente sobre a quitação mista e conserva as fontes", () => {
  const c = contexto();
  c.cobrancas[0].valorRecebido = "20.00"; c.cobrancas[0].recebimentos[0].valor = "20.00";
  c.cobrancas[0].valorLiquidadoCredito = "80.00";
  c.cobrancas[0].utilizacoesCredito = [{ propostaId: "p1", creditoId: "cr1", decisaoId: "d1", valor: "80.00" }];
  const r = conferirOutrasCobrancasEncerramento(c, proposta());
  expect(r.parcelas[0]).toMatchObject({ valorRecebido: "20.00", valorLiquidadoCredito: "80.00", saldoDevido: "0.00", creditoApurado: "60.00", utilizacoesCredito: c.cobrancas[0].utilizacoesCredito });
});
