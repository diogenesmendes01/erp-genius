import { describe, expect, it, vi } from "vitest";
import { ErroRegra } from "@/server/_shared";
import { MENSAGEM_REGIME_NOVA_CONTRATACAO, recusarAditivoDeRegime } from "./aditivo-coerencia";
import { prepararAditivoContratualTx } from "./aditivo-tx";

// Port da #62 (08ad8462), lote 1 da #164. Decisão de 21/09/2026 (quinta rodada):
// mudança de regime é nova contratação, e o aditivo de REGIME é recusado já na proposta.
const regime = { origem: "REGIME" as const, novo: "Particular por hora", valorEstruturado: { tipo: "REGIME" as const, regime: "HORA_PARTICULAR" as const } };
const mensalidade = { origem: "MENSALIDADE_VALOR" as const, novo: "10.00 BRL", valorEstruturado: { tipo: "DINHEIRO" as const, valor: "10.00", moeda: "BRL" } };

describe("Q174 — mudança de regime é nova contratação", () => {
  it("recusa o aditivo de regime, sozinho ou acompanhado, com orientação", () => {
    expect(() => recusarAditivoDeRegime([regime])).toThrow(MENSAGEM_REGIME_NOVA_CONTRATACAO);
    expect(() => recusarAditivoDeRegime([regime, mensalidade])).toThrow(/nova negociação/);
    // Snapshot legado, sem valor estruturado: a origem basta para recusar.
    expect(() => recusarAditivoDeRegime([{ origem: "REGIME" }])).toThrow(ErroRegra);
  });

  it("demais alterações continuam aceitas", () => {
    expect(() => recusarAditivoDeRegime([mensalidade, { origem: "ALUNO_NOME" }])).not.toThrow();
  });

  it("a preparação da proposta recusa o regime antes de tocar no banco", async () => {
    const tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn(), propostaAditivoContratual: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() } };
    const entrada = { matriculaId: "m1", conclusaoOriginalId: "c1", conclusaoHashEsperado: "a".repeat(64), modeloId: "modelo1", modeloHashEsperado: "b".repeat(64),
      vigenciaInicio: "2027-01-01T00:00:00.000Z", motivo: "Aluno quer passar a pagar por hora", chaveIdempotencia: "chave-123", alteracoes: [regime] };
    await expect(prepararAditivoContratualTx(tx as never, "autor", entrada)).rejects.toThrow(MENSAGEM_REGIME_NOVA_CONTRATACAO);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.propostaAditivoContratual.create).not.toHaveBeenCalled();
  });
});
