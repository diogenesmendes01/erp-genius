import { describe, expect, it } from "vitest";
import { referenciaVencimentoCivil } from "./vencimento-civil";

describe("referência civil do vencimento", () => {
  it("reconstrói somente as fontes imutáveis que correspondem ao instante persistido", () => {
    expect(referenciaVencimentoCivil({
      id: "entrada", vencimento: new Date("2099-02-28T18:00:00.000Z"),
      itemEmissaoEntrada: { emissao: { memoria: { fusoInstitucional: "America/Costa_Rica", cobrancas: [{ id: "entrada", vencimento: "2099-02-28" }] } } },
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: "America/Costa_Rica", origem: "EMISSAO_ENTRADA" });

    expect(referenciaVencimentoCivil({
      id: "fechamento", vencimento: new Date("2099-02-28T15:00:00.000Z"),
      emissaoFechamentoHoras: { memoria: { periodo: { vencimento: "2099-02-28", fuso: "America/Sao_Paulo" } } },
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: "America/Sao_Paulo", origem: "FECHAMENTO_HORAS" });

    expect(referenciaVencimentoCivil({
      id: "continuidade", vencimento: new Date("2099-02-28T06:00:00.000Z"),
      emissaoContinuidadeGerada: [{ snapshot: { fusoInstitucional: "America/Costa_Rica", plano: { vencimento: "2099-02-28" } } }],
    })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: "America/Costa_Rica", origem: "EMISSAO_CONTINUIDADE" });
  });

  it("não inventa fuso para legado nem aceita memória cujo instante divergiu", () => {
    expect(referenciaVencimentoCivil({ id: "legado", vencimento: new Date("2099-02-28T00:00:00.000Z") })).toMatchObject({ estado: "A_CONFERIR" });
    expect(referenciaVencimentoCivil({
      id: "divergente", vencimento: new Date("2099-02-28T00:00:00.000Z"),
      emissaoContinuidadeGerada: [{ snapshot: { fusoInstitucional: "America/Costa_Rica", plano: { vencimento: "2099-02-28" } } }],
    })).toMatchObject({ estado: "A_CONFERIR" });
  });
});
