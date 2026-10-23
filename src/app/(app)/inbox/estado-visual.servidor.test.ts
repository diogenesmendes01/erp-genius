import { describe, expect, it, vi } from "vitest";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";

// A regra compartilhada não pode depender do relógio cliente para calcular estado.
// A fábrica só é executada se esse módulo entrar no grafo de imports da regra.
vi.mock("./prazo-vivo", () => { throw new Error("O relógio cliente não está disponível neste consumidor."); });

describe("estado visual compartilhado", () => {
  it("calcula prazo e cabeçalho sem carregar o módulo cliente do relógio", async () => {
    const { estadoVisualItem, estadoVisualCabecalho } = await import("./estado-visual");
    const item: ItemListaInbox = {
      id: "a1", numeroId: "n1", numeroRotulo: "Central", finalidade: "COMERCIAL", driver: "SIMULADO",
      contatoId: "c1", contatoNome: "Contato fictício", contatoTelefone: "+5500000000301", optOut: false, vinculo: null,
      naoLidas: 0, ultimaMensagemEm: null, preview: "Oi", linhaComercial: false,
      status: "EM_ATENDIMENTO", responsavelNome: "Ana", prazoRespostaEm: "2026-10-22T11:30:00.000Z", fixada: false, silenciada: false, grupo: false,
      responsavelId: "u1", numeroDonoId: null, setoresDoNumero: ["COMERCIAL"], atendimentoOrigemId: null, capacidades: [],
    };
    expect(estadoVisualItem(item, new Date("2026-10-22T12:00:00.000Z"), "u1").badges)
      .toContainEqual({ tom: "atraso", texto: "Prazo estourado · 30 min", icone: "relogio", ponto: false });
    expect(estadoVisualCabecalho(item, "u1").estado.texto).toBe("Você está atendendo");
  });
});
