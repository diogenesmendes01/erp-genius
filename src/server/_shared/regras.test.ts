import { describe, it, expect } from "vitest";
import { EtapaLead, TipoCobranca } from "@prisma/client";
import {
  calcularComissao,
  vencimentoMensalidade,
  ehEtapaManual,
  chavePrecoReferencia,
  mesmaChavePreco,
  irmaosParaInativar,
  type ChavePreco,
} from "./regras";

describe("calcularComissao", () => {
  it("é a porcentagem da taxa", () => {
    expect(calcularComissao(299, 20)).toBeCloseTo(59.8);
    expect(calcularComissao(20000, 20)).toBe(4000);
    expect(calcularComissao(1000, 0)).toBe(0);
  });
});

describe("vencimentoMensalidade", () => {
  const base = new Date(2026, 5, 18); // junho/2026

  it("usa o dia escolhido no mês atual (offset 0)", () => {
    const { data, competencia } = vencimentoMensalidade(5, 0, base);
    expect(data.getDate()).toBe(5);
    expect(competencia).toBe("2026-06");
  });

  it("avança meses com o offset (vira o ano)", () => {
    expect(vencimentoMensalidade(10, 1, base).competencia).toBe("2026-07");
    expect(vencimentoMensalidade(10, 7, base).competencia).toBe("2027-01");
  });
});

describe("ehEtapaManual", () => {
  it("aceita etapas do funil normal", () => {
    expect(ehEtapaManual(EtapaLead.NOVO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.PROPOSTA)).toBe(true);
  });
  it("recusa etapas de fluxo próprio (Perdido / Matriculado)", () => {
    expect(ehEtapaManual(EtapaLead.PERDIDO)).toBe(false);
    expect(ehEtapaManual(EtapaLead.MATRICULADO)).toBe(false);
  });
});

describe("chave de negócio do preço (Issue #18)", () => {
  const base: ChavePreco = {
    paisId: "pais-cr",
    produtoId: "prod-ing-regular",
    modalidadeId: "mod-regular",
    tipoCobranca: TipoCobranca.MENSALIDADE,
  };

  it("é estável e independente da identidade do registro", () => {
    // Dois preços (versões) da MESMA combinação compartilham a chave —
    // por isso, ao reativar um antigo, os irmãos da chave devem ser inativados.
    const antigo = { ...base };
    const novo = { ...base };
    expect(chavePrecoReferencia(antigo)).toBe(chavePrecoReferencia(novo));
    expect(mesmaChavePreco(antigo, novo)).toBe(true);
  });

  it("muda quando qualquer parte da combinação difere", () => {
    expect(mesmaChavePreco(base, { ...base, paisId: "pais-mx" })).toBe(false);
    expect(mesmaChavePreco(base, { ...base, produtoId: "outro" })).toBe(false);
    expect(mesmaChavePreco(base, { ...base, modalidadeId: "outra" })).toBe(false);
    expect(mesmaChavePreco(base, { ...base, tipoCobranca: TipoCobranca.MATRICULA })).toBe(false);
  });

  it("serializa de forma determinística (mesma ordem de campos)", () => {
    expect(chavePrecoReferencia(base)).toBe(
      "pais-cr|prod-ing-regular|mod-regular|MENSALIDADE",
    );
  });
});

describe("irmaosParaInativar — cenário de reativação (Issue #18)", () => {
  const chave: ChavePreco = {
    paisId: "pais-cr",
    produtoId: "prod-ing-regular",
    modalidadeId: "mod-regular",
    tipoCobranca: TipoCobranca.MENSALIDADE,
  };
  const alvo = { id: "preco-antigo", ...chave };

  it("inativa o irmão ativo da mesma combinação ao reativar um preço antigo", () => {
    const atualAtivo = { id: "preco-novo", ...chave };
    expect(irmaosParaInativar(alvo, [atualAtivo])).toEqual(["preco-novo"]);
  });

  it("nunca inclui o próprio preço sendo reativado", () => {
    expect(irmaosParaInativar(alvo, [{ ...alvo }])).toEqual([]);
  });

  it("ignora ativos de outras combinações (país/produto/modalidade/tipo)", () => {
    const outroPais = { id: "p-mx", ...chave, paisId: "pais-mx" };
    const outroTipo = { id: "p-taxa", ...chave, tipoCobranca: TipoCobranca.MATRICULA };
    expect(irmaosParaInativar(alvo, [outroPais, outroTipo])).toEqual([]);
  });

  it("inativa todos os irmãos ativos da chave (cenário de dados legados)", () => {
    const irmaos = [
      { id: "a", ...chave },
      { id: "b", ...chave },
      { id: "outro", ...chave, produtoId: "x" },
    ];
    expect(irmaosParaInativar(alvo, irmaos)).toEqual(["a", "b"]);
  });

  it("não inativa nada quando não há outro ativo (apenas liga o registro)", () => {
    expect(irmaosParaInativar(alvo, [])).toEqual([]);
  });
});
