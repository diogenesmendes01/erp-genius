import { describe, expect, it } from "vitest";
import { calcularExcedentePermuta, type EntradaExcedentePermuta } from "./excedente-permuta-calculo";

const base = (sobrescrito: Partial<EntradaExcedentePermuta> = {}): EntradaExcedentePermuta => ({
  cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valorDevido: "70.00",
  origens: [{ id: "aplicacao-permuta-1", tipo: "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "100.00" }],
  ...sobrescrito,
});

describe("Q167 excedente de serviço por permuta", () => {
  it("separa o excedente determinável de uma única aplicação de serviço", () => {
    expect(calcularExcedentePermuta(base())).toMatchObject({
      status: "EXCEDENTE_SERVICO_DETERMINADO", reducaoNecessaria: "30.00", excedenteServico: "30.00",
      excedentesServico: [{ aplicacaoPermutaId: "aplicacao-permuta-1", valor: "30.00", versaoCobranca: 4 }],
    });
  });

  it("preserva a redução total distinta do excedente de serviço na mistura totalmente reduzida", () => {
    expect(calcularExcedentePermuta(base({ valorDevido: "0.00", origens: [
      { id: "recebimento-1", tipo: "CAIXA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "200.00" },
      { id: "aplicacao-permuta-1", tipo: "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "100.00" },
    ] }))).toMatchObject({ status: "EXCEDENTE_SERVICO_DETERMINADO", reducaoNecessaria: "300.00", excedenteServico: "100.00", excedentesServico: [{ valor: "100.00" }] });
  });

  it("apura toda a fonte quando a redução total contém somente permuta", () => {
    expect(calcularExcedentePermuta(base({ valorDevido: "0.00" }))).toMatchObject({ status: "EXCEDENTE_SERVICO_DETERMINADO", reducaoNecessaria: "100.00", excedenteServico: "100.00" });
  });

  it("mantém pendente a mistura caixa, crédito e permuta sem distribuição explícita", () => {
    const resultado = calcularExcedentePermuta(base({ valorDevido: "50.00", origens: [
      { id: "recebimento-1", tipo: "CAIXA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "20.00" },
      { id: "uso-credito-1", tipo: "CREDITO", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "10.00" },
      { id: "aplicacao-permuta-1", tipo: "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "100.00" },
    ] }));
    expect(resultado).toMatchObject({ status: "DISTRIBUICAO_MISTA_PENDENTE", reducaoNecessaria: "80.00", excedenteServicoMinimo: "50.00", excedenteServicoMaximo: "80.00" });
  });

  it("aceita distribuição explícita por cada origem, sem priorizar caixa, crédito ou serviço", () => {
    const resultado = calcularExcedentePermuta(base({ valorDevido: "50.00", origens: [
      { id: "recebimento-1", tipo: "CAIXA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "20.00" },
      { id: "uso-credito-1", tipo: "CREDITO", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "10.00" },
      { id: "aplicacao-permuta-1", tipo: "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "100.00" },
    ], distribuicao: [
      { origemId: "recebimento-1", valor: "20.00" }, { origemId: "uso-credito-1", valor: "10.00" }, { origemId: "aplicacao-permuta-1", valor: "50.00" },
    ] }));
    expect(resultado).toMatchObject({ status: "DISTRIBUICAO_EXPLICITA", excedenteServico: "50.00", excedentesServico: [{ aplicacaoPermutaId: "aplicacao-permuta-1", valor: "50.00" }] });
  });

  it.each([
    ["repete aplicação de serviço", base({ origens: [
      { id: "aplicacao-1", tipo: "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "50.00" },
      { id: "aplicacao-1", tipo: "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "50.00" },
    ] }), /duplicada/],
    ["aceita valor negativo na fonte", base({ origens: [{ id: "aplicacao-1", tipo: "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "-0.01" }] }), /não negativo/],
    ["aceita versão divergente da fonte", base({ origens: [{ id: "aplicacao-1", tipo: "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 3, moeda: "CRC", valor: "100.00" }] }), /versão atual/],
    ["aceita tipo de origem desconhecido", base({ origens: [{ id: "origem-desconhecida", tipo: "OUTRO" as "PERMUTA", cobrancaId: "cobranca-1", versaoCobranca: 4, moeda: "CRC", valor: "100.00" }] }), /Tipo da origem/],
    ["aceita distribuição acima da fonte", base({ distribuicao: [{ origemId: "aplicacao-permuta-1", valor: "100.01" }] }), /excede/],
    ["aceita total parcial de distribuição", base({ distribuicao: [{ origemId: "aplicacao-permuta-1", valor: "29.99" }] }), /totalizar exatamente/],
  ])("recusa quando %s", (_descricao, entrada, erro) => {
    expect(() => calcularExcedentePermuta(entrada)).toThrow(erro);
  });
});
