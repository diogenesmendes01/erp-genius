import { describe, expect, it } from "vitest";
import { selecionarCondicaoContinuidadeVigente } from "./continuidade-condicao-vigente";

const regras = (vigenteDesde: string) => ({
  continuidadeContratada: {
    contratada: true as const,
    clausula: "Continuidade mensal contratada.",
    evidenciaId: "documento-1",
  },
  regraCobertura: { referencia: "MES_CIVIL" as const },
  diaVencimento: 10,
  antecedenciaDias: 5, referenciaVencimento: "MES_COBERTURA" as const,
  valorOriginal: "300.00",
  valorNegociado: "250.00",
  moeda: "BRL",
  vigenteDesde,
  ajusteVencimento: "MANTER_DATA" as const,
});

const condicao = (id: string, versao: number, vigenteDesde: string) => ({
  id,
  versao,
  regras: regras(vigenteDesde),
});

describe("selecionarCondicaoContinuidadeVigente", () => {
  it("ignora versão futura e escolhe a condição já vigente", () => {
    const selecionada = selecionarCondicaoContinuidadeVigente(
      [condicao("anterior", 1, "2026-01-01"), condicao("futura", 2, "2026-04-01")],
      "2026-03-01",
    );

    expect(selecionada.condicoes.id).toBe("anterior");
  });

  it("desempata a mesma vigência pela maior versão", () => {
    const selecionada = selecionarCondicaoContinuidadeVigente(
      [condicao("v2", 2, "2026-02-01"), condicao("v3", 3, "2026-02-01")],
      "2026-02-01",
    );

    expect(selecionada.condicoes.id).toBe("v3");
  });

  it("recusa ausência de condição vigente", () => {
    expect(() => selecionarCondicaoContinuidadeVigente([condicao("futura", 1, "2026-05-01")], "2026-04-30")).toThrow(/não há condição/i);
  });

  it("recusa regra inválida mesmo quando ela é futura", () => {
    const invalida = condicao("futura-invalida", 2, "2099-01-01");
    invalida.regras.moeda = "brl";

    expect(() => selecionarCondicaoContinuidadeVigente([condicao("atual", 1, "2026-01-01"), invalida], "2026-02-01")).toThrow(/dados incompletos/i);
  });

  it("recusa data civil fora do intervalo persistível", () => {
    expect(() => selecionarCondicaoContinuidadeVigente([condicao("atual", 1, "2026-01-01")], "0000-12-31")).toThrow(/0001/);
  });

  it("não presume referência para condição legada e aceita nova versão completa já vigente", () => {
    const antiga = condicao("legada", 1, "2026-01-01");
    const semReferencia: Record<string, unknown> = { ...antiga.regras };
    delete semReferencia.referenciaVencimento;
    const historico = [{ ...antiga, regras: semReferencia }, condicao("conferida", 2, "2026-04-01")];
    expect(() => selecionarCondicaoContinuidadeVigente(historico, "2026-03-01")).toThrow();
    expect(selecionarCondicaoContinuidadeVigente(historico, "2026-04-01").condicoes.id).toBe("conferida");
    expect(semReferencia).not.toHaveProperty("referenciaVencimento");
  });

  it("não retrocede para regra completa quando a condição vigente não foi conferida", () => {
    const nova = condicao("incompleta", 2, "2026-04-01");
    const semReferencia: Record<string, unknown> = { ...nova.regras };
    delete semReferencia.referenciaVencimento;
    expect(() => selecionarCondicaoContinuidadeVigente([condicao("completa-antiga", 1, "2026-01-01"), { ...nova, regras: semReferencia }], "2026-05-01")).toThrow();
  });
});
