import { describe, expect, it } from "vitest";
import { provedorSimulado } from "./simulado";
import type { PedidoIA } from "./tipos";

const pedido = (texto: string): PedidoIA => ({
  tarefa: "conversa",
  sistema: "x",
  mensagens: [{ papel: "usuario", texto }],
  maxTokens: 100,
});

describe("provedorSimulado", () => {
  it("simulado_deterministico_em_json", async () => {
    const a = await provedorSimulado.gerar(pedido("Quanto custa a mensalidade?"));
    expect(a).toEqual(await provedorSimulado.gerar(pedido("Quanto custa a mensalidade?")));
    expect(() => JSON.parse(a.texto)).not.toThrow();
    expect(a).toMatchObject({ modelo: "simulado", recusa: false });
    expect(JSON.parse(a.texto)).toMatchObject({ acoes: [], confianca: 60, handoff: null, fontes: [] });
  });
  it("simulado_pedido_humano_vira_handoff", async () => {
    const j = JSON.parse((await provedorSimulado.gerar(pedido("quero falar com um atendente"))).texto);
    expect(j.handoff).toEqual({ motivo: "PEDIDO_HUMANO" });
    expect(j.confianca).toBeLessThan(50);
  });
  it("simulado_classifica_setor", async () =>
    expect(JSON.parse((await provedorSimulado.gerar({ ...pedido("segunda via do boleto"), tarefa: "classificacao" })).texto))
      .toEqual({ setor: "FINANCEIRO", confianca: 90 }));
  it("simulado_classificacao_sem_match", async () =>
    expect(JSON.parse((await provedorSimulado.gerar({ ...pedido("bom dia"), tarefa: "classificacao" })).texto))
      .toEqual({ setor: null, confianca: 0 }));
  it("simulado_extracao_vazia", async () =>
    expect(JSON.parse((await provedorSimulado.gerar({ ...pedido("x"), tarefa: "extracao" })).texto))
      .toEqual({ texto: "" }));
});
