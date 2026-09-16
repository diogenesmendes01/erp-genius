import { expect, it } from "vitest";
import { calcularPreviaMensalConferida } from "./encerramento-previa-calculo";
type Contexto = Parameters<typeof calcularPreviaMensalConferida>[0];
const contexto = (): Contexto => ({
  matriculaId: "m1", alunoId: "a1", moeda: "BRL", status: "ATIVA", pendencias: [], ajustes: [], compensacoes: [], regularizacoesPeriodoIntegral: [],
  condicoes: { id: "v1", versao: 1, documentoId: "doc1", regras: { diaEncerramento: "INCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Desconto vigente conforme cláusula 5", multa: { tipo: "SEM_PREVISAO", motivo: "Não há cláusula de multa" } } },
  cobrancas: [{ id: "c1", versao: 2, tipo: "MENSALIDADE", status: "PENDENTE", moeda: "BRL", vencimento: "2026-09-05T00:00:00.000Z", saldo: null, coberturaInicio: "2026-09-01", coberturaFim: "2026-09-30", valorOriginal: "500.00", valorNegociado: "400.00", valorRecebido: null, recebimentos: [], conferencias: [] }],
});
const input = () => ({ matriculaId: "m1", condicoesId: "v1", parcelas: [{ cobrancaId: "c1", versao: 2, valorBase: "500", descontoValido: "100", evidenciaCondicoes: "Cláusula 5 permite o desconto no período" }], multa: { tipo: "SEM_PREVISAO" as const } });
it("calcula por dias reais usando conferência explícita e preserva a origem sem alteração", () => {
  const c = contexto(); const anterior = structuredClone(c);
  const r = calcularPreviaMensalConferida(c, "2026-09-15", input());
  expect(r.calculo.totalServico).toBe("200.00");
  expect(r.conferencia.parcelas[0].evidenciaCondicoes).toContain("Cláusula 5");
  expect(r.origem.cobrancas[0].valorNegociado).toBe("400.00");
  expect(c).toEqual(anterior);
});
it("recusa omissão, duplicação, versão alterada e matrícula diferente", () => {
  expect(() => calcularPreviaMensalConferida(contexto(), "2026-09-15", { ...input(), parcelas: [] })).toThrow(/todas/);
  expect(() => calcularPreviaMensalConferida(contexto(), "2026-09-15", { ...input(), parcelas: [...input().parcelas, ...input().parcelas] })).toThrow(/todas/);
  expect(() => calcularPreviaMensalConferida(contexto(), "2026-09-15", { ...input(), condicoesId: "antiga" })).toThrow(/versão/);
  expect(() => calcularPreviaMensalConferida(contexto(), "2026-09-15", { ...input(), matriculaId: "outra" })).toThrow(/outra matrícula/);
  const i = input(); i.parcelas[0].versao = 1;
  expect(() => calcularPreviaMensalConferida(contexto(), "2026-09-15", i)).toThrow(/cobrança mudou/);
});
it("não usa valores com pendência de conciliação", () => {
  const c = contexto(); c.cobrancas[0].conferencias = ["Recebimento pendente"];
  expect(() => calcularPreviaMensalConferida(c, "2026-09-15", input())).toThrow(/conciliação/);
});
it("multa percentual conserva percentual e base contratual, exigindo evidência e valor da base", () => {
  const c = contexto(); c.condicoes!.regras.multa = { tipo: "PERCENTUAL", percentual: "10", descricaoBase: "Saldo contratual elegível", clausulaId: "7", condicoesAplicacao: "Saída antes do prazo" };
  expect(() => calcularPreviaMensalConferida(c, "2026-09-15", input())).toThrow(/Dispensa/);
  expect(() => calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { tipo: "APLICAR", evidenciaAplicabilidade: "Condição comprovada" } })).toThrow(/valor da base/);
  const r = calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { tipo: "APLICAR", evidenciaAplicabilidade: "Condição comprovada", baseCalculo: "800" } });
  expect(r.calculo.multa.valor).toBe("80.00");
  expect(r.calculo.saldoDevidoSemCompensarCreditos).toBe("280.00");
});

