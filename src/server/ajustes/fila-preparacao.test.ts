import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { avaliarPreparacaoNaFila } from "./fila-preparacao";

const criadaEm = new Date("2026-10-01T12:00:00Z");
const componente = (resultado: "DENTRO_ALCADA" | "EXIGE_APROVACAO" | "REFERENCIA_INSUFICIENTE", extra: Record<string, unknown> = {}) => ({
  tipo: "MENSALIDADE", referencia: "100.00", proposto: "80.00", limitePct: "10", descontoPct: "20", resultado, ...extra,
});
const referencias = (parcial: Record<string, unknown> = {}) => ({
  exigeDirecao: false,
  ...parcial,
  alcada: { componentes: [componente("DENTRO_ALCADA", { tipo: "MATRICULA", referencia: "50.00", proposto: "50.00", descontoPct: "0" }), componente("EXIGE_APROVACAO")] },
});

describe("avaliarPreparacaoNaFila", () => {
  it("oculta preço dentro da alçada e exceção acima da alçada do gerente", () => {
    const dentro = { exigeDirecao: false, alcada: { componentes: [componente("DENTRO_ALCADA", { tipo: "MATRICULA" }), componente("DENTRO_ALCADA")] } };
    expect(avaliarPreparacaoNaFila({ admin: false, referencias: dentro, criadaEm, alcadaAlteradaEm: null, limites: { limiteDescontoTaxaPct: new Prisma.Decimal(10), limiteDescontoMensalidadePct: new Prisma.Decimal(10) } }).visivel).toBe(false);
    const acima = avaliarPreparacaoNaFila({ admin: false, referencias: referencias({}), criadaEm, alcadaAlteradaEm: null, limites: { limiteDescontoTaxaPct: new Prisma.Decimal(10), limiteDescontoMensalidadePct: new Prisma.Decimal(10) } });
    expect(acima).toEqual({ visivel: false, podeAprovarDireto: false });
  });

  it("gerente vê exceção na alçada e esconde direção; admin aprova direto", () => {
    const limites = { limiteDescontoTaxaPct: new Prisma.Decimal(30), limiteDescontoMensalidadePct: new Prisma.Decimal(30) };
    expect(avaliarPreparacaoNaFila({ admin: false, referencias: referencias({}), criadaEm, alcadaAlteradaEm: null, limites })).toEqual({ visivel: true, podeAprovarDireto: true });
    expect(avaliarPreparacaoNaFila({ admin: false, referencias: referencias({ exigeDirecao: true }), criadaEm, alcadaAlteradaEm: null, limites }).visivel).toBe(false);
    expect(avaliarPreparacaoNaFila({ admin: true, referencias: referencias({ exigeDirecao: true }), criadaEm, alcadaAlteradaEm: null, limites: null })).toEqual({ visivel: true, podeAprovarDireto: true });
  });

  it("componente gravado dentro da alçada que estourou o limite atual não libera Aprovar", () => {
    const refs = {
      exigeDirecao: false,
      alcada: { componentes: [
        componente("DENTRO_ALCADA", { tipo: "MATRICULA", referencia: "100.00", proposto: "50.00", descontoPct: "50" }),
        componente("EXIGE_APROVACAO", { referencia: "100.00", proposto: "90.00", descontoPct: "10" }),
      ] },
    };
    const limites = { limiteDescontoTaxaPct: new Prisma.Decimal(10), limiteDescontoMensalidadePct: new Prisma.Decimal(30) };
    expect(avaliarPreparacaoNaFila({ admin: false, referencias: refs, criadaEm, alcadaAlteradaEm: null, limites })).toEqual({ visivel: true, podeAprovarDireto: false });
  });

  it("exigeDirecao ausente segue o default do servidor e esconde a fila do gerente", () => {
    const { alcada } = referencias();
    const refs = { alcada };
    const limites = { limiteDescontoTaxaPct: new Prisma.Decimal(30), limiteDescontoMensalidadePct: new Prisma.Decimal(30) };
    expect(avaliarPreparacaoNaFila({ admin: false, referencias: refs, criadaEm, alcadaAlteradaEm: null, limites }).visivel).toBe(false);
    expect(avaliarPreparacaoNaFila({ admin: true, referencias: refs, criadaEm, alcadaAlteradaEm: null, limites: null })).toEqual({ visivel: true, podeAprovarDireto: true });
  });

  it("referência insuficiente fica na fila sem aprovação direta", () => {
    const refs = { exigeDirecao: false, alcada: { componentes: [componente("DENTRO_ALCADA", { tipo: "MATRICULA" }), componente("REFERENCIA_INSUFICIENTE", { referencia: null, descontoPct: null })] } };
    expect(avaliarPreparacaoNaFila({ admin: false, referencias: refs, criadaEm, alcadaAlteradaEm: new Date("2026-10-02T00:00:00Z"), limites: { limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null } })).toEqual({ visivel: true, podeAprovarDireto: false });
  });
});
