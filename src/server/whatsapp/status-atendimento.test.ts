import { describe, expect, it } from "vitest";
import { chaveDeReabertura, proximoStatus } from "./status-atendimento";

describe("proximoStatus", () => {
  it.each([
    ["ABERTO_SEM_RESPONSAVEL", "ASSUMIDO", true, "EM_ATENDIMENTO"],
    ["EM_ATENDIMENTO", "RESPOSTA_HUMANA", true, "AGUARDANDO_CLIENTE"],
    ["AGUARDANDO_CLIENTE", "INBOUND", true, "EM_ATENDIMENTO"],
    ["AGUARDANDO_CLIENTE", "INBOUND", false, "ABERTO_SEM_RESPONSAVEL"],
    ["EM_ATENDIMENTO", "DEVOLVIDO", false, "ABERTO_SEM_RESPONSAVEL"],
    ["ENCERRADO", "INBOUND", true, "ENCERRADO"],
    ["EM_ATENDIMENTO", "INBOUND", true, "EM_ATENDIMENTO"],
    ["ABERTO_SEM_RESPONSAVEL", "INBOUND", false, "ABERTO_SEM_RESPONSAVEL"],
    ["EM_ATENDIMENTO", "ENCERRADO", true, "ENCERRADO"],
    ["ENCERRADO", "ASSUMIDO", true, "ENCERRADO"],
  ])("%s + %s (responsável=%s) → %s", (atual, ev, resp, esperado) => {
    expect(proximoStatus(atual as never, ev as never, resp)).toBe(esperado);
  });
  it("chave de reabertura", () => { expect(chaveDeReabertura("SECRETARIA::a1:", 1)).toBe("SECRETARIA::a1:#2"); });
});
