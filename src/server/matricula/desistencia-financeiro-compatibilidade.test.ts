import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { carregarFinanceiroDesistenciaTx } from "./desistencia-financeiro-tx";

describe("compatibilidade da fotografia financeira Q121", () => {
  it("preserva a fotografia e o hash anteriores quando novas origens estão vazias", async () => {
    const credito = {
      id: "credito", origemLiberacaoId: null, origemAcertoId: "acerto",
      origemPeriodoIntegralId: null, origemDestinacaoRecebimentoId: null,
      origemAcertoDesistenciaContratualId: null,
      valorInicial: new Prisma.Decimal("37.50"), moeda: "BRL",
      criadoEm: new Date("2026-09-16T12:00:00.000Z"),
      origemAcertoTaxaAditivoId: null, origemReconferenciaDeltaDesistenciaId: null,
    };
    const vazio = { findMany: vi.fn().mockResolvedValue([]) };
    const tx = {
      cobranca: vazio,
      creditoMatricula: { findMany: vi.fn(async ({ select }: { select: Record<string, boolean> }) => [
        Object.fromEntries(Object.entries(credito).filter(([campo]) => select[campo])),
      ]) },
      pagamentoInformado: vazio, destinacaoRecebimento: vazio,
      propostaUsoCredito: vazio, compensacaoCoberturaMatricula: vazio,
      itemEmissaoEntrada: vazio, ajusteCobrancaAcerto: vazio,
      emissaoFechamentoHoras: vazio, emissaoCobrancasEntrada: vazio,
      decisaoUsoCredito: vazio, diaCompensacaoCobertura: vazio,
    } as unknown as Prisma.TransactionClient;
    // Formato persistido antes da reconferência249. Acrescentar um null
    // invalidaria decisões antigas apesar de nenhum fato financeiro mudar.
    const anterior = { matriculaId: "matricula", cobrancas: [], creditos: [{
      id: "credito", origemLiberacaoId: null, origemAcertoId: "acerto",
      origemPeriodoIntegralId: null, origemDestinacaoRecebimentoId: null,
      origemAcertoDesistenciaContratualId: null, valorInicial: "37.50", moeda: "BRL",
      criadoEm: "2026-09-16T12:00:00.000Z",
    }] };
    const { snapshot } = await carregarFinanceiroDesistenciaTx(tx, "matricula");
    expect(snapshot).toEqual(anterior);
    expect(hashSubstituicao(snapshot)).toBe(hashSubstituicao(anterior));
  });
});
