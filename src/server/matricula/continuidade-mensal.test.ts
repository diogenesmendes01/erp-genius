import { describe, expect, it } from "vitest";
import { planejarContinuidadeMensal, planejarContinuidadeMensalAposRetomada, planejarContinuidadeMensalAposRetomadaComRegra, planejarContinuidadeMensalAposRecomposicao } from "./continuidade-mensal";
import type { EntradaPlanejarContinuidadeMensal } from "./continuidade-mensal-schema";
import { executarAcao } from "@/server/_shared";

const entrada = (): EntradaPlanejarContinuidadeMensal => ({
  continuidadeContratada: {
    contratada: true,
    clausula: "Cláusula de continuidade mensal contratada.",
    evidenciaId: "documento-continuidade",
  },
  regraCobertura: { referencia: "MES_CIVIL" },
  ultimaCobertura: { inicio: "2026-01-01", fim: "2026-01-31" },
  ultimoVencimento: "2026-01-10",
  diaVencimento: 10,
  referenciaVencimento: "MES_COBERTURA",
  antecedenciaDias: 5,
  valorOriginal: "300.00",
  valorNegociado: "250.00",
  moeda: "BRL",
  vigenteDesde: "2026-01-01",
  ajusteVencimento: "MANTER_DATA",
  dataPlanejamento: "2026-02-04",
});