it("dispensa proposta conserva a multa original e apresenta saldo alternativo sem autorizar aplicação", () => {
  const c = contexto(); c.condicoes!.regras.multa = { tipo: "VALOR_FIXO", valor: "80", clausulaId: "7", condicoesAplicacao: "Saída antes do prazo" };
  const r = calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { tipo: "APLICAR", evidenciaAplicabilidade: "Condição comprovada", excecao: { tipo: "DISPENSAR", motivo: "Dispensa solicitada para revisão administrativa" } } });
  expect(r.calculo.multa.valor).toBe("80.00");
  expect(r.calculo.saldoDevidoSemCompensarCreditos).toBe("280.00");
  expect(r.propostaExcecaoMulta).toMatchObject({ valorContratual: "80.00", valorProposto: "0.00", saldoPropostoSemCompensarCreditos: "200.00", exigeAprovacaoIndependente: true });
  expect(c.condicoes!.regras.multa).toMatchObject({ valor: "80" });
});

it("alteração mantém percentual e base originais e recusa exceção sem justificativa", () => {
  const c = contexto(); c.condicoes!.regras.multa = { tipo: "PERCENTUAL", percentual: "10", descricaoBase: "Saldo elegível", clausulaId: "7", condicoesAplicacao: "Saída antes do prazo" };
  const multa = { tipo: "APLICAR" as const, evidenciaAplicabilidade: "Condição comprovada", baseCalculo: "800", excecao: { tipo: "ALTERAR" as const, valorProposto: "35.50", motivo: "Proposta de redução justificada" } };
  const r = calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa });
  expect(r.calculo.multa.regra).toMatchObject({ percentual: "10", baseCalculo: "800" });
  expect(r.propostaExcecaoMulta).toMatchObject({ valorProposto: "35.50", saldoPropostoSemCompensarCreditos: "235.50" });
  expect(() => calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { ...multa, excecao: { ...multa.excecao, motivo: "" } } })).toThrow();
  expect(() => calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { ...multa, excecao: { ...multa.excecao, valorProposto: "-1" } } })).toThrow();
});
it.each([0, 200])("apura dias de compensação sem duplicação, com %s em crédito já utilizado", (credito) => {
  const c = contexto();
  c.cobrancas[0].valorRecebido = (400 - credito).toFixed(2); c.cobrancas[0].valorLiquidadoCredito = credito.toFixed(2);
  c.compensacoes = [{ id: "cp1", status: "APROVADA", cobrancaOrigemId: "c1", documentoOrigemId: "doc1",
    coberturaOriginalInicio: "2026-09-01", coberturaOriginalFim: "2026-09-30", valorCoberturaOriginal: "400.00", moeda: "BRL",
    motivo: "Indisponibilidade comprovada", evidenciaCondicoes: "Condições originais conferidas", diasPropostos: [],
    preparadorId: "f1", decisorId: "f2", motivoDecisao: "Conferido", decididaEm: "2026-09-12T00:00:00Z",
    dias: [
      { id: "d1", diaOrigem: "2026-09-10", estado: "PENDENTE", versao: 1, destinacaoReferencia: null, destinadoEm: null },
      { id: "d2", diaOrigem: "2026-09-20", estado: "PENDENTE", versao: 1, destinacaoReferencia: null, destinadoEm: null },
      { id: "d3", diaOrigem: "2026-09-11", estado: "RECOMPOSTO", versao: 2, destinacaoReferencia: "retorno1", destinadoEm: "2026-09-13T00:00:00Z" },
      { id: "d4", diaOrigem: "2026-09-12", estado: "LIQUIDADO_FINANCEIRAMENTE", versao: 2, destinacaoReferencia: "acerto-anterior", destinadoEm: "2026-09-13T00:00:00Z" },
    ],
  }];
  const r = calcularPreviaMensalConferida(c, "2026-09-15", input()).compensacaoFinanceira;
  expect(r.pendencias).toEqual([]);
  expect(r.ajustes[0]).toMatchObject({ valorServicoAposCompensacao: "186.67", saldoDevido: "0.00", creditoApurado: "213.33", apuracao: { quantidadePendente: 1, valorAjusteApurado: "13.33" } });
  expect(r.ajustes[0].apuracao.origem.diasContempladosNoProporcional).toEqual(["2026-09-20"]);
  expect(r.ajustes[0].apuracao.origem.diasLiquidadosFinanceiramente).toEqual(["2026-09-12"]);
  expect(r.consolidado).toMatchObject({ totalServico: "186.67", saldoDevidoSemCompensarCreditos: "0.00", creditoApuradoSemUtilizacao: "213.33" });
  c.cobrancas.push({ ...c.cobrancas[0], id: "c2", coberturaInicio: "2026-08-01", coberturaFim: "2026-08-31", valorRecebido: null, valorLiquidadoCredito: undefined });
  c.condicoes!.regras.multa = { tipo: "VALOR_FIXO", valor: "80", clausulaId: "7", condicoesAplicacao: "Encerramento antes do prazo" };
  const composta = calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), parcelas: [...input().parcelas, { ...input().parcelas[0], cobrancaId: "c2" }], multa: { tipo: "APLICAR", evidenciaAplicabilidade: "Condição comprovada", excecao: { tipo: "ALTERAR", valorProposto: "35", motivo: "Redução proposta para aprovação" } } });
  expect(composta.compensacaoFinanceira.consolidado).toMatchObject({ totalServico: "586.67", saldoDevidoSemCompensarCreditos: "480.00", creditoApuradoSemUtilizacao: "213.33" });
  expect(composta.propostaExcecaoMulta?.saldoPropostoAposCompensacao).toBe("435.00");
  c.cobrancas.pop();
  c.condicoes!.regras.multa = { tipo: "SEM_PREVISAO", motivo: "Não há cláusula de multa" };
  c.compensacoes.push({ ...structuredClone(c.compensacoes[0]), id: "duplicada" });
  expect(calcularPreviaMensalConferida(c, "2026-09-15", input()).compensacaoFinanceira.pendencias[0]).toMatch(/duplicados/);
  c.compensacoes.pop();
  c.compensacoes[0].coberturaOriginalFim = "2026-10-01";
  const divergente = calcularPreviaMensalConferida(c, "2026-09-15", input()).compensacaoFinanceira;
  expect(divergente.completo).toBe(false);
  expect(divergente.ajustes).toEqual([]);
  expect(divergente.consolidado).toBeNull();
});

