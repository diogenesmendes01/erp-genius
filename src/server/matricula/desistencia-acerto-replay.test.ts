import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/_shared", () => ({ ErroRegra: class ErroRegra extends Error {} }));

import { conferirPedidoReplayAcertoDesistencia } from "./desistencia-acerto-replay";

const anterior = {
  pedidoId: "pedido", condicoesId: "condicoes", anteriorId: "proposta-1", motivoReapresentacao: "Fotografia conferida novamente.",
  memoria: { motivo: "Memória atualizada conforme a regra contratual." },
};
const entrada = {
  pedidoId: "pedido", condicoesId: "condicoes", anteriorId: "proposta-1", motivoReapresentacao: "Fotografia conferida novamente.",
  motivo: "Memória atualizada conforme a regra contratual.",
};

describe("conferirPedidoReplayAcertoDesistencia", () => {
  it("aceita somente a reapresentação idêntica", () => {
    expect(() => conferirPedidoReplayAcertoDesistencia(anterior, entrada)).not.toThrow();
    expect(() => conferirPedidoReplayAcertoDesistencia(anterior, { ...entrada, anteriorId: "proposta-outra" })).toThrow("Chave já utilizada");
    expect(() => conferirPedidoReplayAcertoDesistencia(anterior, { ...entrada, motivoReapresentacao: "Outro fundamento estruturado." })).toThrow("Chave já utilizada");
  });
});