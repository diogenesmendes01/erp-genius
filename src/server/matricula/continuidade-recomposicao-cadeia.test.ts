import { expect, it, vi } from "vitest";
import { carregarReferenciaRecomposicaoAplicadaTx } from "./continuidade-recomposicao-tx";

const recomposicao = {
  id: "recomposicao-1", decisaoId: "decisao-1", aplicadaEm: new Date("2026-11-03T12:00:00.000Z"),
  decisao: { rascunho: { snapshot: { proposta: { periodos: [
    { cobrancaId: "cobranca-1", alterado: true, cobertura: { inicio: "2026-10-03", fim: "2026-11-02" } },
  ] } } } },
};

function aplicacao(inicioAnterior: string, fimAnterior: string, inicioNovo: string, fimNovo: string, versaoAntes: number, versaoDepois = versaoAntes + 1) {
  return {
    coberturaInicioAnterior: new Date(`${inicioAnterior}T00:00:00.000Z`), coberturaFimAnterior: new Date(`${fimAnterior}T00:00:00.000Z`),
    coberturaInicioNova: new Date(`${inicioNovo}T00:00:00.000Z`), coberturaFimNova: new Date(`${fimNovo}T00:00:00.000Z`),
    versaoCobrancaAntes: versaoAntes, versaoCobrancaDepois: versaoDepois,
  };
}

function tx(atual: { inicio: string; fim: string; versao: number }, posteriores: unknown[]) {
  return {
    aplicacaoRecomposicaoCobertura: { findFirst: vi.fn().mockResolvedValue(recomposicao) },
    cobranca: { findMany: vi.fn().mockResolvedValue([{
      id: "cobranca-1", coberturaInicio: new Date(`${atual.inicio}T00:00:00.000Z`), coberturaFim: new Date(`${atual.fim}T00:00:00.000Z`), versao: atual.versao,
    }]) },
    aplicacaoCoberturaAditivo: { findMany: vi.fn().mockResolvedValue(posteriores) },
  };
}

it("aceita somente Q168 completo que encadeie recomposição, intervalo e versão atuais", async () => {
  const banco = tx({ inicio: "2026-11-03", fim: "2026-12-02", versao: 3 }, [aplicacao("2026-10-03", "2026-11-02", "2026-11-03", "2026-12-02", 2)]);
  await expect(carregarReferenciaRecomposicaoAplicadaTx(banco as never, "matricula-1")).resolves.toMatchObject({ dataReferencia: "2026-11-03" });
  expect(banco.aplicacaoCoberturaAditivo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
    cobrancaId: "cobranca-1",
    impacto: { conjunto: { matriculaId: "matricula-1", status: "COMPLETO" } },
  }), orderBy: [{ aplicadaEm: "asc" }, { id: "asc" }] }));
});

it("aceita duas aplicações Q168 sucessivas quando intervalo e versão se encadeiam", async () => {
  const banco = tx({ inicio: "2027-01-02", fim: "2027-02-01", versao: 4 }, [
    aplicacao("2026-10-03", "2026-11-02", "2026-11-03", "2026-12-02", 2),
    aplicacao("2026-11-03", "2026-12-02", "2027-01-02", "2027-02-01", 3),
  ]);
  await expect(carregarReferenciaRecomposicaoAplicadaTx(banco as never, "matricula-1")).resolves.toMatchObject({ dataReferencia: "2026-11-03" });
});

it("bloqueia alteração posterior mesmo se existe uma Q168 legítima", async () => {
  const banco = tx({ inicio: "2026-11-03", fim: "2026-12-03", versao: 4 }, [aplicacao("2026-10-03", "2026-11-02", "2026-11-03", "2026-12-02", 2)]);
  await expect(carregarReferenciaRecomposicaoAplicadaTx(banco as never, "matricula-1")).rejects.toThrow(/alterada por outra origem/);
  expect(banco.aplicacaoCoberturaAditivo.findMany).toHaveBeenCalled();
});
