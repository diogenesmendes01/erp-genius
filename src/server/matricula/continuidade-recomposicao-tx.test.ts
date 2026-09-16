import { describe, expect, it, vi } from "vitest";
import { ErroRegra } from "@/server/_shared";
import { carregarReferenciaRecomposicaoAplicadaTx, conferirCompensacaoProgramadaContinuidadeTx, conferirOrigensConcorrentesAposRecomposicaoTx } from "./continuidade-recomposicao-tx";

const tx = (resultado: { id: string; direitoId: string; dataCobertura: Date } | null) => ({
  diaProgramadoRecomposicao: { findFirst: vi.fn().mockResolvedValue(resultado) },
});

const aplicacao = (matriculaId = "matricula-1") => ({
  id: "aplicacao-1", decisaoId: "decisao-1", aplicadaEm: new Date("2026-11-03T12:00:00Z"),
  decisao: { rascunho: { snapshot: { proposta: { periodos: [
    { cobrancaId: "cobranca-1", alterado: true, cobertura: { inicio: "2026-10-03", fim: "2026-11-02" } },
    { cobrancaId: "cobranca-antiga", alterado: false, cobertura: { inicio: "2026-09-01", fim: "2026-09-30" } },
  ] } } } },
});

function txReferencia(resultado: ReturnType<typeof aplicacao> | null, cobrancas: unknown[]) {
  return {
    aplicacaoRecomposicaoCobertura: { findFirst: vi.fn().mockResolvedValue(resultado) },
    cobranca: { findMany: vi.fn().mockResolvedValue(cobrancas) },
  };
}

describe("conferirCompensacaoProgramadaContinuidadeTx", () => {
  it("recusa mensalidade que alcance dia jÃ¡ destinado Ã  recomposiÃ§Ã£o", async () => {
    const banco = tx({ id: "programacao-1", direitoId: "direito-1", dataCobertura: new Date("2026-10-03T00:00:00Z") });
    await expect(conferirCompensacaoProgramadaContinuidadeTx(banco as never, { matriculaId: "matricula-1", inicio: new Date("2026-10-01T00:00:00Z"), fim: new Date("2026-10-31T00:00:00Z") })).rejects.toThrow("2026-10-03");
  });
  it("permite a cobertura quando nÃ£o hÃ¡ dia compensado nela", async () => {
    await expect(conferirCompensacaoProgramadaContinuidadeTx(tx(null) as never, { matriculaId: "matricula-1", inicio: new Date("2026-11-01T00:00:00Z"), fim: new Date("2026-11-30T00:00:00Z") })).resolves.toBeUndefined();
  });
  it("recusa data que nÃ£o seja civil UTC antes de consultar o banco", async () => {
    const banco = tx(null);
    await expect(conferirCompensacaoProgramadaContinuidadeTx(banco as never, { matriculaId: "matricula-1", inicio: new Date("2026-11-01T01:00:00Z"), fim: new Date("2026-11-30T00:00:00Z") })).rejects.toBeInstanceOf(ErroRegra);
    expect(banco.diaProgramadoRecomposicao.findFirst).not.toHaveBeenCalled();
  });
});

describe("carregarReferenciaRecomposicaoAplicadaTx", () => {
  it("usa somente aplicaÃ§Ã£o efetivada da matrÃ­cula e guarda a Ã¢ncora deslocada", async () => {
    const banco = txReferencia(aplicacao(), [{ id: "cobranca-1", coberturaInicio: new Date("2026-10-03T00:00:00Z"), coberturaFim: new Date("2026-11-02T00:00:00Z") }]);
    await expect(carregarReferenciaRecomposicaoAplicadaTx(banco as never, "matricula-1")).resolves.toEqual({ aplicacaoId: "aplicacao-1", decisaoId: "decisao-1", cobrancaId: "cobranca-1", aplicadaEm: "2026-11-03T12:00:00.000Z", dataReferencia: "2026-11-03" });
    expect(banco.aplicacaoRecomposicaoCobertura.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { decisao: { aprovada: true, rascunho: { matriculaId: "matricula-1" } } } }));
  });
  it("nÃ£o infere referÃªncia sem aplicaÃ§Ã£o e recusa fonte posterior divergente", async () => {
    await expect(carregarReferenciaRecomposicaoAplicadaTx(txReferencia(null, []) as never, "outra-matricula")).resolves.toBeNull();
    const banco = txReferencia(aplicacao(), [{ id: "cobranca-1", coberturaInicio: new Date("2026-10-01T00:00:00Z"), coberturaFim: new Date("2026-10-31T00:00:00Z") }]);
    await expect(carregarReferenciaRecomposicaoAplicadaTx(banco as never, "matricula-1")).rejects.toThrow(/alterada por outra origem/);
  });
});



describe("conferirOrigensConcorrentesAposRecomposicaoTx", () => {
  const banco = (periodoIntegral: unknown, retomada: unknown) => ({
    aplicacaoPeriodoIntegral: { findFirst: vi.fn().mockResolvedValue(periodoIntegral) },
    itemPropostaRetomadaMatriculas: { findFirst: vi.fn().mockResolvedValue(retomada) },
  });
  const origem = { matriculaId: "matricula-1", aplicadaEm: "2026-11-03T12:00:00.000Z" };
  it("bloqueia Q159 posterior mesmo fora da última cobrança", async () => {
    await expect(conferirOrigensConcorrentesAposRecomposicaoTx(banco({ id: "periodo-em-cobranca-anterior" }, null) as never, origem)).rejects.toThrow(/origem de cobertura aplicada depois/);
  });
  it("bloqueia retomada Q66 posterior e não inventa prioridade", async () => {
    await expect(conferirOrigensConcorrentesAposRecomposicaoTx(banco(null, { id: "retomada-em-outra-cobranca" }) as never, origem)).rejects.toThrow(/origem de cobertura aplicada depois/);
  });
  it("permite a âncora quando não há aplicação posterior", async () => {
    await expect(conferirOrigensConcorrentesAposRecomposicaoTx(banco(null, null) as never, origem)).resolves.toBeUndefined();
  });
});