it("consolida componentes sem abater crédito automaticamente e aplica multa proposta uma vez", async () => {
  const { consolidarPreviaEncerramento } = await import("./encerramento-consolidacao");
  const { calcularSaldoHorasEncerramento } = await import("./encerramento-horas");
  const c = contexto();
  c.condicoes!.regras.multa = { tipo: "VALOR_FIXO", valor: "80", clausulaId: "7", condicoesAplicacao: "Encerramento antes do prazo" };
  const mensal = calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { tipo: "APLICAR", vencimento: "2026-10-05", evidenciaAplicabilidade: "Condição comprovada", excecao: { tipo: "ALTERAR", valorProposto: "35", motivo: "Redução para aprovação independente" } } });
  const horas = { pendencias: [], cobrancasCompras: [], origens: [], calculo: calcularSaldoHorasEncerramento({ matriculaId: "m1", moeda: "BRL", compras: [] }) };
  expect(consolidarPreviaEncerramento(mensal, horas)).toMatchObject({ pendencias: [], totais: { saldoDevidoSemCompensarCreditos: "235.00", creditoApuradoSemUtilizacao: "0.00", multaContratual: "80.00", multaProposta: "35.00" }, efetivado: false });
});
it("bloqueia dupla apuração da compra de horas e não publica total com reservas pendentes", async () => {
  const { consolidarPreviaEncerramento } = await import("./encerramento-consolidacao");
  const { calcularSaldoHorasEncerramento } = await import("./encerramento-horas");
  const c = contexto();
  c.cobrancas.push({ ...c.cobrancas[0], id: "horas", tipo: "HORA_PARTICULAR", valorRecebido: "300.00", valorNegociado: "300.00", recebimentos: [{ id: "r1", valor: "300.00", moeda: "BRL", dataPagamento: "2026-09-01T00:00:00Z" }] });
  const conferencia = { ...input(), outrasCobrancas: [{ cobrancaId: "horas", versao: 2, valorDevidoProposto: "300", motivo: "Preservar compra quitada", evidenciaContratual: "Condições da compra" }] };
  const mensal = calcularPreviaMensalConferida(c, "2026-09-15", conferencia);
  const horas = { pendencias: [], cobrancasCompras: ["horas"], origens: [], calculo: { ...calcularSaldoHorasEncerramento({ matriculaId: "m1", moeda: "BRL", compras: [] }), creditoApurado: "100.00" } };
  expect(consolidarPreviaEncerramento(mensal, horas)).toMatchObject({ totais: { saldoDevidoSemCompensarCreditos: "200.00", creditoApuradoSemUtilizacao: "100.00" }, cobrancasIndependentes: [] });
  conferencia.outrasCobrancas[0].valorDevidoProposto = "200";
  const duplicada = calcularPreviaMensalConferida(c, "2026-09-15", conferencia);
  expect(consolidarPreviaEncerramento(duplicada, horas).totais).toBeNull();
  expect(consolidarPreviaEncerramento(mensal, { ...horas, pendencias: ["Reserva pendente"], calculo: null }).totais).toBeNull();
});

