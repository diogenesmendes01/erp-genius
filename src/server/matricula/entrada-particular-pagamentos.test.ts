import { expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { planejarCobrancasEntrada } from "./plano-cobrancas-entrada";
import { conferirPagamentosEntradaParticular } from "./entrada-particular-pagamentos";
const condicoes = (exigir: boolean, antecipar = exigir) => ({ moeda: "BRL", taxaProposta: "100", valorServicoProposto: "200", taxaVencimento: "2099-10-01",
  politicaEntrada: { taxaPreviaAssinatura: false, exigirPrimeiraMensalidade: null, adiantamentoHoraExigido: exigir },
  adiantamentoProposto: antecipar ? { minutos: 75, valor: "250", valorHora: "200", unidadeMinutos: 60 } : null,
  aulas: { regime: "HORA_PARTICULAR", ...(antecipar ? { vencimentoAdiantamento: "2099-10-02" } : {}) } });
function fixture(snapshot: unknown) {
  const itens = planejarCobrancasEntrada(snapshot).filter(c => c.etapa === "CONFERENCIA_SECRETARIA").map((c,i) => ({ ...c, id: `c${i}` }));
  const cobrancas = itens.map(c => ({ id: c.id, tipo: c.tipo, moeda: c.moeda, valorNegociado: new Prisma.Decimal(c.valor), vencimento: new Date(`${c.vencimento}T12:00:00Z`),
    coberturaInicio: c.cobertura ? new Date(`${c.cobertura.inicio}T00:00:00Z`) : null, coberturaFim: c.cobertura ? new Date(`${c.cobertura.fim}T00:00:00Z`) : null,
    status: "PAGO" as "PAGO" | "PENDENTE" | "CANCELADA", valorRecebido: new Prisma.Decimal(c.valor), pagoEm: new Date("2026-09-13T00:00:00Z") as Date | null, versao: 1 }));
  const memoria = { fusoInstitucional: "UTC", cobrancas: itens }, vinculadas = itens.map(c => c.id);
  return { cobrancas, memoria, vinculadas, consultar: () => conferirPagamentosEntradaParticular(snapshot, memoria, cobrancas, vinculadas) };
}
it("por hora sem adiantamento confere somente taxa e não planeja mensalidade", () => {
  const f = fixture(condicoes(false));
  expect(f.consultar()).toMatchObject({ pagamentosExigidosConfirmados: true, itens: [{ tipo: "MATRICULA", exigido: true, confirmada: true }], emitirNaAtivacao: [] });
});
it("adiantamento exigido requer recebimento integral e data de confirmação", () => {
  const f = fixture(condicoes(true));
  f.cobrancas[1].status = "PENDENTE";
  expect(f.consultar().pagamentosExigidosConfirmados).toBe(false);
  f.cobrancas[1].status = "PAGO"; f.cobrancas[1].valorRecebido = new Prisma.Decimal("249.99");
  expect(f.consultar().pagamentosExigidosConfirmados).toBe(false);
  f.cobrancas[1].valorRecebido = new Prisma.Decimal("250"); f.cobrancas[1].pagoEm = null;
  expect(f.consultar().pagamentosExigidosConfirmados).toBe(false);
  f.cobrancas[1].pagoEm = new Date();
  expect(f.consultar()).toMatchObject({ pagamentosExigidosConfirmados: true, itens: [expect.anything(), expect.objectContaining({ minutos: 75, exigido: true })] });
});
it("antecipação opcional não vira requisito de ativação", () => {
  const f = fixture(condicoes(false,true)); f.cobrancas[1].status = "PENDENTE";
  expect(f.consultar()).toMatchObject({ pagamentosExigidosConfirmados: true, itens: [expect.anything(), expect.objectContaining({ exigido: false, confirmada: false })] });
  f.cobrancas[1].status = "CANCELADA";
  expect(f.consultar().pagamentosExigidosConfirmados).toBe(false);
});
it("particular mensal adia primeira mensalidade somente quando a política assim define", () => {
  const s = { ...condicoes(false), politicaEntrada: { taxaPreviaAssinatura: false, exigirPrimeiraMensalidade: false, adiantamentoHoraExigido: null }, aulas: { regime: "MENSALIDADE", cobertura: { referencia: "MES_CIVIL", inicio: "2099-10-01" }, primeiroVencimento: "2099-10-05", diaVencimentoContratado: 5 } };
  expect(fixture(s).consultar()).toMatchObject({ pagamentosExigidosConfirmados: true, emitirNaAtivacao: [{ tipo: "MENSALIDADE" }] });
  const exigida = fixture({ ...s, politicaEntrada: { ...s.politicaEntrada, exigirPrimeiraMensalidade: true } });
  exigida.cobrancas[1].status = "PENDENTE";
  expect(exigida.consultar()).toMatchObject({ pagamentosExigidosConfirmados: false, emitirNaAtivacao: [] });
});
it.each(["valor", "vencimento", "moeda", "vinculo", "extra", "memoria"])("recusa divergência de %s em relação à emissão conferida", tipo => {
  const f = fixture(condicoes(true));
  if (tipo === "valor") f.cobrancas[1].valorNegociado = new Prisma.Decimal("1");
  if (tipo === "vencimento") f.cobrancas[1].vencimento = new Date("2100-01-01");
  if (tipo === "moeda") f.cobrancas[1].moeda = "CRC";
  if (tipo === "vinculo") f.vinculadas[1] = "outra-cobranca";
  if (tipo === "extra") f.cobrancas.push({ ...f.cobrancas[1], id: "extra" });
  if (tipo === "memoria") f.memoria.cobrancas[1].minutos = 60;
  expect(() => f.consultar()).toThrow();
});
