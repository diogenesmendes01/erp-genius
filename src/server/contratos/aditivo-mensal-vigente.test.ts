import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hashSubstituicao } from "./substituicao-estado";
import { projetarAplicacoesPorCampo } from "./aditivo-aplicacao-campos";
import { resolverMensalVigente } from "./aditivo-mensal-vigente";

const dinheiroMensal = (valor = "80", moeda = "BRL"): Prisma.JsonObject => ({
  MENSALIDADE_VALOR: { tipo: "DINHEIRO", valor, moeda },
});

const versao = (
  condicoes: Prisma.JsonObject,
  inicio = "2026-01-01T00:00:00.000Z",
  numero = 1,
): { id: string; versao: number; condicoes: Prisma.JsonObject; condicoesHash: string; vigenciaInicio: Date; aplicacao: { id: string } | null } => ({
  id: `v${numero}`,
  versao: numero,
  condicoes,
  condicoesHash: hashSubstituicao(condicoes),
  vigenciaInicio: new Date(inicio),
  aplicacao: { id: `a${numero}` },
});

const resolverBase = (versoes: ReturnType<typeof versao>[]) =>
  resolverMensalVigente(
    versoes,
    new Date("2026-01-10T00:00:00.000Z"),
    new Date("2026-02-01T00:00:00.000Z"),
    "100",
    "90",
    "BRL",
  );

describe("resolverMensalVigente", () => {
  it("preserva o valor original e atualiza somente o negociado", () => {
    expect(resolverBase([versao(dinheiroMensal())])).toMatchObject({
      valorOriginal: "100",
      valorNegociado: "80",
      moeda: "BRL",
    });
  });

  it("mantém os valores originais quando não há versão formalizada", () => {
    expect(resolverBase([])).toMatchObject({
      valorOriginal: "100",
      valorNegociado: "90",
      versaoAditivo: null,
    });
  });

  it("não usa uma versão formalizada pendente nem volta ao preço anterior", () => {
    expect(() =>
      resolverBase([{ ...versao(dinheiroMensal()), aplicacao: null }]),
    ).toThrow(/aplicação explícita/);
  });

  it("bloqueia mudança financeira no meio da cobertura", () => {
    expect(() =>
      resolverBase([
        versao({}),
        versao(dinheiroMensal(), "2026-01-15T00:00:00.000Z", 2),
      ]),
    ).toThrow(/durante/);
  });

  it("inclui uma mudança ao meio-dia do último dia civil", () => {
    expect(() =>
      resolverBase([
        versao({}),
        versao(dinheiroMensal(), "2026-02-01T12:00:00.000Z", 2),
      ]),
    ).toThrow(/durante/);
  });

  it("inclui uma mudança à meia-noite do último dia civil", () => {
    expect(() =>
      resolverBase([
        versao({}),
        versao(dinheiroMensal(), "2026-02-01T00:00:00.000Z", 2),
      ]),
    ).toThrow(/durante/);
  });

  it("exclui mudança à meia-noite do dia civil seguinte", () => {
    expect(
      resolverBase([
        versao({}),
        versao(dinheiroMensal(), "2026-02-02T00:00:00.000Z", 2),
      ]),
    ).toMatchObject({ valorNegociado: "90", versaoAditivo: { id: "v1" } });
  });

  it("considera mudança no mesmo dia em uma cobertura de um dia", () => {
    expect(() =>
      resolverMensalVigente(
        [versao(dinheiroMensal(), "2026-01-31T12:00:00.000Z")],
        new Date("2026-01-31T00:00:00.000Z"),
        new Date("2026-01-31T00:00:00.000Z"),
        "100",
        "90",
        "BRL",
      ),
    ).toThrow(/durante/);
  });

  it("recusa fim de cobertura que não seja uma data civil UTC", () => {
    expect(() =>
      resolverMensalVigente(
        [],
        new Date("2026-01-10T00:00:00.000Z"),
        new Date("2026-02-01T12:00:00.000Z"),
        "100",
        "90",
        "BRL",
      ),
    ).toThrow(/data civil/);
  });

  it("recusa início com horário para não aplicar vigência no meio de um dia civil", () => {
    expect(() => resolverMensalVigente([], new Date("2026-01-10T12:00:00Z"),
      new Date("2026-01-31T00:00:00Z"), "100", "90", "BRL")).toThrow(/data civil/);
  });

  it("bloqueia moeda incompatível e alterações de cobertura", () => {
    expect(() => resolverBase([versao(dinheiroMensal("80", "USD"))])).toThrow(/moeda/);
    expect(() =>
      resolverBase([
        versao({ COBERTURA_INICIO: { tipo: "DATA", data: "2026-01-01" } }),
      ]),
    ).toThrow(/fluxo próprio/);
  });
});

it("reconhece vencimento aplicado sem criar aplicação geral nem mudar o preço", () => {
 const condicoes = { PRIMEIRA_MENSALIDADE_VENCIMENTO: { tipo: "DATA", data: "2026-02-15" } };
 const base = { ...versao(condicoes), aplicacao: null };
 const prova = projetarAplicacoesPorCampo([{ ...base, anteriorId: null, alteracoes: [{ origem: "PRIMEIRA_MENSALIDADE_VENCIMENTO", valorEstruturado: condicoes.PRIMEIRA_MENSALIDADE_VENCIMENTO }], aplicacaoGeralId: null, aplicacaoVencimentoId: "vencimento-aplicado" }]);
 expect(resolverMensalVigente([{...base,aplicacoesPorCampo:prova}], new Date("2026-02-01"),new Date("2026-02-28"),"100","90","BRL")).toMatchObject({ valorNegociado:"90",versaoAditivo:{id:"v1"} });
 expect(()=>resolverMensalVigente([{...base,aplicacoesPorCampo:{}}],new Date("2026-02-01"),new Date("2026-02-28"),"100","90","BRL")).toThrow();
});
it("acerto aplicado não dispensa preço pendente na mesma versão", () => {
 const condicoes = {...dinheiroMensal(), PRIMEIRA_MENSALIDADE_VENCIMENTO:{tipo:"DATA",data:"2026-02-15"}};
 const base={...versao(condicoes),aplicacao:null};
 const prova=projetarAplicacoesPorCampo([{...base,anteriorId:null,alteracoes:Object.entries(condicoes).map(([origem,valorEstruturado])=>({origem,valorEstruturado})),aplicacaoGeralId:null,aplicacaoVencimentoId:"acerto"}]);
 expect(()=>resolverMensalVigente([{...base,aplicacoesPorCampo:prova}],new Date("2026-02-01"),new Date("2026-02-28"),"100","90","BRL")).toThrow("aplicação explícita");
});
