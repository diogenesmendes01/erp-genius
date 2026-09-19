import { describe, expect, it } from "vitest";
import { periodosRetomadaReprogramada, referenciaVencimentoCivil } from "./vencimento-civil";

describe("referência civil do vencimento", () => {
  it("reconstrói somente as fontes imutáveis que correspondem ao instante persistido", () => {
    expect(referenciaVencimentoCivil({
      id: "entrada", versao: 1, vencimento: new Date("2099-02-28T18:00:00.000Z"),
      itemEmissaoEntrada: { emissao: { memoria: { fusoInstitucional: "America/Costa_Rica", cobrancas: [{ id: "entrada", vencimento: "2099-02-28" }] } } },
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: "America/Costa_Rica", origem: "EMISSAO_ENTRADA" });

    expect(referenciaVencimentoCivil({
      id: "fechamento", versao: 1, vencimento: new Date("2099-02-28T15:00:00.000Z"),
      emissaoFechamentoHoras: { memoria: { periodo: { vencimento: "2099-02-28", fuso: "America/Sao_Paulo" } } },
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: "America/Sao_Paulo", origem: "FECHAMENTO_HORAS" });

    expect(referenciaVencimentoCivil({
      id: "continuidade", versao: 1, vencimento: new Date("2099-02-28T06:00:00.000Z"),
      emissaoContinuidadeGerada: [{ snapshot: { fusoInstitucional: "America/Costa_Rica", plano: { vencimento: "2099-02-28" } } }],
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: "America/Costa_Rica", origem: "EMISSAO_CONTINUIDADE" });
  });

  it("não inventa fuso para legado nem aceita memória cujo instante divergiu", () => {
    expect(referenciaVencimentoCivil({ id: "legado", versao: 1, vencimento: new Date("2099-02-28T00:00:00.000Z") })).toMatchObject({ estado: "A_CONFERIR" });
    expect(referenciaVencimentoCivil({
      id: "divergente", versao: 1, vencimento: new Date("2099-02-28T00:00:00.000Z"),
      emissaoContinuidadeGerada: [{ snapshot: { fusoInstitucional: "America/Costa_Rica", plano: { vencimento: "2099-02-28" } } }],
    })).toMatchObject({ estado: "A_CONFERIR" });
  });

  it("prioriza a última alteração efetiva, preservando referência após pagamento e data civil sem fuso quando a fonte não o guarda", () => {
    const cobranca = {
      id: "c", versao: 4, vencimento: new Date("2099-03-15T18:00:00.000Z"),
      itemEmissaoEntrada: { emissao: { memoria: { fusoInstitucional: "America/Costa_Rica", cobrancas: [{ id: "c", vencimento: "2099-02-10" }] } } },
      aplicacoesAditivoVencimento: [
        { id: "primeira", aplicadaEm: new Date("2099-01-01T10:00:00Z"), versaoCobrancaDepois: 2, vencimentoAnterior: new Date("2099-02-10T18:00:00Z"), vencimentoNovo: new Date("2099-03-10T18:00:00Z"), fuso: "America/Costa_Rica" },
        { id: "segunda", aplicadaEm: new Date("2099-01-02T10:00:00Z"), versaoCobrancaDepois: 3, vencimentoAnterior: new Date("2099-03-10T18:00:00Z"), vencimentoNovo: new Date("2099-03-15T18:00:00Z"), fuso: "America/Costa_Rica" },
      ],
    };
    expect(referenciaVencimentoCivil(cobranca)).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-03-15", fuso: "America/Costa_Rica", origem: "ADITIVO_VENCIMENTO" });

    expect(referenciaVencimentoCivil({ id: "m01", versao: 1, vencimento: new Date("2099-02-10T00:00:00Z"), aplicacoesM01: [{ id: "m01-app", aplicadaEm: new Date("2099-01-01T10:00:00Z"), vencimento: new Date("2099-02-10T00:00:00Z") }] })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-02-10", fuso: null, origem: "M01_HISTORICO" });
  });

  it("não volta à emissão quando a última alteração de vencimento não reconcilia com a cobrança", () => {
    expect(referenciaVencimentoCivil({
      id: "c", versao: 2, vencimento: new Date("2099-03-11T18:00:00Z"),
      itemEmissaoEntrada: { emissao: { memoria: { fusoInstitucional: "America/Costa_Rica", cobrancas: [{ id: "c", vencimento: "2099-02-10" }] } } },
      aplicacoesAditivoVencimento: [{ id: "aplicada", aplicadaEm: new Date("2099-01-02T10:00:00Z"), versaoCobrancaDepois: 2, vencimentoAnterior: new Date("2099-02-10T18:00:00Z"), vencimentoNovo: new Date("2099-03-10T18:00:00Z"), fuso: "America/Costa_Rica" }],
    })).toMatchObject({ estado: "A_CONFERIR" });

    expect(referenciaVencimentoCivil({
      id: "fuso-legado", versao: 2, vencimento: new Date("2099-03-10T18:00:00Z"),
      aplicacoesAditivoVencimento: [{ id: "fuso-invalido", aplicadaEm: new Date("2099-01-02T10:00:00Z"), versaoCobrancaDepois: 2, vencimentoAnterior: new Date("2099-02-10T18:00:00Z"), vencimentoNovo: new Date("2099-03-10T18:00:00Z"), fuso: "Factory" }],
    })).toMatchObject({ estado: "A_CONFERIR" });
  });

  it("usa a versão da cobrança, e não o relógio da aplicação, e só rejeita fuso inválido na cabeça", () => {
    const mesmaHora = new Date("2099-01-02T10:00:00Z");
    expect(referenciaVencimentoCivil({
      id: "c", versao: 3, vencimento: new Date("2099-03-15T18:00:00Z"),
      aplicacoesAditivoVencimento: [
        { id: "fuso-legado", aplicadaEm: mesmaHora, versaoCobrancaDepois: 2, vencimentoAnterior: new Date("2099-02-10T18:00:00Z"), vencimentoNovo: new Date("2099-03-10T18:00:00Z"), fuso: "Factory" },
        { id: "cabeca", aplicadaEm: mesmaHora, versaoCobrancaDepois: 3, vencimentoAnterior: new Date("2099-03-10T18:00:00Z"), vencimentoNovo: new Date("2099-03-15T18:00:00Z"), fuso: "America/Costa_Rica" },
      ],
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-03-15", fuso: "America/Costa_Rica", origem: "ADITIVO_VENCIMENTO" });

    expect(referenciaVencimentoCivil({
      id: "c", versao: 3, vencimento: new Date("2099-03-15T18:00:00Z"),
      aplicacoesAditivoVencimento: [
        { id: "valida-antiga", aplicadaEm: mesmaHora, versaoCobrancaDepois: 2, vencimentoAnterior: new Date("2099-02-10T18:00:00Z"), vencimentoNovo: new Date("2099-03-10T18:00:00Z"), fuso: "America/Costa_Rica" },
        { id: "fuso-cabeca", aplicadaEm: mesmaHora, versaoCobrancaDepois: 3, vencimentoAnterior: new Date("2099-03-10T18:00:00Z"), vencimentoNovo: new Date("2099-03-15T18:00:00Z"), fuso: "Factory" },
      ],
    })).toMatchObject({ estado: "A_CONFERIR" });
  });

  it("reconhece acerto de taxa e retomada aplicados como datas civis, sem forçar fuso", () => {
    expect(referenciaVencimentoCivil({
      id: "taxa", versao: 3, vencimento: new Date("2099-04-10T00:00:00Z"),
      aplicacoesAcertoTaxaAditivo: [{ id: "taxa-app", aplicadaEm: new Date("2099-01-03T10:00:00Z"), versaoAnterior: 2, vencimentoAnterior: new Date("2099-03-10T00:00:00Z"), vencimentoNovo: new Date("2099-04-10T00:00:00Z") }],
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-04-10", fuso: null, origem: "ACERTO_TAXA_ADITIVO" });

    expect(referenciaVencimentoCivil({
      id: "mensal", versao: 2, vencimento: new Date("2099-05-20T00:00:00Z"),
      retomadasReprogramadas: [{ id: "retomada", aplicadaEm: new Date("2099-01-04T10:00:00Z"), periodos: [{ cobrancaId: "mensal", vencimentoAnterior: "2099-05-10", vencimento: "2099-05-20" }] }],
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-05-20", fuso: null, origem: "RETOMADA_REPROGRAMADA" });

    const snapshot = { matriculas: [{ periodos: [{ cobrancaId: "mensal", vencimentoAnterior: "2099-05-10", vencimento: "2099-05-20" }] }] };
    expect(periodosRetomadaReprogramada(snapshot, { matriculas: [{ vencimentos: { opcao: "MANTER_VENCIMENTOS" } }] })).toEqual([]);
    expect(periodosRetomadaReprogramada(snapshot, { matriculas: [{ vencimentos: { opcao: "REPROGRAMAR_PARCELAS", datas: [{ cobrancaId: "mensal", vencimento: "2099-05-20" }] } }] })).toEqual(snapshot.matriculas[0].periodos);
  });

  it("usa a versão fotografada de novas retomadas ao encadear outra alteração de vencimento", () => {
    const snapshot = { matriculas: [{ periodos: [{ cobrancaId: "mensal", vencimentoAnterior: "2099-05-10", vencimento: "2099-05-20", versaoCobrancaAntes: 2 }] }] };
    const retomadas = [{ id: "retomada", aplicadaEm: new Date("2099-01-01T10:00:00Z"), periodos: periodosRetomadaReprogramada(snapshot, { matriculas: [{ vencimentos: { opcao: "REPROGRAMAR_PARCELAS", datas: [{ cobrancaId: "mensal", vencimento: "2099-05-20" }] } }] }) }];
    expect(referenciaVencimentoCivil({
      id: "mensal", versao: 4, vencimento: new Date("2099-06-10T00:00:00Z"), retomadasReprogramadas: retomadas,
      aplicacoesAcertoTaxaAditivo: [{ id: "taxa", aplicadaEm: new Date("2099-01-01T10:00:00Z"), versaoAnterior: 3, vencimentoAnterior: new Date("2099-05-20T00:00:00Z"), vencimentoNovo: new Date("2099-06-10T00:00:00Z") }],
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-06-10", fuso: null, origem: "ACERTO_TAXA_ADITIVO" });
  });

  it("mantém legado sem âncora em conferência e considera REPROGRAMAR mesmo sem mudar a data civil", () => {
    expect(referenciaVencimentoCivil({
      id: "legado", versao: 3, vencimento: new Date("2099-06-10T00:00:00Z"),
      retomadasReprogramadas: [{ id: "retomada-antiga", aplicadaEm: new Date("2099-01-01T10:00:00Z"), periodos: [{ cobrancaId: "legado", vencimentoAnterior: "2099-05-20", vencimento: "2099-05-20" }] }],
      aplicacoesAcertoTaxaAditivo: [{ id: "taxa", aplicadaEm: new Date("2099-01-02T10:00:00Z"), versaoAnterior: 2, vencimentoAnterior: new Date("2099-05-20T00:00:00Z"), vencimentoNovo: new Date("2099-06-10T00:00:00Z") }],
    })).toMatchObject({ estado: "A_CONFERIR" });

    expect(referenciaVencimentoCivil({
      id: "mesma-data", versao: 2, vencimento: new Date("2099-05-20T00:00:00Z"),
      retomadasReprogramadas: [{ id: "retomada-nova", aplicadaEm: new Date("2099-01-01T10:00:00Z"), periodos: [{ cobrancaId: "mesma-data", vencimentoAnterior: "2099-05-20", vencimento: "2099-05-20", versaoCobrancaDepois: 2 }] }],
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-05-20", fuso: null, origem: "RETOMADA_REPROGRAMADA" });
  });
});