describe("planejarContinuidadeMensal", () => {
  it("apresenta a necessidade de conferir a vigência em vez de erro inesperado na ação", async () => {
    const dados = entrada();
    dados.ajusteVencimento = { regra: "PROXIMO_DIA_UTIL", calendario: {
      id: "financeiro", versao: 1, referencia: "Calendário vencido", inicioVigencia: "2026-01-01", fimVigencia: "2026-01-31", diasSemanaUteis: [1, 2, 3, 4, 5], feriados: [],
    } };
    expect(await executarAcao(async () => planejarContinuidadeMensal(dados))).toEqual({
      ok: false, erro: "Conferência necessária: data calculada fora da vigência do calendário financeiro.",
    });
  });
  it("ajusta o vencimento após retomada sem rejeitar o trecho final autorizado nem alterar a cobertura", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2026-01-18", fim: "2026-01-31" };
    dados.diaVencimento = 31;
    dados.ajusteVencimento = { regra: "PROXIMO_DIA_UTIL", calendario: {
      id: "financeiro", versao: 1, referencia: "Calendário contratual", inicioVigencia: "2026-01-01", fimVigencia: "2026-12-31", diasSemanaUteis: [1, 2, 3, 4, 5], feriados: [],
    } };
    expect(planejarContinuidadeMensalAposRetomada(dados)).toMatchObject({
      cobertura: { inicio: "2026-02-01", fim: "2026-02-28" }, vencimento: "2026-03-02", emissaoEm: "2026-02-25",
    });
    expect(() => planejarContinuidadeMensal(dados)).toThrow(/cobertura/);
  });
  it("continua depois do trecho contratual de uma retomada aplicada sem cobrar esse trecho novamente", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2026-01-18", fim: "2026-01-31" };
    expect(() => planejarContinuidadeMensal(dados)).toThrow();
    expect(planejarContinuidadeMensalAposRetomada(dados)).toMatchObject({
      cobertura: { inicio: "2026-02-01", fim: "2026-02-28", dias: 28 },
      valorNegociado: "250.00", vencimento: "2026-02-10",
    });
  });

  it("mantém a âncora vigente quando a retomada sucede uma recomposição", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2026-03-18", fim: "2026-04-17" };
    expect(planejarContinuidadeMensalAposRetomadaComRegra(dados, {
      referencia: "CICLO_MATRICULA", dataReferencia: "2026-03-18",
    }).cobertura).toEqual({ inicio: "2026-04-18", fim: "2026-05-17", dias: 30 });
  });

  it("continua o ciclo com âncora 31 após a cobertura parcial aprovada no retorno", () => {
    const dados = entrada();
    dados.regraCobertura = { referencia: "CICLO_MATRICULA", dataReferencia: "2026-01-31" };
    dados.ultimaCobertura = { inicio: "2026-02-12", fim: "2026-02-27" };
    expect(planejarContinuidadeMensalAposRetomada(dados).cobertura).toEqual({ inicio: "2026-02-28", fim: "2026-03-30", dias: 31 });
  });

  it("a retomada não permite fim incompatível com a referência contratual", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2026-01-18", fim: "2026-02-02" };
    expect(() => planejarContinuidadeMensalAposRetomada(dados)).toThrow(/última cobertura/);
  });
  it("planeja somente o próximo mês civil, sem emitir cobrança", () => {
    expect(planejarContinuidadeMensal(entrada())).toEqual({
      cobertura: { inicio: "2026-02-01", fim: "2026-02-28", dias: 28 },
      vencimento: "2026-02-10",
      emissaoEm: "2026-02-05",
      memoriaVencimento: { dataCalculada: "2026-02-10", dataAjustada: "2026-02-10", regraAplicada: "MANTER_DATA", referenciaCalendarioAplicada: null },
      valorOriginal: "300.00",
      valorNegociado: "250.00",
      moeda: "BRL",
      status: "AGUARDAR_EMISSAO",
    });
  });

  it("clampa o dia 31 no fevereiro bissexto e calcula a antecedência", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2024-01-01", fim: "2024-01-31" };
    dados.diaVencimento = 31;
    dados.ultimoVencimento = "2024-01-31";
    dados.antecedenciaDias = 3;
    dados.dataPlanejamento = "2024-02-26";
    dados.vigenteDesde = "2024-01-01";

    expect(planejarContinuidadeMensal(dados)).toMatchObject({
      cobertura: { inicio: "2024-02-01", fim: "2024-02-29", dias: 29 },
      vencimento: "2024-02-29",
      emissaoEm: "2024-02-26",
      status: "PRONTA_PARA_EMISSAO",
    });
  });

  it("preserva o dia 31 depois do clamp de fevereiro", () => {
    const fevereiro = entrada();
    fevereiro.ultimaCobertura = { inicio: "2026-01-01", fim: "2026-01-31" };
    fevereiro.ultimoVencimento = "2026-01-31";
    fevereiro.diaVencimento = 31;
    expect(planejarContinuidadeMensal(fevereiro).vencimento).toBe("2026-02-28");

    const marco = entrada();
    marco.ultimaCobertura = { inicio: "2026-02-01", fim: "2026-02-28" };
    marco.ultimoVencimento = "2026-02-28";
    marco.diaVencimento = 31;
    expect(planejarContinuidadeMensal(marco).vencimento).toBe("2026-03-31");
  });

  it("não remapeia o ano civil 0099 para 1999", () => {
    const dados = entrada();
    dados.ultimoVencimento = "0099-01-31";
    dados.ultimaCobertura = { inicio: "0099-01-01", fim: "0099-01-31" };
    dados.vigenteDesde = "0099-01-01";
    dados.diaVencimento = 31;
    expect(planejarContinuidadeMensal(dados).vencimento).toBe("0099-02-28");
  });

  it("recusa o ano 0000, incompatível com a persistência", () => {
    const dados = entrada();
    dados.ultimoVencimento = "0000-01-31";
    expect(() => planejarContinuidadeMensal(dados)).toThrow(/0001/);
  });

  it("segue o próximo ciclo da matrícula, independente do vencimento", () => {
    const dados = entrada();
    dados.regraCobertura = {
      referencia: "CICLO_MATRICULA",
      dataReferencia: "2026-01-31",
    };
    dados.ultimaCobertura = { inicio: "2026-01-31", fim: "2026-02-27" };
    dados.diaVencimento = 5;
    dados.ultimoVencimento = "2026-01-05";

    expect(planejarContinuidadeMensal(dados)).toMatchObject({
      cobertura: { inicio: "2026-02-28", fim: "2026-03-30", dias: 31 },
      vencimento: "2026-02-05",
    });
  });

  it("recusa continuidade sem previsão contratual, antecedência ou cláusula", () => {
    const semContinuidade = entrada() as Record<string, unknown>;
    semContinuidade.continuidadeContratada = { contratada: false };
    expect(() => planejarContinuidadeMensal(semContinuidade as EntradaPlanejarContinuidadeMensal)).toThrow();

    const semAntecedencia = entrada() as Record<string, unknown>;
    delete semAntecedencia.antecedenciaDias;
    expect(() => planejarContinuidadeMensal(semAntecedencia as EntradaPlanejarContinuidadeMensal)).toThrow();

    const semClausula = entrada();
    semClausula.continuidadeContratada.clausula = " ";
    expect(() => planejarContinuidadeMensal(semClausula)).toThrow();

    const semEvidencia = entrada() as Record<string, unknown>;
    semEvidencia.continuidadeContratada = {
      contratada: true,
      clausula: "Cláusula contratada.",
    };
    expect(() => planejarContinuidadeMensal(semEvidencia as EntradaPlanejarContinuidadeMensal)).toThrow();
  });

  it("recusa cobertura anterior que não seja período contratual completo", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2026-01-02", fim: "2026-01-31" };
    expect(() => planejarContinuidadeMensal(dados)).toThrow(/última cobertura/);
  });

  it("recusa calendário de próximo dia útil sem regra contratual suportada", () => {
    const dados = entrada() as Record<string, unknown>;
    dados.ajusteVencimento = "PROXIMO_DIA_UTIL";
    expect(() => planejarContinuidadeMensal(dados as EntradaPlanejarContinuidadeMensal)).toThrow();
  });

  it("usa a referência contratual da cobertura, preservando a data antiga apenas no histórico", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2026-01-01", fim: "2026-01-31" };
    dados.ultimoVencimento = "2026-03-31";
    dados.diaVencimento = 31;
    dados.dataPlanejamento = "2026-04-01";

    expect(planejarContinuidadeMensal(dados)).toMatchObject({
      cobertura: { inicio: "2026-02-01", fim: "2026-02-28" },
      vencimento: "2026-02-28",
    });
  });

  it.each([
    ["MES_ANTERIOR", "2026-11-30"],
    ["MES_COBERTURA", "2026-12-31"],
    ["MES_SEGUINTE", "2027-01-31"],
  ] as const)("calcula %s depois de cobertura reprogramada sem reutilizar vencimento antigo", (referenciaVencimento, vencimento) => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2026-11-01", fim: "2026-11-30" };
    dados.ultimoVencimento = "2026-09-05";
    dados.diaVencimento = 31;
    dados.referenciaVencimento = referenciaVencimento;
    expect(planejarContinuidadeMensal(dados)).toMatchObject({ cobertura: { inicio: "2026-12-01", fim: "2026-12-31" }, vencimento });
  });

  it("exige referência de vencimento explícita e não completa contrato legado", () => {
    const dados = entrada() as Record<string, unknown>;
    delete dados.referenciaVencimento;
    expect(() => planejarContinuidadeMensal(dados as EntradaPlanejarContinuidadeMensal)).toThrow();
  });

  it("recusa antecedência cujo cálculo sai do intervalo de data civil", () => {
    const dados = entrada();
    dados.antecedenciaDias = Number.MAX_SAFE_INTEGER;
    expect(() => planejarContinuidadeMensal(dados)).toThrow(/fora do intervalo civil/);
  });
  it("Q162 inicia o ciclo deslocado no dia seguinte e o propaga nos meses seguintes", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2026-10-03", fim: "2026-11-02" };
    dados.diaVencimento = 31;
    const origem = { aplicacaoId: "aplicacao-1", decisaoId: "decisao-1", cobrancaId: "cobranca-1", dataReferencia: "2026-11-03" };
    const primeiro = planejarContinuidadeMensalAposRecomposicao(dados, origem);
    expect(primeiro).toMatchObject({ cobertura: { inicio: "2026-11-03", fim: "2026-12-02", dias: 30 }, vencimento: "2026-11-30", memoriaCobertura: { regraAplicada: { referencia: "CICLO_MATRICULA", dataReferencia: "2026-11-03" }, origemRecomposicao: origem } });
    const segundo = planejarContinuidadeMensalAposRecomposicao({ ...dados, ultimaCobertura: { inicio: primeiro.cobertura.inicio, fim: primeiro.cobertura.fim } }, origem);
    expect(segundo.cobertura).toEqual({ inicio: "2026-12-03", fim: "2027-01-02", dias: 31 });
  });

  it("Q162 preserva a âncora 31 depois de fevereiro curto", () => {
    const dados = entrada();
    dados.ultimaCobertura = { inicio: "2027-01-31", fim: "2027-02-27" };
    const origem = { aplicacaoId: "aplicacao-31", decisaoId: "decisao-31", cobrancaId: "cobranca-31", dataReferencia: "2027-01-31" };
    expect(planejarContinuidadeMensalAposRecomposicao(dados, origem).cobertura).toEqual({ inicio: "2027-02-28", fim: "2027-03-30", dias: 31 });
  });
});




it("Q162 não pula um intervalo entre a última cobertura e a referência comprovada", () => {
  const dados = entrada();
  dados.ultimaCobertura = { inicio: "2026-10-01", fim: "2026-10-31" };
  expect(() => planejarContinuidadeMensalAposRecomposicao(dados, {
    aplicacaoId: "aplicacao-1", decisaoId: "decisao-1", cobrancaId: "cobranca-1", dataReferencia: "2026-11-03",
  })).toThrow(/anterior à âncora/);
});
