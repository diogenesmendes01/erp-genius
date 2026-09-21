import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/migracao/conciliacao-financeira", () => ({ decidirConciliacaoFinanceiraMigracao: vi.fn(), proporConciliacaoFinanceiraMigracao: vi.fn() }));
import { ConferenciaFinanceiraMigracao, type DadosConciliacaoFinanceira } from "./ConferenciaFinanceiraMigracao";
const base: DadosConciliacaoFinanceira = {
  linha: { id: "linha", linhaOrigem: "financeiro!2", entradaHash: "hash", dadosOrigem: {}, lote: { origem: "legado", chaveLote: "lote" }, mapa: { matriculaId: "m", codigo: "M1", status: "ATIVA", aluno: "Ana" } },
  cobrancas: [], recebimentos: [], pagadores: [], propostas: [], podeDecidir: true,
};
const proposta = (podeDecidir: boolean): DadosConciliacaoFinanceira["propostas"][number] => ({
  id: "p", versao: 1, modalidade: "PENDENCIA", valor: null, moeda: null, dataPagamento: null, forma: null, status: "PENDENTE",
  evidencia: { documento: "fonte" }, complemento: null, snapshot: {}, estadoHash: "h", motivoDecisao: null, decididoEm: null, aplicadaEm: null,
  criadoEm: "2026-09-16T12:00:00Z", preparadorId: "autor", podeDecidir, preparador: { nome: "Preparador" }, decisor: null,
  cobranca: { codigo: "C1", moeda: "CRC", status: "PENDENTE" }, pagador: { versao: 1, tipo: "ALUNO" }, recebimentoExistente: null, aplicacao: null,
});
describe("conferência financeira renderizada", () => {
  it("não oferece decisão da própria proposta e preserva o histórico", () => {
    const html = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: { ...base, propostas: [proposta(false)] } }));
    expect(html).toContain("Preparador");
    expect(html).not.toContain("Registrar decisão");
    expect(html).not.toContain("Motivo do complemento:");
  });
  it("oferece decisão explícita somente com capacidade independente", () => {
    const html = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: { ...base, propostas: [proposta(true)] } }));
    expect(html).toContain("Registrar decisão");
    expect(html).toContain("Aprovar e aplicar");
    expect(html).toContain("Rejeitar");
  });
  it("exibe resolução, proposta e aplicação no fuso pessoal sem reinterpretar vencimento civil", () => {
    const historico = { ...proposta(false), status: "APLICADA", aplicacao: { recebimentoId: "r", aplicadaEm: "2026-09-16T00:30:00Z", aplicadaPor: { nome: "Financeiro" } } };
    const html = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: {
      ...base, resolucao: { recebimentoId: "recibo", aplicadaEm: "2026-09-16T00:30:00Z" }, propostas: [historico],
      cobrancas: [{ id: "c", codigo: "C1", status: "PENDENTE", tipo: "MENSALIDADE", moeda: "CRC", valorNegociado: "100", valorRecebido: null, saldo: "100", versao: 1, vencimento: { estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: null, origem: "M01_HISTORICO" } }],
    }, preferenciaFusoExibicao: "America/Adak" }));
    expect(html).toContain("15/09/2026");
    expect(html).toContain("America/Adak");
    expect(html).toContain("Financeiro");
  });

  it("mostra a pendência resolvida e não oferece nova preparação", () => {
    const historico = { ...proposta(false), status: "APLICADA" };
    const html = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: {
      ...base, pendenciaRegistrada: true, resolucao: { recebimentoId: "recibo", aplicadaEm: "2026-09-16T12:00:00Z" }, propostas: [historico],
    } }));
    expect(html).toContain("Origem conciliada com recebimento");
    expect(html).toContain("Histórico de propostas e aplicações");
    expect(html).toContain("Preparador");
    expect(html).not.toContain("Registrar proposta");
  });
  it("oferece resolução comprovada de uma pendência sem apagá-la", () => {
    const html = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: { ...base, pendenciaRegistrada: true } }));
    expect(html).toContain("Resolver pendência com recebimento comprovado");
    expect(html).toContain('value="PENDENCIA" disabled=""');
    expect(html).toContain("Registrar proposta");
  });
  it("distingue pagadores do mesmo tipo pela identidade e versão", () => {
    const pagadores = [
      { id: "pagador-1", versao: 1, tipo: "RESPONSAVEL", dados: { nome: "Ana Lima" }, motivo: "conferido", criadaEm: "2026-09-16T12:00:00Z", preparador: { nome: "Secretaria" } },
      { id: "pagador-2", versao: 2, tipo: "RESPONSAVEL", dados: { nome: "João Lima" }, motivo: "conferido", criadaEm: "2026-09-16T12:00:00Z", preparador: { nome: "Secretaria" } },
    ];
    const html = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: { ...base, pagadores } }));
    expect(html).toContain("Ana Lima · versão 1 · RESPONSAVEL");
    expect(html).toContain("João Lima · versão 2 · RESPONSAVEL");
  });
  it("renderiza vencimento civil M01 sem reinterpretar o instante do navegador", () => {
    const html = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: {
      ...base,
      cobrancas: [{ id: "c", codigo: "C1", status: "PENDENTE", tipo: "MENSALIDADE", moeda: "CRC", valorNegociado: "100", valorRecebido: null, saldo: "100", versao: 1, vencimento: { estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: null, origem: "M01_HISTORICO" } }],
    } }));
    expect(html).toContain("vence 28/02/2099 · origem M01_HISTORICO");
    expect(html).not.toContain("27/02/2099");
  });
  it("impede preparar sem vínculo contratual", () => {
    const html = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: { ...base, linha: { ...base.linha, mapa: null } } }));
    expect(html).toContain("ainda não possui vínculo M01");
    expect(html).not.toContain("Registrar proposta");
  });
});