it("prepara ajustes e créditos por origem preservando caixa e vencimento", async () => {
  const { prepararLancamentosEncerramento } = await import("./encerramento-lancamentos");
  const { calcularSaldoHorasEncerramento } = await import("./encerramento-horas");
  const c = contexto(); c.cobrancas[0].valorRecebido = "100.00"; c.cobrancas[0].valorLiquidadoCredito = "300.00";
  const mensal = calcularPreviaMensalConferida(c, "2026-09-15", input());
  const horas = { pendencias: [], cobrancasCompras: [], origens: [], calculo: calcularSaldoHorasEncerramento({ matriculaId: "m1", moeda: "BRL", compras: [] }) };
  const antes = structuredClone(mensal), r = prepararLancamentosEncerramento(mensal, horas);
  expect(r.plano).toMatchObject({ ajustes: [{ cobrancaId: "c1", valorDevido: "200.00", saldo: "0.00", credito: "200.00", valorRecebidoPreservado: "100.00", valorLiquidadoCreditoPreservado: "300.00", vencimentoPreservado: c.cobrancas[0].vencimento }], creditos: [{ origemTipo: "COBRANCA", origemId: "c1", valor: "200.00" }], efetivado: false });
  expect(mensal).toEqual(antes);
  expect(prepararLancamentosEncerramento(mensal, { ...horas, pendencias: ["Reserva pendente"], calculo: null }).plano).toBeNull();
  const inconsistente = structuredClone(mensal);
  inconsistente.compensacaoFinanceira.consolidado!.creditoApuradoSemUtilizacao = "999.00";
  expect(() => prepararLancamentosEncerramento(inconsistente, horas)).toThrow("divergem");
});

it("não libera lançamento de multa sem vencimento e conserva a data conferida", async () => {
  const { prepararLancamentosEncerramento } = await import("./encerramento-lancamentos");
  const { calcularSaldoHorasEncerramento } = await import("./encerramento-horas");
  const c = contexto(); c.condicoes!.regras.multa = { tipo: "VALOR_FIXO", valor: "80", clausulaId: "7", condicoesAplicacao: "Encerramento antecipado" };
  const horas = { pendencias: [], cobrancasCompras: [], origens: [], calculo: calcularSaldoHorasEncerramento({ matriculaId: "m1", moeda: "BRL", compras: [] }) };
  const multa = { tipo: "APLICAR" as const, evidenciaAplicabilidade: "Condição contratual conferida" };
  const semData = prepararLancamentosEncerramento(calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa }), horas);
  expect(semData.plano).toBeNull(); expect(semData.pendencias.join(" ")).toContain("vencimento");
  const comData = prepararLancamentosEncerramento(calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { ...multa, vencimento: "2026-10-05" } }), horas);
  expect(comData.plano?.multa).toMatchObject({ vencimento: "2026-10-05", valorProposto: "80.00" });
  expect(() => calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { ...multa, vencimento: "2026-02-30" } })).toThrow();
  const dispensa = prepararLancamentosEncerramento(calcularPreviaMensalConferida(c, "2026-09-15", { ...input(), multa: { ...multa, excecao: { tipo: "DISPENSAR", motivo: "Dispensa para aprovação" } } }), horas);
  expect(dispensa.plano?.multa).toMatchObject({ vencimento: null, valorProposto: "0.00" });
});
